#!/usr/bin/env python3
"""
香港 (HK) HKJunkCall 社区开源黑名单同步脚本

自动抓取香港 HKJunkCall 开放骚扰电话列表，
支持历史增量合并保留，导出保存至 HK/processed_hk_junkcall.csv
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
HK_DIR = PROJECT_DIR / "HK"
OUT_CSV = HK_DIR / "processed_hk_junkcall.csv"

# 香港开源骚扰号列表 URL
HK_JUNKCALL_URL = "https://raw.githubusercontent.com/hkjunkcall/hkjunkcall-database/main/junkcall.csv"


def format_hk_phone(number):
    try:
        parsed = phonenumbers.parse(str(number), "HK")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_hk_junkcall():
    print("\n[开始抓取香港 (HK) JunkCall 开源号库...]")
    HK_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []
    try:
        req = urllib.request.Request(HK_JUNKCALL_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8", "ignore")

        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            phone_raw = parts[0].strip()
            e164 = format_hk_phone(phone_raw)
            if e164:
                new_rows.append({
                    "id": e164,
                    "name": "HKJunkCall 騷擾電話",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": e164,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "hkjunkcall-hk"
                })
        print(f"  成功抓取到 {len(new_rows)} 条香港号码")
    except Exception as e:
        print(f"  抓取香港开源号库提示: {e}")

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
        print(f"  已成功历史增量保留并保存 {len(combined_df):,} 条香港记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_hk_junkcall()
