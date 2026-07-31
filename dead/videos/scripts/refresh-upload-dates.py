#!/usr/bin/env python3
"""Refresh the persistent YouTube upload-date cache used by the archive build."""

from __future__ import annotations

import argparse
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SOURCE_ROOT = Path(r"Z:\WEBDEV\downloads\output-honestly-thomas")
SITE_ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = SITE_ROOT / "upload-dates.json"
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
DATE_RE = re.compile(rb'"(?:uploadDate|publishDate)":"([^"]+)"')
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0.0.0 Safari/537.36"
)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_json(path: Path, value: Any) -> None:
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    temporary.replace(path)


def source_ids() -> list[str]:
    values: set[str] = set()
    for classification in ("Videos", "Shorts"):
        root = SOURCE_ROOT / classification
        for folder in root.iterdir():
            if folder.is_dir() and ID_RE.fullmatch(folder.name):
                values.add(folder.name)
    return sorted(values)


def load_cache() -> dict[str, str]:
    if not CACHE_PATH.is_file():
        return {}
    payload = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    values = payload.get("items", {})
    if not isinstance(values, dict):
        return {}
    return {
        video_id: value
        for video_id, value in values.items()
        if ID_RE.fullmatch(video_id)
        and isinstance(value, str)
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
    }


def fetch_upload_date(video_id: str, attempts: int = 3) -> str:
    request = Request(
        f"https://www.youtube.com/watch?v={video_id}",
        headers={
            "User-Agent": USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    last_error: Exception | None = None
    for attempt in range(attempts):
        try:
            with urlopen(request, timeout=30) as response:
                html = response.read()
            match = DATE_RE.search(html)
            if not match:
                raise ValueError("uploadDate/publishDate is absent from watch page")
            raw = json.loads(b'"' + match.group(1) + b'"')
            normalized = raw[:10]
            date.fromisoformat(normalized)
            return normalized
        except (HTTPError, URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(str(last_error) if last_error else "unknown request failure")


def write_cache(
    values: dict[str, str],
    expected_ids: list[str],
    failures: dict[str, str],
) -> None:
    ordered = {
        video_id: values[video_id]
        for video_id in expected_ids
        if video_id in values
    }
    atomic_json(
        CACHE_PATH,
        {
            "generatedAt": timestamp(),
            "source": "YouTube watch-page uploadDate metadata",
            "expectedItems": len(expected_ids),
            "resolvedItems": len(ordered),
            "failedItems": failures,
            "items": ordered,
        },
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    expected_ids = source_ids()
    values = {} if args.force else load_cache()
    pending = [video_id for video_id in expected_ids if video_id not in values]
    failures: dict[str, str] = {}
    completed = 0

    print(
        f"Upload dates: expected={len(expected_ids)} "
        f"cached={len(values)} pending={len(pending)}"
    )
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = {
            executor.submit(fetch_upload_date, video_id): video_id
            for video_id in pending
        }
        for future in as_completed(futures):
            video_id = futures[future]
            try:
                values[video_id] = future.result()
            except Exception as exc:
                failures[video_id] = str(exc)
            completed += 1
            if completed % 25 == 0 or completed == len(pending):
                write_cache(values, expected_ids, failures)
                print(
                    f"Processed {completed}/{len(pending)}; "
                    f"resolved={len(values)} failed={len(failures)}",
                    flush=True,
                )

    write_cache(values, expected_ids, failures)
    missing = [video_id for video_id in expected_ids if video_id not in values]
    print(
        f"Upload dates complete: resolved={len(values)}/{len(expected_ids)} "
        f"missing={len(missing)}"
    )
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
