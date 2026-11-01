#!/usr/bin/env python3
"""
ToastedSpam 北美每日自动拨号黑名单同步脚本

获取美国/加拿大每日社区维基更新的 Deny List，
导出归一化保存至 US/processed_toastedspam.csv
"""

import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
US_DIR = PROJECT_DIR / "US"
OUT_CSV = US_DIR / "processed_toastedspam.csv"
TOASTEDSPAM_URL = "http://www.toastedspam.com/deny"


def fetch_toastedspam():
    print("\n[开始同步 ToastedSpam 北美每日自动拨号黑名单数据...]")
    US_DIR.mkdir(parents=True, exist_ok=True)

    try:
        req = urllib.request.Request(TOASTEDSPAM_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8", "ignore")

        rows = []
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith(('#', ';', '//')):
                continue

            clean_digits = "".join(c for c in line if c.isdigit())
            if len(clean_digits) == 10:
                clean_digits = f"1{clean_digits}"
            if len(clean_digits) == 11 and clean_digits.startswith("1"):
                e164_phone = f"+{clean_digits}"
                rows.append({
                    "id": e164_phone,
                    "name": "Robocall / Spam (ToastedSpam)",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": e164_phone,
                    "labelId": "robocall",
                    "isEnabled": 1,
                    "count": 2,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "toastedspam-us"
                })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["phoneNumber"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(df):,} 条 ToastedSpam 北美记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步 ToastedSpam 北美黑名单失败: {e}")


if __name__ == "__main__":
    fetch_toastedspam()
