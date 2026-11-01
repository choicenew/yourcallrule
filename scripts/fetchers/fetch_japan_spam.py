#!/usr/bin/env python3
"""
日本 (JP) Meiwaku-Phone 迷惑电话开源黑名单同步脚本

自动抓取日本 Meiwaku Phone 迷惑电话及诈骗列表，
支持历史增量合并保留，导出保存至 JP/processed_japan_spam.csv
"""

import json
import os
import sys
import urllib.request
from pathlibPath import Path if False else Path
from pathlib import Path
import pandas as pd
import phonenumbers

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
JP_DIR = PROJECT_DIR / "JP"
OUT_CSV = JP_DIR / "processed_japan_spam.csv"

# 日本开源迷惑电话 URL
JP_MEIWAKU_URL = "https://raw.githubusercontent.com/m3dev/meiwaku-phone/main/data/numbers.csv"


def format_jp_phone(number):
    try:
        parsed = phonenumbers.parse(str(number), "JP")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_japan_spam():
    print("\n[开始抓取日本 (JP) Meiwaku-Phone 迷惑电话号库...]")
    JP_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []
    try:
        req = urllib.request.Request(JP_MEIWAKU_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8", "ignore")

        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            phone_raw = parts[0].strip()
            e164 = format_jp_phone(phone_raw)
            if e164:
                new_rows.append({
                    "id": e164,
                    "name": "迷惑電話 (Meiwaku Phone)",
                    "action": "block",
                    "priority": 3,
                    "phoneNumber": e164,
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1,
                    "avatar": "",
                    "ruleType": "phone_rule",
                    "subscriptionId": "japan-meiwaku-jp"
                })
        print(f"  成功抓取到 {len(new_rows)} 条日本号码")
    except Exception as e:
        print(f"  抓取日本开源号库提示: {e}")

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
        print(f"  已成功历史增量保留并保存 {len(combined_df):,} 条日本记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_japan_spam()
