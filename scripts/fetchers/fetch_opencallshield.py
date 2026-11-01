#!/usr/bin/env python3
"""
OpenCallShield 哥伦比亚与南美社区黑名单同步脚本

从 OpenCallShield 官方 GitHub 仓库下载 spam_numbers.json，
导出归一化保存至 CO/processed_opencallshield.csv
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
CO_DIR = PROJECT_DIR / "CO"
OUT_CSV = CO_DIR / "processed_opencallshield.csv"
OPENCALLSHIELD_URL = "https://raw.githubusercontent.com/jhonsu01/OpenCallShield/main/spam_numbers.json"


def fetch_opencallshield():
    print("\n[开始同步 OpenCallShield 哥伦比亚与南美黑名单数据...]")
    CO_DIR.mkdir(parents=True, exist_ok=True)

    try:
        req = urllib.request.Request(OPENCALLSHIELD_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        entries = []
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict):
            entries = data.get("numbers", data.get("spam_numbers", []))

        rows = []
        for item in entries:
            if isinstance(item, dict):
                phone = str(item.get("phoneNumber", item.get("number", ""))).strip()
                name = str(item.get("name", item.get("category", "Spam Call"))).strip()
            else:
                phone = str(item).strip()
                name = "Spam Call"

            if phone:
                rows.append({
                    "id": phone,
                    "name": name or "Spam Call",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": phone,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "opencallshield-co"
                })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["phoneNumber"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(df):,} 条 OpenCallShield 记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步 OpenCallShield 失败: {e}")


if __name__ == "__main__":
    fetch_opencallshield()
