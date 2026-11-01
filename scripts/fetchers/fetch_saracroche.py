#!/usr/bin/env python3
"""
Saracroche 法国运营商电销号段 API 拉取脚本

通过 https://saracroche.org/api/v1/lists/french-list-arcep-operators 接口，
提取法国官方与运营商电销号段前缀，导出保存至 FR/processed_saracroche.csv
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
FR_DIR = PROJECT_DIR / "FR"
OUT_CSV = FR_DIR / "processed_saracroche.csv"
SARACROCHE_API_URL = "https://saracroche.org/api/v1/lists/french-list-arcep-operators"


def fetch_saracroche():
    print("\n[开始调用 Saracroche 法国 ARCEP 运营商 API...]")
    FR_DIR.mkdir(parents=True, exist_ok=True)

    try:
        req = urllib.request.Request(SARACROCHE_API_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        patterns = data.get("patterns", [])
        rows = []
        for row in patterns:
            if isinstance(row, dict) and str(row.get("action", "block")).lower() == "block":
                pattern = str(row.get("pattern", "")).strip()
                fixed = pattern.split("#", 1)[0]
                name = str(row.get("name", "French Telemarketing")).strip()
                if fixed.isdigit():
                    regex_pattern = f"^\\+?{fixed}\\d*$"
                    rows.append({
                        "id": regex_pattern,
                        "name": f"Saracroche: {name}",
                        "action": "block",
                        "priority": 5,
                        "pattern": regex_pattern,
                        "isEnabled": 1,
                        "subscriptionId": "saracroche-fr-regex",
                        "ruleType": "regex"
                    })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["pattern"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(rows):,} 条 Saracroche 法国正则记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  调用 Saracroche API 提示: {e}")


if __name__ == "__main__":
    fetch_saracroche()
