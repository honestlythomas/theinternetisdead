#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
CHANNELS_PATH = ROOT / "dead" / "JSON" / "feeds-channels.json"
OUTPUT_PATH = ROOT / "dead" / "JSON" / "feed-videos.json"
LEGACY_FALLBACK_PATH = ROOT / "dead" / "JSON" / "videos.json"
LOCAL_COOKIES_PATH = ROOT / "cookies.txt"
YT_DLP_TIMEOUT_SECONDS = int(os.environ.get("YT_DLP_TIMEOUT_SECONDS") or "180")
FULL_METADATA_REFRESH = os.environ.get("FEED_FULL_METADATA_REFRESH", "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def log_progress(message):
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)


def load_channels_config():
    data = json.loads(CHANNELS_PATH.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        title = str(data.get("title") or "Channel Feed").strip() or "Channel Feed"
        raw_channels = data.get("channels") or []
    elif isinstance(data, list):
        title = "Channel Feed"
        raw_channels = data
    else:
        raise ValueError("channels.json must be an object or array")

    channels = []
    seen_urls = set()
    for item in raw_channels:
        if isinstance(item, str):
            url = item.strip()
        elif isinstance(item, dict):
            url = str(item.get("url") or item.get("channel_url") or "").strip()
        else:
            continue

        if not url:
            continue

        source_urls = normalize_channel_source_urls(url)
        normalized_url = source_urls[0]
        if normalized_url in seen_urls:
            continue

        channels.append({"url": normalized_url, "source_urls": source_urls})
        seen_urls.add(normalized_url)

    if not channels:
        raise ValueError("channels.json does not contain any valid channel URLs")

    return {"title": title, "channels": channels}


def normalize_channel_base_url(url):
    value = str(url or "").strip()
    if not value:
        return value
    if value.startswith("@"):
        return f"https://www.youtube.com/{value}"
    if value.startswith("http://"):
        value = "https://" + value[len("http://") :]
    if not value.startswith("https://"):
        raise ValueError(f"Unsupported channel URL: {url}")
    value = value.rstrip("/")
    for suffix in ("/videos", "/shorts"):
        if value.endswith(suffix):
            return value[: -len(suffix)]
    return value


def normalize_channel_source_urls(url):
    base_url = normalize_channel_base_url(url)
    return [
        f"{base_url}/videos",
        f"{base_url}/shorts",
    ]


def run_yt_dlp_json(url, flat_playlist=False):
    base_command = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--ignore-errors",
        "--ignore-no-formats-error",
        "--no-warnings",
        "--extractor-args",
        "youtube:approximate_date",
        "-J",
        url,
    ]
    if flat_playlist:
        base_command[3:3] = ["--flat-playlist"]
    cookies_from_browser = get_cookies_from_browser()
    cookies_path = get_cookies_path()
    attempts = []
    if cookies_from_browser:
        attempts.append({"browser": cookies_from_browser})
    if cookies_path:
        attempts.append({"cookies": cookies_path})
    if not attempts:
        attempts.append({})
    else:
        attempts.append({})

    last_error = ""
    for attempt in attempts:
        command = list(base_command)
        using_browser_cookies = "browser" in attempt
        using_cookies = "cookies" in attempt
        attempt_label = "browser cookies" if using_browser_cookies else "cookie file" if using_cookies else "no cookies"
        if using_browser_cookies:
            command[3:3] = ["--cookies-from-browser", attempt["browser"]]
        elif using_cookies:
            command[3:3] = ["--cookies", str(attempt["cookies"])]

        mode_label = "flat" if flat_playlist else "full"
        log_progress(f"yt-dlp start ({mode_label}, {attempt_label}): {url}")
        start = time.monotonic()
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                encoding="utf-8",
                check=False,
                timeout=YT_DLP_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            elapsed = time.monotonic() - start
            last_error = f"yt-dlp timed out after {elapsed:.1f}s for {url}"
            log_progress(f"yt-dlp timeout ({mode_label}, {attempt_label}, {elapsed:.1f}s): {url}")
            if using_browser_cookies:
                print(f"Warning: browser-cookie fetch timed out for {url}; retrying without browser cookies.", file=sys.stderr)
                continue
            if using_cookies:
                print(f"Warning: cookie-file fetch timed out for {url}; retrying without cookie file.", file=sys.stderr)
                continue
            raise RuntimeError(last_error)
        elapsed = time.monotonic() - start
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        parsed_data = None
        if stdout:
            try:
                parsed_data = json.loads(stdout)
            except json.JSONDecodeError:
                parsed_data = None

        if parsed_data is not None:
            entries_count = len(parsed_data.get("entries") or []) if isinstance(parsed_data, dict) else 0
            log_progress(f"yt-dlp done ({mode_label}, {attempt_label}, {elapsed:.1f}s, entries={entries_count}): {url}")
            if stderr:
                print(stderr, file=sys.stderr)
            return parsed_data

        last_error = stderr or f"yt-dlp returned no JSON for {url}"
        log_progress(f"yt-dlp failed ({mode_label}, {attempt_label}, {elapsed:.1f}s): {url}")
        if using_browser_cookies:
            print(f"Warning: browser-cookie fetch failed for {url}; retrying without browser cookies.", file=sys.stderr)
            continue
        if using_cookies:
            print(f"Warning: cookie-file fetch failed for {url}; retrying without cookie file.", file=sys.stderr)
            continue

    raise RuntimeError(last_error or f"yt-dlp returned no JSON for {url}")

def get_cookies_from_browser():
    value = str(os.environ.get("YT_DLP_COOKIES_FROM_BROWSER") or "").strip()
    return value or None


def get_cookies_path():
    env_path = str(os.environ.get("YT_DLP_COOKIES_PATH") or "").strip()
    if env_path:
        candidate = Path(env_path).expanduser()
        if candidate.exists():
            return candidate
        print(f"Warning: cookie file not found at {candidate}", file=sys.stderr)

    if LOCAL_COOKIES_PATH.exists():
        return LOCAL_COOKIES_PATH

    return None


def build_watch_url(video):
    direct_url = str(video.get("url") or "").strip()
    video_id = str(video.get("id") or "").strip()
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"

    if direct_url:
        return direct_url

    webpage_url = str(video.get("webpage_url") or "").strip()
    if webpage_url:
        return webpage_url

    original_url = str(video.get("original_url") or "").strip()
    if original_url:
        return original_url

    return ""


def get_video_id(video):
    video_id = str(video.get("id") or "").strip()
    if video_id:
        return video_id

    for key in ("url", "webpage_url", "original_url"):
        value = str(video.get(key) or "").strip()
        marker = "/shorts/"
        if marker in value:
            return value.split(marker, 1)[1].split("?", 1)[0].split("&", 1)[0].split("/", 1)[0]
        marker = "v="
        if marker in value:
            return value.split(marker, 1)[1].split("&", 1)[0]

    return video_id


def get_sort_timestamp(video):
    for key in ("release_timestamp", "timestamp"):
        value = video.get(key)
        if isinstance(value, (int, float)):
            return int(value)

    upload_date = str(video.get("upload_date") or "").strip()
    if len(upload_date) == 8 and upload_date.isdigit():
        year = int(upload_date[0:4])
        month = int(upload_date[4:6])
        day = int(upload_date[6:8])
        return int(datetime(year, month, day, tzinfo=timezone.utc).timestamp())

    return 0


def get_sort_date(video):
    upload_date = str(video.get("upload_date") or "").strip()
    if len(upload_date) == 8 and upload_date.isdigit():
        return upload_date

    for key in ("release_timestamp", "timestamp"):
        value = video.get(key)
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(value, tz=timezone.utc).strftime("%Y%m%d")

    return ""


def slim_thumbnails(video):
    thumbnails = video.get("thumbnails") or []
    slimmed = []
    for thumb in thumbnails:
        if not isinstance(thumb, dict):
            continue
        url = thumb.get("url")
        if not url:
            continue
        slimmed.append(
            {
                "url": url,
                "width": thumb.get("width"),
                "height": thumb.get("height"),
            }
        )
    return slimmed


def has_meaningful_text(value):
    return bool(str(value or "").strip())


def has_usable_thumbnails(video):
    return bool(slim_thumbnails(video))


def has_valid_view_count(video):
    value = video.get("view_count") if isinstance(video, dict) else None
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def video_needs_hydration(video):
    if not isinstance(video, dict):
        return True

    return not (
        has_meaningful_text(video.get("title"))
        and get_sort_timestamp(video) > 0
        and has_usable_thumbnails(video)
        and has_valid_view_count(video)
    )


def merge_video_data(base_video, hydrated_video):
    if not isinstance(base_video, dict):
        return hydrated_video if isinstance(hydrated_video, dict) else {}
    if not isinstance(hydrated_video, dict):
        return dict(base_video)

    merged = dict(base_video)
    for key, value in hydrated_video.items():
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        if isinstance(value, (list, dict)) and not value:
            continue
        merged[key] = value
    return merged


def hydrate_video_entry(video, force=False):
    if not force and not video_needs_hydration(video):
        return video

    watch_url = build_watch_url(video)
    if not watch_url:
        return video

    log_progress(f"hydrate start: {watch_url}")
    try:
        hydrated_video = run_yt_dlp_json(watch_url)
    except Exception as exc:  # noqa: BLE001 - preserve feed generation from partial data.
        print(f"Warning: failed to hydrate {watch_url}: {exc}", file=sys.stderr)
        return video

    log_progress(f"hydrate done: {watch_url}")
    return merge_video_data(video, hydrated_video)


def slim_video(video, channel_meta):
    video_id = get_video_id(video)
    return {
        "id": video_id,
        "url": build_watch_url({**video, "id": video_id}),
        "title": video.get("title") or "",
        "description": video.get("description") or "",
        "duration": video.get("duration") or 0,
        "view_count": video.get("view_count") or 0,
        "channel": video.get("channel") or channel_meta.get("channel") or channel_meta.get("uploader") or "",
        "channel_id": video.get("channel_id") or channel_meta.get("channel_id"),
        "channel_url": video.get("channel_url") or channel_meta.get("channel_url"),
        "uploader": video.get("uploader") or channel_meta.get("uploader") or channel_meta.get("channel") or "",
        "uploader_url": video.get("uploader_url") or channel_meta.get("uploader_url"),
        "timestamp": video.get("timestamp"),
        "release_timestamp": video.get("release_timestamp"),
        "upload_date": video.get("upload_date"),
        "thumbnails": slim_thumbnails(video),
    }


def load_legacy_fallback_feed():
    if not LEGACY_FALLBACK_PATH.exists():
        return {"channels": [], "entries": []}

    data = json.loads(LEGACY_FALLBACK_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {"channels": [], "entries": []}

    channel_meta = {
        "url": data.get("webpage_url") or data.get("original_url") or data.get("channel_url") or data.get("uploader_url") or "",
        "channel": data.get("channel") or data.get("uploader") or "",
        "channel_id": data.get("channel_id") or data.get("id"),
        "channel_url": data.get("channel_url") or data.get("uploader_url") or "",
        "uploader": data.get("uploader") or data.get("channel") or "",
        "uploader_url": data.get("uploader_url") or data.get("channel_url") or "",
    }

    entries = []
    seen_video_ids = set()
    for entry in data.get("entries") or []:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get("id") or "").strip()
        if not video_id or video_id in seen_video_ids:
            continue
        seen_video_ids.add(video_id)
        entries.append(slim_video(entry, channel_meta))

    entries.sort(
        key=lambda video: (get_sort_timestamp(video), str(video.get("id") or "")),
        reverse=True,
    )

    channels = [channel_meta] if any(channel_meta.values()) else []
    return {"channels": channels, "entries": entries}


def load_existing_feed():
    if not OUTPUT_PATH.exists():
        return {"title": "Channel Feed", "generated_at": None, "channels": [], "entries": []}

    data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {"title": "Channel Feed", "generated_at": None, "channels": [], "entries": []}

    entries = [entry for entry in data.get("entries") or [] if isinstance(entry, dict)]
    channels = [channel for channel in data.get("channels") or [] if isinstance(channel, dict)]
    return {
        "title": data.get("title") or "Channel Feed",
        "generated_at": data.get("generated_at"),
        "channels": channels,
        "entries": entries,
    }


def dedupe_existing_entries(entries):
    unique_entries = []
    seen_video_ids = set()
    duplicate_ids = set()
    for entry in entries:
        video_id = get_video_id(entry)
        if not video_id:
            unique_entries.append(entry)
            continue
        if video_id in seen_video_ids:
            duplicate_ids.add(video_id)
            continue
        seen_video_ids.add(video_id)
        unique_entries.append(entry)
    return unique_entries, duplicate_ids


def entries_by_id(entries):
    indexed = {}
    for entry in entries:
        video_id = get_video_id(entry)
        if video_id and video_id not in indexed:
            indexed[video_id] = entry
    return indexed


def hydrate_and_slim_video(video, channel_meta, force=False):
    video_id = get_video_id(video)
    return slim_video(hydrate_video_entry({**video, "id": video_id}, force=force), channel_meta)


def refresh_existing_entry(existing_entry, discovered_video, channel_meta):
    refreshed = dict(existing_entry)

    for key in ("title", "description", "duration", "view_count"):
        value = discovered_video.get(key)
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        refreshed[key] = value

    for key, fallback_key in (
        ("channel", "uploader"),
        ("channel_id", "channel_id"),
        ("channel_url", "channel_url"),
        ("uploader", "channel"),
        ("uploader_url", "channel_url"),
    ):
        if refreshed.get(key):
            continue
        value = discovered_video.get(key) or channel_meta.get(key) or channel_meta.get(fallback_key)
        if value:
            refreshed[key] = value

    return refreshed


def payload_without_generated_at(payload):
    comparable = dict(payload)
    comparable.pop("generated_at", None)
    return comparable


def sort_entries_by_date(entries):
    indexed_entries = list(enumerate(entries))
    indexed_entries.sort(
        key=lambda item: (get_sort_date(item[1]), -item[0]),
        reverse=True,
    )
    return [entry for _, entry in indexed_entries]


def main():
    config = load_channels_config()
    existing_feed = load_existing_feed()
    existing_entries, duplicate_existing_ids = dedupe_existing_entries(existing_feed["entries"])
    existing_by_id = entries_by_id(existing_entries)
    discovered_channels = []
    discovered_entries = []
    seen_video_ids = set()
    discovered_duplicate_ids = set()

    for channel_config in config["channels"]:
        channel_url = channel_config["url"]
        source_urls = channel_config.get("source_urls") or [channel_url]
        channel_meta = None
        log_progress(f"channel start: {channel_url}")
        try:
            primary_channel_data = run_yt_dlp_json(channel_url, flat_playlist=True)
        except Exception as exc:  # noqa: BLE001 - keep building from remaining sources.
            print(f"Warning: failed to load {channel_url}: {exc}", file=sys.stderr)
            primary_channel_data = None
        if not isinstance(primary_channel_data, dict):
            print(f"Warning: unable to read channel feed for {channel_url}", file=sys.stderr)

        if isinstance(primary_channel_data, dict):
            channel_meta = {
                "url": channel_url,
                "channel": primary_channel_data.get("channel") or primary_channel_data.get("uploader") or "",
                "channel_id": primary_channel_data.get("channel_id") or primary_channel_data.get("id"),
                "channel_url": primary_channel_data.get("channel_url") or channel_url,
                "uploader": primary_channel_data.get("uploader") or primary_channel_data.get("channel") or "",
                "uploader_url": primary_channel_data.get("uploader_url") or primary_channel_data.get("channel_url") or channel_url,
            }
            discovered_channels.append(channel_meta)

        for source_url in source_urls:
            source_kind = "shorts" if source_url.rstrip("/").endswith("/shorts") else "videos"
            log_progress(f"source start ({source_kind}): {source_url}")
            if source_url == channel_url and isinstance(primary_channel_data, dict):
                channel_data = primary_channel_data
            else:
                try:
                    channel_data = run_yt_dlp_json(source_url, flat_playlist=True)
                except Exception as exc:  # noqa: BLE001 - keep building from remaining sources.
                    print(f"Warning: failed to load {source_url}: {exc}", file=sys.stderr)
                    continue

            if not isinstance(channel_data, dict):
                continue

            source_added = 0
            source_duplicates = 0
            if channel_meta is None:
                channel_meta = {
                    "url": channel_url,
                    "channel": channel_data.get("channel") or channel_data.get("uploader") or "",
                    "channel_id": channel_data.get("channel_id") or channel_data.get("id"),
                    "channel_url": channel_data.get("channel_url") or channel_url,
                    "uploader": channel_data.get("uploader") or channel_data.get("channel") or "",
                    "uploader_url": channel_data.get("uploader_url") or channel_data.get("channel_url") or channel_url,
                }
                discovered_channels.append(channel_meta)

            for entry in channel_data.get("entries") or []:
                if not isinstance(entry, dict):
                    continue
                video_id = get_video_id(entry)
                if not video_id or video_id in seen_video_ids:
                    if video_id:
                        source_duplicates += 1
                        discovered_duplicate_ids.add(video_id)
                    continue
                seen_video_ids.add(video_id)
                discovered_entries.append({"entry": {**entry, "id": video_id}, "channel_meta": channel_meta})
                source_added += 1

            log_progress(f"source done ({source_kind}, added={source_added}, duplicates={source_duplicates}): {source_url}")

        log_progress(f"channel done: {channel_url}")

    new_entries = []
    updated_existing_by_id = {}
    new_ids_added = []
    existing_ids_rehydrated = []
    for discovered in discovered_entries:
        video = discovered["entry"]
        channel_meta = discovered["channel_meta"]
        video_id = get_video_id(video)
        existing_entry = existing_by_id.get(video_id)
        if existing_entry is None:
            new_entries.append(hydrate_and_slim_video(video, channel_meta))
            new_ids_added.append(video_id)
            continue
        refreshed_existing_entry = refresh_existing_entry(existing_entry, video, channel_meta)
        if FULL_METADATA_REFRESH:
            updated_existing_by_id[video_id] = hydrate_and_slim_video(refreshed_existing_entry, channel_meta, force=True)
            existing_ids_rehydrated.append(video_id)
            continue
        if video_needs_hydration(existing_entry):
            updated_existing_by_id[video_id] = hydrate_and_slim_video(merge_video_data(existing_entry, video), channel_meta)
            existing_ids_rehydrated.append(video_id)
        else:
            updated_existing_by_id[video_id] = refreshed_existing_entry

    merged_entries = []
    for existing_entry in existing_entries:
        video_id = get_video_id(existing_entry)
        if video_id and video_id in updated_existing_by_id:
            merged_entries.append(updated_existing_by_id[video_id])
        else:
            merged_entries.append(existing_entry)

    if new_entries:
        merged_entries = new_entries + merged_entries

    if not merged_entries:
        fallback_feed = load_legacy_fallback_feed()
        if fallback_feed["entries"]:
            merged_entries = fallback_feed["entries"]
            if not discovered_channels:
                discovered_channels = fallback_feed["channels"]

    if not discovered_channels:
        discovered_channels = existing_feed["channels"]

    merged_entries = sort_entries_by_date(merged_entries)

    payload = {
        "title": config["title"],
        "generated_at": existing_feed.get("generated_at") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "channels": discovered_channels,
        "entries": merged_entries,
    }

    existing_payload = {
        "title": existing_feed.get("title") or config["title"],
        "generated_at": existing_feed.get("generated_at"),
        "channels": existing_feed["channels"],
        "entries": existing_entries,
    }

    changed = (
        bool(new_ids_added)
        or bool(existing_ids_rehydrated)
        or bool(duplicate_existing_ids)
        or payload_without_generated_at(payload) != payload_without_generated_at(existing_payload)
    )

    if not changed:
        log_progress(
            "no feed changes "
            f"(discovered={len(discovered_entries)}, new=0, rehydrated=0, "
            f"existing_duplicate_ids={len(duplicate_existing_ids)}, discovered_duplicate_ids={len(discovered_duplicate_ids)})"
        )
        return

    payload["generated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    log_progress(
        f"wrote {OUTPUT_PATH} with {len(merged_entries)} entries "
        f"(discovered={len(discovered_entries)}, new={len(new_ids_added)}, "
        f"rehydrated={len(existing_ids_rehydrated)}, existing_duplicate_ids={len(duplicate_existing_ids)}, "
        f"discovered_duplicate_ids={len(discovered_duplicate_ids)})"
    )


if __name__ == "__main__":
    main()
