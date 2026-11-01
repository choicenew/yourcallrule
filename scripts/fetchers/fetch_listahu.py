#!/usr/bin/env python3
"""
Lista Hũ 巴拉圭官方与社区防诈 API 同步脚本

通过 Lista Hũ 开放 API 接口获取巴拉圭黑名单，
导出归一化保存至 PY/processed_listahu.csv
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
PY_DIR = PROJECT_DIR / "PY"
OUT_CSV = PY_DIR / "processed_listahu.csv"
LISTAHU_API_URL = "https://listahu.org/api/v1/lista/?added_from=2025-01-01"


def fetch_listahu():
    print("\n[开始同步 Lista Hũ 巴拉圭黑名单 API 数据...]")
    PY_DIR.mkdir(parents=True, exist_ok=True)

    try:
        req = urllib.request.Request(LISTAHU_API_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        entries = []
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict):
            entries = data.get("results", data.get("data", data.get("lista", [])))

        rows = []
        for item in entries:
            if isinstance(item, dict):
                phone = str(item.get("numero", item.get("phoneNumber", item.get("phone", "")))).strip()
                category = str(item.get("categoria", item.get("description", "Spam Call"))).strip()
            else:
                phone = str(item).strip()
                category = "Spam Call"

            if phone:
                rows.append({
                    "id": phone,
                    "name": category or "Spam Call (Paraguay)",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": phone,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "listahu-py"
                })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["phoneNumber"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(df):,} 条 Lista Hũ 巴拉圭记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步 Lista Hũ 巴拉圭 API 失败: {e}")


if __name__ == "__main__":
    fetch_listahu()
