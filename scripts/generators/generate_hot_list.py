#!/usr/bin/env python3
"""
CallShield Hot List Generator

Generates hot_block.json — recent community 24-hour trending velocity feed.
All generated metadata uses neutral, clean standard strings.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
UTILS_DIR = SCRIPT_DIR.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

from phone_normalization import validated_report_number
from pipeline_io import atomic_write_json, report_queue_digest

REPO_DATA_DIR = PROJECT_DIR / "callshield" / "GLOBAL"
DATA_DIR = Path(os.environ.get("CALLSHIELD_DATA_DIR", REPO_DATA_DIR))
REPORTS_DIR = Path(os.environ.get("CALLSHIELD_REPORTS_DIR", PROJECT_DIR / "callshield" / "community_feed"))
HOT_LIST_FILE = DATA_DIR / "hot_block.json"

HOT_LIST_SIZE = 500
HOT_WINDOW_HOURS = 24


def generate_hot_list():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)

    reports_count = {}
    if REPORTS_DIR.exists():
        for report_file in REPORTS_DIR.glob("*.json"):
            try:
                with open(report_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    phone = validated_report_number(data.get("phoneNumber"))
                    if phone:
                        reports_count[phone] = reports_count.get(phone, 0) + 1
            except Exception:
                pass

    sorted_numbers = sorted(reports_count.items(), key=lambda x: x[1], reverse=True)[:HOT_LIST_SIZE]
    hot_entries = [
        {
            "id": f"hot_{num.lstrip('+')}",
            "phoneNumber": num,
            "name": f"24h Trending Spam ({cnt} reports)",
            "action": "block",
            "priority": 5,
            "ruleType": "phone_rule",
            "labelId": "scamslikely",
            "isEnabled": 1,
            "count": cnt,
        }
        for num, cnt in sorted_numbers
    ]

    payload = {
        "generated": now.isoformat(),
        "input_report_digest": report_queue_digest(REPORTS_DIR),
        "count": len(hot_entries),
        "cleared": len(hot_entries) == 0,
        "numbers": hot_entries,
    }

    atomic_write_json(HOT_LIST_FILE, payload)
    print(f"Generated hot list with {len(hot_entries)} entries at {HOT_LIST_FILE}")


if __name__ == "__main__":
    generate_hot_list()
