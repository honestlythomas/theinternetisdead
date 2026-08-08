#!/usr/bin/env python3
"""Generate the offline Honestly Thomas video archive.

Reads the source archive without modifying it. Safe to rerun: owned thumbnail
copies are replaced only when their content differs, and unrelated files are
never deleted.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SOURCE_ROOT = Path(r"Z:\WEBDEV\downloads\output-honestly-thomas")
SITE_ROOT = Path(__file__).resolve().parent.parent
DATA_JSON = SITE_ROOT / "archive-data.json"
DATA_JS = SITE_ROOT / "archive-data.js"
REPORT_PATH = SITE_ROOT / "logs" / "build-report.txt"
THUMBNAILS_ROOT = SITE_ROOT / "assets" / "thumbnails"
UPLOAD_DATES_PATH = SITE_ROOT / "upload-dates.json"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
JPEG_MAGIC = b"\xff\xd8\xff"

DISPLAY_FIELDS = (
    "title",
    "upload_date",
    "duration",
    "view_count",
    "description",
    "id",
    "source_url",
    "content_type",
    "channel_name",
    "thumbnail_filename",
)

AUDIT_FIELDS = (
    "title",
    "upload_date",
    "duration",
    "view_count",
    "description",
    "id",
    "webpage_url",
    "url",
    "channel",
    "channel_id",
    "uploader",
    "classification",
    "availability",
    "live_status",
)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_text(path: Path, text: str) -> None:
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    os.replace(temporary, path)


def atomic_json(path: Path, value: Any) -> None:
    serialized = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    atomic_text(path, serialized)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def source_snapshot() -> dict[str, Any]:
    aggregate = hashlib.sha256()
    count = 0
    total_bytes = 0
    files = sorted(
        (path for path in SOURCE_ROOT.rglob("*") if path.is_file()),
        key=lambda path: path.relative_to(SOURCE_ROOT).as_posix().casefold(),
    )
    for path in files:
        relative = path.relative_to(SOURCE_ROOT).as_posix()
        stat = path.stat()
        digest = sha256(path)
        aggregate.update(
            f"{relative}\0{stat.st_size}\0{stat.st_mtime_ns}\0{digest}\n".encode(
                "utf-8"
            )
        )
        count += 1
        total_bytes += stat.st_size
    return {
        "file_count": count,
        "total_bytes": total_bytes,
        "fingerprint_sha256": aggregate.hexdigest(),
    }


def resolve_ffprobe() -> Path:
    tools_path = SOURCE_ROOT / "phase-1-tools.json"
    with tools_path.open("r", encoding="utf-8") as handle:
        tools = json.load(handle)
    path_value = tools.get("ffprobe", {}).get("path")
    if not path_value:
        raise RuntimeError("phase-1-tools.json does not record ffprobe")
    path = Path(path_value)
    if not path.is_file():
        raise FileNotFoundError(f"Recorded ffprobe is missing: {path}")
    return path


def probe_jpeg(path: Path, ffprobe: Path) -> dict[str, int] | None:
    if not path.is_file() or path.stat().st_size <= 0:
        return None
    try:
        with path.open("rb") as handle:
            if handle.read(3) != JPEG_MAGIC:
                return None
    except OSError:
        return None
    completed = subprocess.run(
        [
            str(ffprobe),
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name,width,height",
            "-of",
            "json",
            str(path),
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        return None
    try:
        stream = json.loads(completed.stdout.decode("utf-8"))["streams"][0]
        if stream["codec_name"] != "mjpeg":
            return None
        width = int(stream["width"])
        height = int(stream["height"])
    except (ValueError, TypeError, KeyError, IndexError, json.JSONDecodeError):
        return None
    if width <= 0 or height <= 0:
        return None
    return {"width": width, "height": height}


def useful_extra_metadata(item: dict[str, Any]) -> dict[str, Any]:
    excluded = {
        "__x_forwarded_for_ip",
        "classification",
        "description",
        "duration",
        "id",
        "original_tab_classification",
        "phase_2_thumbnail",
        "thumbnails",
        "title",
        "upload_date",
        "url",
        "view_count",
        "webpage_url",
    }
    result: dict[str, Any] = {}
    for key, value in item.items():
        if key in excluded or value is None or value == "" or value == [] or value == {}:
            continue
        result[key] = value
    return result


def text_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def number_or_none(value: Any) -> int | float | None:
    if isinstance(value, bool):
        return None
    return value if isinstance(value, (int, float)) else None


def canonical_url(item: dict[str, Any], video_id: str) -> str:
    for key in ("webpage_url", "url"):
        value = text_or_none(item.get(key))
        if value and value.startswith(("https://", "http://")):
            return value
    return f"https://www.youtube.com/watch?v={video_id}"


def normalize_upload_date(value: Any) -> str | None:
    text = text_or_none(value)
    if not text:
        return None
    if re.fullmatch(r"\d{8}", text):
        return f"{text[:4]}-{text[4:6]}-{text[6:]}"
    return text


def load_upload_dates() -> dict[str, str]:
    if not UPLOAD_DATES_PATH.is_file():
        return {}
    payload = json.loads(UPLOAD_DATES_PATH.read_text(encoding="utf-8"))
    values = payload.get("items", {})
    if not isinstance(values, dict):
        raise ValueError(f"{UPLOAD_DATES_PATH} does not contain an item map")
    return {
        video_id: value
        for video_id, value in values.items()
        if ID_RE.fullmatch(video_id)
        and isinstance(value, str)
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
    }


def copy_if_needed(source: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if (
        destination.is_file()
        and destination.stat().st_size == source.stat().st_size
        and sha256(destination) == sha256(source)
    ):
        return "reused"
    temporary = destination.with_name(destination.name + ".tmp")
    shutil.copy2(source, temporary)
    os.replace(temporary, destination)
    return "copied"


def main() -> int:
    started = timestamp()
    SITE_ROOT.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    THUMBNAILS_ROOT.mkdir(parents=True, exist_ok=True)

    report_lines = [
        "HONESTLY THOMAS // ARCHIVE BUILD REPORT",
        f"Started: {started}",
        f"Source (read-only): {SOURCE_ROOT}",
        f"Destination: {SITE_ROOT}",
        "",
    ]

    try:
        ffprobe = resolve_ffprobe()
        before_snapshot = source_snapshot()
        upload_dates = load_upload_dates()
    except Exception as exc:
        report_lines.append(f"FATAL: {exc}")
        atomic_text(REPORT_PATH, "\n".join(report_lines) + "\n")
        print(f"FATAL: {exc}", file=sys.stderr)
        return 1

    normalized_items: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    malformed: list[dict[str, Any]] = []
    duplicate_occurrences: dict[str, list[str]] = defaultdict(list)
    discovered_fields: Counter[str] = Counter()
    nonempty_fields: Counter[str] = Counter()
    missing_display: Counter[str] = Counter()
    missing_audit: Counter[str] = Counter()
    copy_counts: Counter[str] = Counter()

    settings = (
        ("Videos", "Video", "video-thumbnail.jpg", "videos"),
        ("Shorts", "Short", "short-thumbnail.jpg", "shorts"),
    )
    for classification, content_type, thumbnail_name, asset_subfolder in settings:
        source_class_root = SOURCE_ROOT / classification
        for folder in sorted(
            (path for path in source_class_root.iterdir() if path.is_dir()),
            key=lambda path: path.name.casefold(),
        ):
            if not ID_RE.fullmatch(folder.name):
                skipped.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": "folder name is not an 11-character YouTube ID",
                    }
                )
                continue
            item_path = folder / "item.json"
            thumbnail_path = folder / thumbnail_name
            if not item_path.is_file():
                skipped.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": "item.json is missing",
                    }
                )
                continue
            try:
                item = json.loads(item_path.read_text(encoding="utf-8"))
            except Exception as exc:
                malformed.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": f"item.json cannot be parsed: {exc}",
                    }
                )
                continue
            if item.get("id") != folder.name:
                malformed.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": "item.json ID does not match folder name",
                    }
                )
                continue
            if item.get("classification") != classification:
                malformed.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": "item.json classification does not match its root",
                    }
                )
                continue
            dimensions = probe_jpeg(thumbnail_path, ffprobe)
            if dimensions is None:
                skipped.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": f"{thumbnail_name} is missing or is not a readable JPEG",
                    }
                )
                continue

            for key, value in item.items():
                discovered_fields[key] += 1
                if value is not None and value != "" and value != [] and value != {}:
                    nonempty_fields[key] += 1
            for key in AUDIT_FIELDS:
                value = item.get(key)
                if value is None or value == "" or value == [] or value == {}:
                    missing_audit[key] += 1

            video_id = folder.name
            source_url = canonical_url(item, video_id)
            relative_thumbnail = (
                Path("assets")
                / "thumbnails"
                / asset_subfolder
                / f"{video_id}.jpg"
            )
            destination_thumbnail = SITE_ROOT / relative_thumbnail
            copy_status = copy_if_needed(thumbnail_path, destination_thumbnail)
            copy_counts[copy_status] += 1
            copied_dimensions = probe_jpeg(destination_thumbnail, ffprobe)
            if copied_dimensions != dimensions:
                malformed.append(
                    {
                        "classification": classification,
                        "folder": folder.name,
                        "reason": "copied thumbnail failed destination validation",
                    }
                )
                continue

            normalized = {
                "id": video_id,
                "title": text_or_none(item.get("title")) or f"Untitled item {video_id}",
                "classification": classification,
                "contentType": content_type,
                "uploadDate": (
                    normalize_upload_date(item.get("upload_date"))
                    or upload_dates.get(video_id)
                ),
                "durationSeconds": number_or_none(item.get("duration")),
                "viewCount": number_or_none(item.get("view_count")),
                "description": text_or_none(item.get("description")),
                "sourceUrl": source_url,
                "channelName": (
                    text_or_none(item.get("channel"))
                    or text_or_none(item.get("uploader"))
                ),
                "channelId": text_or_none(item.get("channel_id")),
                "uploader": text_or_none(item.get("uploader")),
                "availability": text_or_none(item.get("availability")),
                "liveStatus": text_or_none(item.get("live_status")),
                "thumbnail": relative_thumbnail.as_posix(),
                "thumbnailFilename": thumbnail_name,
                "thumbnailWidth": dimensions["width"],
                "thumbnailHeight": dimensions["height"],
                "thumbnailFileSizeBytes": destination_thumbnail.stat().st_size,
                "additionalMetadata": useful_extra_metadata(item),
            }
            display_values = {
                "title": normalized["title"],
                "upload_date": normalized["uploadDate"],
                "duration": normalized["durationSeconds"],
                "view_count": normalized["viewCount"],
                "description": normalized["description"],
                "id": normalized["id"],
                "source_url": normalized["sourceUrl"],
                "content_type": normalized["contentType"],
                "channel_name": normalized["channelName"],
                "thumbnail_filename": normalized["thumbnailFilename"],
            }
            for key, value in display_values.items():
                if value is None or value == "":
                    missing_display[key] += 1

            normalized_items.append(normalized)
            duplicate_occurrences[video_id].append(classification)

    normalized_items.sort(
        key=lambda item: (
            0 if item["classification"] == "Videos" else 1,
            item["title"].casefold(),
            item["id"],
        )
    )
    duplicate_ids = [
        {"id": video_id, "classifications": classifications}
        for video_id, classifications in sorted(duplicate_occurrences.items())
        if len(classifications) > 1
    ]
    videos = sum(1 for item in normalized_items if item["classification"] == "Videos")
    shorts = sum(1 for item in normalized_items if item["classification"] == "Shorts")
    data = {
        "generatedAt": timestamp(),
        "archiveTitle": "Honestly Thomas // Dead Internet Archive",
        "stats": {
            "videos": videos,
            "shorts": shorts,
            "total": len(normalized_items),
        },
        "build": {
            "skippedItems": len(skipped),
            "malformedItems": len(malformed),
            "duplicateIds": duplicate_ids,
            "missingDisplayMetadataValues": {
                key: missing_display.get(key, 0) for key in DISPLAY_FIELDS
            },
            "missingDisplayMetadataValuesTotal": sum(missing_display.values()),
            "missingAuditedMetadataValues": {
                key: missing_audit.get(key, 0) for key in AUDIT_FIELDS
            },
            "missingAuditedMetadataValuesTotal": sum(missing_audit.values()),
            "discoveredTopLevelFields": {
                key: {
                    "present": discovered_fields[key],
                    "nonempty": nonempty_fields[key],
                }
                for key in sorted(discovered_fields)
            },
        },
        "items": normalized_items,
    }
    atomic_json(DATA_JSON, data)
    # file:// pages cannot fetch adjacent JSON in modern browsers. This is an
    # exact generated transport copy; archive-data.json remains canonical.
    atomic_text(
        DATA_JS,
        "window.ARCHIVE_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
    )

    after_snapshot = source_snapshot()
    source_unchanged = before_snapshot == after_snapshot
    finished = timestamp()
    report_lines.extend(
        [
            "TOTALS",
            f"Videos included: {videos}",
            f"Shorts included: {shorts}",
            f"Total archive items: {len(normalized_items)}",
            f"Thumbnails copied this run: {copy_counts['copied']}",
            f"Thumbnails reused this run: {copy_counts['reused']}",
            f"Skipped items: {len(skipped)}",
            f"Malformed items: {len(malformed)}",
            f"Duplicate video IDs: {len(duplicate_ids)}",
            f"Cached upload dates available: {len(upload_dates)}",
            (
                "Missing normalized display metadata values: "
                f"{sum(missing_display.values())}"
            ),
            (
                "Missing audited optional metadata values: "
                f"{sum(missing_audit.values())}"
            ),
            "",
            "MISSING NORMALIZED DISPLAY METADATA",
            *[
                f"{key}: {missing_display.get(key, 0)}"
                for key in DISPLAY_FIELDS
            ],
            "",
            "SOURCE IMMUTABILITY",
            f"Before: {json.dumps(before_snapshot, sort_keys=True)}",
            f"After:  {json.dumps(after_snapshot, sort_keys=True)}",
            f"Source unchanged during generation: {'YES' if source_unchanged else 'NO'}",
            "",
            "OUTPUT VALIDATION",
            f"archive-data.json items: {len(normalized_items)}",
            f"Validated local thumbnails: {len(normalized_items)}",
            f"Every data item has a readable local JPEG: YES",
            "",
            "SKIPPED ITEMS",
            json.dumps(skipped, ensure_ascii=False, indent=2),
            "",
            "MALFORMED ITEMS",
            json.dumps(malformed, ensure_ascii=False, indent=2),
            "",
            "DUPLICATE IDS",
            json.dumps(duplicate_ids, ensure_ascii=False, indent=2),
            "",
            f"Finished: {finished}",
        ]
    )
    atomic_text(REPORT_PATH, "\n".join(report_lines) + "\n")

    print(f"Videos included: {videos}")
    print(f"Shorts included: {shorts}")
    print(f"Total archive items: {len(normalized_items)}")
    print(f"Thumbnails copied: {copy_counts['copied']}")
    print(f"Thumbnails reused: {copy_counts['reused']}")
    print(f"Skipped items: {len(skipped)}")
    print(f"Malformed items: {len(malformed)}")
    print(f"Missing display metadata values: {sum(missing_display.values())}")
    print(f"Source unchanged: {source_unchanged}")
    print(f"Data: {DATA_JSON}")
    print(f"Report: {REPORT_PATH}")
    return 0 if source_unchanged and not malformed else 1


if __name__ == "__main__":
    sys.exit(main())
