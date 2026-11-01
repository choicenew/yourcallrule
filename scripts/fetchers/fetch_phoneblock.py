#!/usr/bin/env python3
"""
PhoneBlock.net 欧洲开源社区全量 Dump 库同步脚本

获取德国、奥地利、瑞士与欧洲全量骚扰黑号，
支持历史增量合并保留，导出保存至 EU/processed_phoneblock.csv
"""

import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd
import phonenumbers

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
EU_DIR = PROJECT_DIR / "EU"
OUT_CSV = EU_DIR / "processed_phoneblock.csv"

# PhoneBlock 全量 Dump 与 API 地址
PHONEBLOCK_DUMP_URL = "https://phoneblock.net/phoneblock/blocklist.txt"
PHONEBLOCK_API_URL = "https://phoneblock.net/phoneblock/api/blocklist?limit=100000"


def format_eu_phone(number):
    clean = "".join(c for c in str(number) if c.isdigit() or c == "+")
    if not clean.startswith("+"):
        clean = f"+{clean.lstrip('0')}"
    if len(clean) >= 8:
        return clean
    return None


def fetch_phoneblock():
    print("\n[开始同步 PhoneBlock.net 欧洲全量数据库...]")
    EU_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []

    # 1. 尝试抓取全量 Dump txt 库
    try:
        req = urllib.request.Request(PHONEBLOCK_DUMP_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=45) as resp:
            content = resp.read().decode("utf-8", "ignore")

        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            e164 = format_eu_phone(line)
            if e164:
                new_rows.append({
                    "id": e164,
                    "name": "PhoneBlock Europe Blocked",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": e164,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "phoneblock-eu"
                })
        print(f"  成功从 PhoneBlock Dump 库拉取 {len(new_rows):,} 条欧洲黑号")
    except Exception as e:
        print(f"  PhoneBlock Dump 库拉取提示: {e}")

    # 2. 尝试抓取 API 接口
    if not new_rows:
        try:
            req = urllib.request.Request(PHONEBLOCK_API_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            entries = data if isinstance(data, list) else data.get("numbers", data.get("blocklist", []))
            for item in entries:
                phone_raw = item.get("phoneNumber", item.get("number", "")) if isinstance(item, dict) else str(item)
                e164 = format_eu_phone(phone_raw)
                if e164:
                    new_rows.append({
                        "id": e164,
                        "name": "PhoneBlock Europe Blocked",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "spamlikely",
                        "isEnabled": 1,
                        "count": 1,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "phoneblock-eu"
                    })
            print(f"  成功从 PhoneBlock API 拉取 {len(new_rows):,} 条欧洲黑号")
        except Exception as e:
            print(f"  PhoneBlock API 拉取提示: {e}")

    new_df = pd.DataFrame(new_rows)
    if not existing_df.empty and not new_df.empty:
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
    elif not new_df.empty:
        combined_df = new_df
    else:
        combined_df = existing_df

    if not combined_df.empty:
        combined_df.drop_duplicates(subset=["phoneNumber"], inplace=True)
        combined_df.to_csv(OUT_CSV, index=False)
        print(f"  已成功历史增量保留并保存 {len(combined_df):,} 条 PhoneBlock 欧洲记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_phoneblock()
