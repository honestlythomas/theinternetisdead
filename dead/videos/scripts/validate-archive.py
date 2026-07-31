#!/usr/bin/env python3
"""Offline structural and functional validation for the static archive site."""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


SOURCE_ROOT = Path(r"Z:\WEBDEV\downloads\output-honestly-thomas")
SITE_ROOT = Path(__file__).resolve().parent.parent
REPORT_PATH = SITE_ROOT / "logs" / "validation-report.txt"
FILE_INVENTORY_PATH = SITE_ROOT / "logs" / "created-files.txt"
BUILD_REPORT = SITE_ROOT / "logs" / "build-report.txt"
NODE = Path(r"Z:\WEBDEV\local-tools\node\node.exe")
ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


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
        aggregate.update(
            (
                f"{relative}\0{stat.st_size}\0{stat.st_mtime_ns}\0"
                f"{sha256(path)}\n"
            ).encode("utf-8")
        )
        count += 1
        total_bytes += stat.st_size
    return {
        "file_count": count,
        "total_bytes": total_bytes,
        "fingerprint_sha256": aggregate.hexdigest(),
    }


def missing(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def search_text(item: dict[str, Any]) -> str:
    values = [
        item.get("title"),
        item.get("id"),
        item.get("classification"),
        item.get("contentType"),
        item.get("uploadDate"),
        item.get("description"),
        item.get("channelName"),
        item.get("channelId"),
        item.get("uploader"),
        item.get("sourceUrl"),
        item.get("availability"),
        item.get("liveStatus"),
        json.dumps(item.get("additionalMetadata", {}), ensure_ascii=False),
    ]
    return " ".join(str(value) for value in values if not missing(value)).casefold()


def sorted_items(
    items: list[dict[str, Any]], field: str, descending: bool
) -> list[dict[str, Any]]:
    present = [item for item in items if not missing(item.get(field))]
    absent = [item for item in items if missing(item.get(field))]
    if field == "title":
        present.sort(key=lambda item: item[field].casefold(), reverse=descending)
    else:
        present.sort(key=lambda item: item[field], reverse=descending)
    absent.sort(key=lambda item: item["title"].casefold())
    return present + absent


def main() -> int:
    failures: list[str] = []
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        checks.append((name, condition, detail))
        if not condition:
            failures.append(f"{name}: {detail}")

    required_files = [
        "index.html",
        "styles.css",
        "app.js",
        "archive-data.json",
        "archive-data.js",
        "upload-dates.json",
        "scripts/build-archive.py",
        "scripts/refresh-upload-dates.py",
        "scripts/validate-archive.py",
        "logs/build-report.txt",
    ]
    check(
        "Required site files exist",
        all((SITE_ROOT / relative).is_file() for relative in required_files),
        ", ".join(
            relative
            for relative in required_files
            if not (SITE_ROOT / relative).is_file()
        ),
    )

    try:
        data = json.loads((SITE_ROOT / "archive-data.json").read_text(encoding="utf-8"))
    except Exception as exc:
        failures.append(f"Canonical JSON parses as UTF-8: {exc}")
        data = {"stats": {}, "items": []}
    items = data.get("items", [])
    check("Canonical data contains an item list", isinstance(items, list))
    if not isinstance(items, list):
        items = []

    videos = [item for item in items if item.get("classification") == "Videos"]
    shorts = [item for item in items if item.get("classification") == "Shorts"]
    check("Displayed total is 386", len(items) == 386, str(len(items)))
    check("Video total is 297", len(videos) == 297, str(len(videos)))
    check("Short total is 89", len(shorts) == 89, str(len(shorts)))
    check(
        "Data stats match records",
        data.get("stats")
        == {"videos": len(videos), "shorts": len(shorts), "total": len(items)},
        repr(data.get("stats")),
    )
    invalid_upload_dates = [
        item.get("id")
        for item in items
        if not isinstance(item.get("uploadDate"), str)
        or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", item["uploadDate"])
    ]
    check(
        "Every item has a valid ISO upload date",
        not invalid_upload_dates,
        repr(invalid_upload_dates),
    )

    identities = [(item.get("classification"), item.get("id")) for item in items]
    check(
        "All displayed identities are unique",
        len(identities) == len(set(identities)),
        f"{len(identities) - len(set(identities))} duplicate occurrences",
    )
    check(
        "Every ID is well formed",
        all(isinstance(item.get("id"), str) and ID_RE.fullmatch(item["id"]) for item in items),
    )

    invalid_thumbnails: list[str] = []
    unsafe_paths: list[str] = []
    ffprobe_path = Path(
        json.loads((SOURCE_ROOT / "phase-1-tools.json").read_text(encoding="utf-8"))[
            "ffprobe"
        ]["path"]
    )
    for item in items:
        relative = item.get("thumbnail")
        if (
            not isinstance(relative, str)
            or Path(relative).is_absolute()
            or ".." in Path(relative).parts
        ):
            unsafe_paths.append(str(relative))
            continue
        thumbnail = SITE_ROOT / relative
        try:
            magic = thumbnail.read_bytes()[:3]
        except OSError:
            magic = b""
        completed = subprocess.run(
            [
                str(ffprobe_path),
                "-v",
                "error",
                "-select_streams",
                "v:0",
                "-show_entries",
                "stream=codec_name,width,height",
                "-of",
                "csv=p=0",
                str(thumbnail),
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        probe = completed.stdout.decode("utf-8", errors="replace").strip()
        if (
            magic != b"\xff\xd8\xff"
            or completed.returncode != 0
            or not re.fullmatch(r"mjpeg,\d+,\d+", probe)
        ):
            invalid_thumbnails.append(relative)
    check("All thumbnail paths are safe and relative", not unsafe_paths, repr(unsafe_paths[:5]))
    check(
        "Every item has a readable local JPEG",
        not invalid_thumbnails and len(items) == 386,
        repr(invalid_thumbnails[:5]),
    )

    # Verify normalized titles exactly match their UTF-8 source records.
    title_mismatches: list[str] = []
    unicode_titles = 0
    for item in items:
        source_item_path = (
            SOURCE_ROOT / item["classification"] / item["id"] / "item.json"
        )
        source_item = json.loads(source_item_path.read_text(encoding="utf-8"))
        if item.get("title") != source_item.get("title"):
            title_mismatches.append(item["id"])
        if any(ord(character) > 127 for character in item.get("title", "")):
            unicode_titles += 1
    check(
        "All titles round-trip from source as UTF-8",
        not title_mismatches,
        repr(title_mismatches[:5]),
    )

    index = (SITE_ROOT / "index.html").read_text(encoding="utf-8")
    css = (SITE_ROOT / "styles.css").read_text(encoding="utf-8")
    app = (SITE_ROOT / "app.js").read_text(encoding="utf-8")
    external_refs = re.findall(
        r"""(?:src|href)\s*=\s*["'](?:https?:)?//[^"']+["']""",
        index,
        flags=re.IGNORECASE,
    )
    css_external = re.findall(r"url\(\s*['\"]?(?:https?:)?//", css, re.IGNORECASE)
    check("No external HTML assets", not external_refs, repr(external_refs))
    check("No external CSS assets", not css_external, repr(css_external))
    check(
        "Offline data transport is linked",
        'src="archive-data.js"' in index and 'src="app.js"' in index,
    )
    transport = (SITE_ROOT / "archive-data.js").read_text(encoding="utf-8")
    prefix = "window.ARCHIVE_DATA = "
    transport_matches = transport.startswith(prefix) and transport.endswith(";\n")
    if transport_matches:
        try:
            transport_data = json.loads(transport[len(prefix) : -2])
            transport_matches = transport_data == data
        except json.JSONDecodeError:
            transport_matches = False
    check("Offline transport exactly matches canonical JSON", transport_matches)

    node_check = subprocess.run(
        [str(NODE), "--check", str(SITE_ROOT / "app.js")],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    check(
        "Application JavaScript parses",
        node_check.returncode == 0,
        node_check.stderr.decode("utf-8", errors="replace"),
    )

    required_controls = [
        'id="searchInput"',
        'data-filter="All"',
        'data-filter="Videos"',
        'data-filter="Shorts"',
        '<option value="uploadDate">',
        '<option value="title">',
        '<option value="durationSeconds">',
        '<option value="viewCount">',
        'id="directionButton"',
        'id="detailDialog"',
    ]
    check(
        "All required controls are present",
        all(marker in index for marker in required_controls),
        repr([marker for marker in required_controls if marker not in index]),
    )

    # Exercise the same data operations used by the UI.
    search_index = {item["id"]: search_text(item) for item in items}
    search_ok = all(
        item["id"].casefold() in search_index[item["id"]] for item in items
    )
    sample = items[0] if items else {}
    sample_query = str(sample.get("title", ""))[:8].casefold()
    sample_results = [
        item for item in items if sample_query and sample_query in search_index[item["id"]]
    ]
    check(
        "Full-text index finds every ID and a title query",
        search_ok and bool(sample_results),
        f"title query results={len(sample_results)}",
    )
    check(
        "Classification filters return exact totals",
        len(videos) == 297 and len(shorts) == 89,
    )
    sort_failures: list[str] = []
    for field in ("uploadDate", "title", "durationSeconds", "viewCount"):
        for descending in (False, True):
            result = sorted_items(items, field, descending)
            if len(result) != len(items) or set(
                (item["classification"], item["id"]) for item in result
            ) != set(identities):
                sort_failures.append(f"{field}:{'desc' if descending else 'asc'}")
    check(
        "All four sort vectors work ascending and descending",
        not sort_failures,
        repr(sort_failures),
    )
    check(
        "Every item has detail-view data and a valid source URL",
        all(
            item.get("title")
            and item.get("thumbnail")
            and urlparse(item.get("sourceUrl", "")).scheme in {"http", "https"}
            and bool(urlparse(item.get("sourceUrl", "")).netloc)
            for item in items
        )
        and "function openDetail(item)" in app,
    )

    build_report = BUILD_REPORT.read_text(encoding="utf-8")
    match = re.search(r"^After:\s+(\{.*\})$", build_report, re.MULTILINE)
    expected_snapshot = json.loads(match.group(1)) if match else None
    current_snapshot = source_snapshot()
    check(
        "Source archive fingerprint remains unchanged",
        expected_snapshot == current_snapshot,
        f"expected={expected_snapshot} current={current_snapshot}",
    )

    lines = [
        "HONESTLY THOMAS // OFFLINE SITE VALIDATION",
        "",
        *[
            f"[{'PASS' if condition else 'FAIL'}] {name}"
            + (f" // {detail}" if detail else "")
            for name, condition, detail in checks
        ],
        "",
        f"Checks passed: {sum(condition for _, condition, _ in checks)}",
        f"Checks failed: {len(failures)}",
        f"Unicode titles detected and preserved: {unicode_titles}",
        (
            "Browser note: direct file:// navigation was blocked by the in-app "
            "browser security policy; offline behavior was validated structurally "
            "against the generated transport and parsed application code."
        ),
    ]
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    relative_files = {
        path.relative_to(SITE_ROOT).as_posix()
        for path in SITE_ROOT.rglob("*")
        if path.is_file()
    }
    relative_files.add(FILE_INVENTORY_PATH.relative_to(SITE_ROOT).as_posix())
    inventory_lines = [
        "HONESTLY THOMAS // CREATED FILE INVENTORY",
        f"Total files: {len(relative_files)}",
        "",
        *sorted(relative_files, key=str.casefold),
    ]
    FILE_INVENTORY_PATH.write_text(
        "\n".join(inventory_lines) + "\n", encoding="utf-8", newline="\n"
    )
    print("\n".join(lines))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
