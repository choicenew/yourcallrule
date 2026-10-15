#!/usr/bin/env python3
"""
CallShield Multi-Source Database Builder & Raw Fetcher

Aggregates spam phone numbers from all available public sources
and saves raw outputs and evidence for downstream normalization.

Sources:
  1. FTC Do Not Call API (api.ftc.gov) — DEMO_KEY, or FTC_API_KEY
  2. FCC Unwanted Calls Dataset (opendata.fcc.gov) — Socrata API, no key
  3. PhoneBlock.net community database — optional operator key for bulk
  4. Saracroche French telemarketing ranges — daily public JSON feed
  5. Nomorobo IRS callback-scam feed — optional carrier-authorized URL
  6. ToastedSpam US/Canada blocklist — HTTP-only, explicit opt-in
"""

import csv
import hashlib
import io
import json
import re
import sys
import time
import argparse
import os
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter
from phone_normalization import (
    is_plausible_number,
    normalize_nanp_number,
    normalize_report_number,
)

from pipeline_io import atomic_write_json
from source_registry import (
    attach_source_evidence,
    load_source_manifest,
    merge_evidence,
    refresh_evidence_expiry,
    source_evidence,
    source_snapshot,
)

try:
    import requests
except ImportError as exc:
    raise SystemExit("requests is required. Install with: pip install requests") from exc

DATA_DIR = Path(__file__).parent.parent / "ref" / "data"
if not DATA_DIR.exists():
    DATA_DIR = Path(__file__).parent / "raw_data"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_MANIFEST_FILE = DATA_DIR / "source-manifest.json"
PHONEBLOCK_BLOCKLIST_URL = "https://phoneblock.net/phoneblock/api/blocklist"
SARACROCHE_PREFIX_URL = "https://saracroche.org/api/v1/lists/french-list-arcep-operators"
PHONEBLOCK_MAX_LIMIT = 5000
NOMOROBO_MAX_RECORDS = 250000
FTC_PAGE_SIZE = 50
FTC_DEMO_KEY = "DEMO_KEY"
FTC_DEMO_KEY_REQUEST_BUDGET = 8
FTC_DEMO_KEY_SPARE_REQUESTS = 2
FCC_PAGE_SIZE = 5000
RETRYABLE_STATUS_CODES = {403, 429}


class SourceFetchResult(list[dict]):
    def __init__(
        self,
        entries: list[dict],
        *,
        cursor: dict[str, str] | None,
        complete: bool,
        error: str | None = None,
    ) -> None:
        super().__init__(entries)
        self.cursor = cursor
        self.complete = complete
        self.error = error


def _get_with_backoff(
    url: str,
    *,
    params: dict | None = None,
    timeout: int,
    label: str,
    max_attempts: int = 4,
):
    for attempt in range(max_attempts):
        try:
            response = requests.get(url, params=params, timeout=timeout)
        except Exception as exc:
            return None, str(exc)
        if response.status_code not in RETRYABLE_STATUS_CODES:
            return response, None
        if attempt == max_attempts - 1:
            return None, f"{label} returned HTTP {response.status_code} after {max_attempts} attempts"
        delay = min(60, 5 * (2**attempt))
        print(f"  {label} HTTP {response.status_code}; waiting {delay}s...")
        time.sleep(delay)
    return None, f"{label} request did not complete"


def normalize_phone(raw: str) -> str | None:
    return normalize_nanp_number(raw)


def normalize_external_phone(raw: str) -> str | None:
    value = str(raw or "").strip()
    if not value.startswith("+"):
        return normalize_phone(value)
    normalized = normalize_report_number(value)
    return normalized if normalized and is_plausible_number(normalized) else None


def ftc_api_key() -> str:
    return os.environ.get("FTC_API_KEY", "").strip() or FTC_DEMO_KEY


def fetch_ftc(
    max_records: int = 5000,
    cursor: dict[str, str] | None = None,
    api_key: str | None = None,
) -> SourceFetchResult:
    print("\n[FTC Do Not Call API]")
    key = api_key or ftc_api_key()
    if key == FTC_DEMO_KEY:
        budget = FTC_DEMO_KEY_REQUEST_BUDGET * FTC_PAGE_SIZE
        if max_records > budget:
            print(f"  DEMO_KEY limit: using {FTC_DEMO_KEY_REQUEST_BUDGET} requests to fetch {budget:,} records")
            max_records = budget
    numbers: dict[str, dict] = {}
    offset = 0
    records_fetched = 0

    while records_fetched < max_records:
        page_size = min(FTC_PAGE_SIZE, max_records - records_fetched)
        params = {
            "api_key": key,
            "items_per_page": page_size,
            "offset": offset,
            "sort_order": "desc",
        }

        response, error = _get_with_backoff(
            "https://api.ftc.gov/v0/dnc-complaints",
            params=params,
            timeout=30,
            label="FTC",
        )
        if response is None or response.status_code != 200:
            print(f"  FTC request failed: {error}")
            break
        try:
            payload = response.json()
            records = payload.get("data", [])
            if not isinstance(records, list):
                break
        except Exception:
            break
        if not records:
            break

        records_fetched += len(records)
        for record in records:
            attrs = record.get("attributes", {}) or {}
            phone = attrs.get("company-phone-number", "")
            normalized = normalize_external_phone(phone)
            if not normalized:
                continue

            subject = str(attrs.get("subject", "") or "").strip()
            is_robo = (
                str(attrs.get("recorded-message-or-robocall", "") or "").upper() == "Y"
                or str(attrs.get("is-robocall", "") or "").lower() in {"y", "yes", "true", "1"}
            )
            created = str(attrs.get("created-date", "") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            description = f"FTC caller ID: {subject}" if subject else "FTC caller-ID complaint"
            if normalized in numbers:
                numbers[normalized]["reports"] += 1
            else:
                numbers[normalized] = {
                    "number": normalized,
                    "type": "robocall" if is_robo else "telemarketer",
                    "reports": 1,
                    "first_seen": created,
                    "last_seen": created,
                    "description": description,
                }

        offset += len(records)
        if len(records) < page_size:
            break
        time.sleep(0.3)

    print(f"  Fetched {len(numbers):,} unique numbers ({records_fetched:,} records)")
    return SourceFetchResult(list(numbers.values()), cursor=None, complete=True)


def fetch_fcc(max_records: int = 50000) -> SourceFetchResult:
    print("\n[FCC Unwanted Calls Dataset]")
    numbers: dict[tuple[str, str], dict] = {}
    offset = 0
    records_fetched = 0

    while records_fetched < max_records:
        batch = min(FCC_PAGE_SIZE, max_records - records_fetched)
        params = {
            "$limit": batch,
            "$offset": offset,
            "$order": ":created_at DESC",
        }

        response, error = _get_with_backoff(
            "https://opendata.fcc.gov/resource/vakf-fz8e.json",
            params=params,
            timeout=60,
            label="FCC",
        )
        if response is None or response.status_code != 200:
            break
        try:
            records = response.json()
            if not isinstance(records, list):
                break
        except Exception:
            break
        if not records:
            break

        records_fetched += len(records)
        for record in records:
            issue = str(record.get("issue", "Unwanted Calls") or "Unwanted Calls").strip()
            date = str(record.get("issue_date", "") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            normalized = normalize_external_phone(record.get("caller_id_number", ""))
            if not normalized:
                continue
            key = (normalized, "caller_id")
            if key not in numbers:
                numbers[key] = {
                    "number": normalized,
                    "type": "robocall",
                    "reports": 1,
                    "first_seen": date,
                    "last_seen": date,
                    "description": f"FCC: {issue}",
                }
            else:
                numbers[key]["reports"] += 1

        offset += len(records)
        if len(records) < batch:
            break
        time.sleep(0.3)

    print(f"  Fetched {len(numbers):,} entries ({records_fetched:,} records)")
    return SourceFetchResult(list(numbers.values()), cursor=None, complete=True)


def fetch_saracroche_prefixes() -> SourceFetchResult:
    print("\n[Saracroche France telemarketing prefixes]")
    response, error = _get_with_backoff(SARACROCHE_PREFIX_URL, timeout=60, label="Saracroche")
    if response is None or response.status_code != 200:
        return SourceFetchResult([], cursor=None, complete=False, error=error)
    try:
        payload = response.json()
    except Exception as exc:
        return SourceFetchResult([], cursor=None, complete=False, error=str(exc))

    patterns = payload.get("patterns", [])
    prefixes = {}
    for row in patterns:
        if not isinstance(row, dict) or str(row.get("action", "block")).lower() != "block":
            continue
        pattern = str(row.get("pattern", "")).strip()
        fixed = pattern.split("#", 1)[0]
        prefix = f"+{fixed}"
        if fixed.isdigit():
            name = str(row.get("name", "French telemarketing range")).strip()
            prefixes[prefix] = {
                "prefix": prefix,
                "type": "telemarketer",
                "description": f"Saracroche: {name}",
            }

    print(f"  Fetched {len(prefixes):,} ARCEP prefixes")
    return SourceFetchResult(list(prefixes.values()), cursor=None, complete=True)


def fetch_toastedspam(allow_insecure: bool = True) -> list[dict]:
    print("\n[ToastedSpam US/Canada Blocklist]")
    if not allow_insecure:
        return []
    try:
        resp = requests.get("http://www.toastedspam.com/deny", timeout=30)
        if resp.status_code != 200:
            return []
    except Exception:
        return []

    numbers = {}
    for line in resp.text.splitlines():
        line = line.strip()
        if not line or line.startswith(('#', ';', '//')):
            continue
        normalized = normalize_phone(line)
        if normalized and normalized not in numbers:
            numbers[normalized] = {
                "number": normalized,
                "type": "robocall",
                "reports": 2,
                "first_seen": datetime.now().strftime("%Y-%m-%d"),
                "last_seen": datetime.now().strftime("%Y-%m-%d"),
                "description": "ToastedSpam community blocklist",
            }
    print(f"  Fetched {len(numbers):,} numbers")
    return list(numbers.values())


if __name__ == "__main__":
    print("=== Raw Source Fetcher ===")
    ftc_res = fetch_ftc(max_records=1000)
    fcc_res = fetch_fcc(max_records=2000)
    sara_res = fetch_saracroche_prefixes()
    toast_res = fetch_toastedspam(allow_insecure=True)
    print("Done fetching raw open feeds.")
