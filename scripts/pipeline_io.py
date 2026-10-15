#!/usr/bin/env python3
"""Shared I/O helpers for the data pipeline."""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any


class FeedCollapseError(RuntimeError):
    """Raised when a derived feed would overwrite healthy data with a collapse."""


def atomic_write_json(path: Path, payload: Any, indent: int = 2) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, indent=indent)
    with open(tmp, encoding="utf-8") as f:
        json.load(f)
    os.replace(tmp, path)


def report_queue_digest(reports_dir: Path) -> str:
    digest = hashlib.sha256()
    reports_dir = Path(reports_dir)
    if not reports_dir.exists():
        return digest.hexdigest()
    for report_file in sorted(reports_dir.glob("*.json")):
        digest.update(report_file.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(report_file.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _payload_count(payload: Any, item_key: str) -> int:
    if not isinstance(payload, dict):
        raise FeedCollapseError("feed payload must be a JSON object")
    items = payload.get(item_key)
    if isinstance(items, list):
        return len(items)
    count = payload.get("count")
    if isinstance(count, int) and count >= 0:
        return count
    raise FeedCollapseError(f"feed payload has no countable {item_key!r} field")


def ensure_feed_not_collapsed(
    path: Path,
    payload: Any,
    *,
    item_key: str,
    absolute_floor: int,
    previous_ratio: float,
    allow_collapse: bool,
) -> None:
    if allow_collapse:
        return
    current_count = _payload_count(payload, item_key)
    path = Path(path)
    previous_count = 0
    if path.exists():
        try:
            with path.open(encoding="utf-8") as existing_file:
                previous_count = _payload_count(json.load(existing_file), item_key)
        except (OSError, ValueError, FeedCollapseError) as error:
            raise FeedCollapseError(f"cannot safely replace unreadable feed {path}: {error}") from error

    relative_floor = math.ceil(previous_count * previous_ratio)
    floor = max(absolute_floor, relative_floor)
    if current_count < floor:
        raise FeedCollapseError(
            f"refusing to collapse {path}: {current_count} {item_key} would replace "
            f"{previous_count}; minimum is {floor}. Re-run with --allow-collapse "
            "only after verifying the drop is real; an empty feed also needs its "
            "name in --cleared."
        )


def published_clear_flag(path: Path, payload: Any, *, item_key: str, approved: bool) -> bool:
    if _payload_count(payload, item_key) > 0:
        return False
    if approved:
        return True
    path = Path(path)
    try:
        with path.open(encoding="utf-8") as existing_file:
            previous = json.load(existing_file)
        if isinstance(previous, dict) and previous.get("cleared") is True and _payload_count(previous, item_key) == 0:
            return True
    except (OSError, ValueError, FeedCollapseError):
        pass
    raise FeedCollapseError(
        f"refusing to publish {path.name} empty without cleared=true"
    )


def parse_cleared_feeds(value: str | None, *, known: frozenset[str]) -> frozenset[str]:
    if not value:
        return frozenset()
    named = frozenset(part.strip() for part in value.split(",") if part.strip())
    unknown = named - known
    if unknown:
        raise ValueError(
            f"unknown feed name(s) in --cleared: {', '.join(sorted(unknown))}."
        )
    return named


def require_matching_derived_feed(
    path: Path,
    *,
    report_digest: str,
) -> None:
    path = Path(path)
    try:
        with path.open(encoding="utf-8") as feed_file:
            payload = json.load(feed_file)
    except (OSError, ValueError) as error:
        raise RuntimeError(f"derived feed {path} is missing or unreadable: {error}") from error
    if not isinstance(payload, dict) or payload.get("input_report_digest") != report_digest:
        raise RuntimeError(
            f"derived feed {path} does not match the current report queue"
        )
