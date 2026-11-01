#!/usr/bin/env python3
"""
PhoneBlock.net 欧洲开源社区 Bulk API 同步脚本

获取欧洲 (DE/AT/CH/EU) 高频骚扰号，
导出归一化保存至 EU/processed_phoneblock.csv
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
EU_DIR = PROJECT_DIR / "EU"
OUT_CSV = EU_DIR / "processed_phoneblock.csv"
PHONEBLOCK_URL = "https://phoneblock.net/phoneblock/api/blocklist"


def fetch_phoneblock():
    print("\n[开始同步 PhoneBlock.net 欧洲开源社区黑名单 API 数据...]")
    EU_DIR.mkdir(parents=True, exist_ok=True)

    try:
        req = urllib.request.Request(PHONEBLOCK_URL, headers={"User-Agent": "YourCallRule/1.0"})
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        entries = []
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict):
            entries = data.get("numbers", data.get("blocklist", []))

        rows = []
        for item in entries:
            if isinstance(item, dict):
                phone = str(item.get("phoneNumber", item.get("number", item.get("phone", "")))).strip()
                name = str(item.get("comment", item.get("rating", "European Spam Call"))).strip()
            else:
                phone = str(item).strip()
                name = "European Spam Call"

            if phone:
                rows.append({
                    "id": phone,
                    "name": name or "European Spam Call",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": phone,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "phoneblock-eu"
                })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["phoneNumber"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(df):,} 条 PhoneBlock.net 欧洲记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步 PhoneBlock.net 欧洲 API 失败: {e}")


if __name__ == "__main__":
    fetch_phoneblock()
