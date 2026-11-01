#!/usr/bin/env python3
"""
Nomorobo 北美运营商蜜罐 (Carrier Honeypot & IRS Callback Scam) 黑号同步脚本

通过 NOMOROBO_IRS_FEED_URL 或运营商授信公开/预设 URL 拉取北美 35万组蜜罐传感器捕获的诈骗号，
导出归一化保存至 US/processed_nomorobo.csv
"""

import csv
import json
import os
import sys
import urllib.request
from pathlib import Path
import pandas as pd
import phonenumbers

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
US_DIR = PROJECT_DIR / "US"
OUT_CSV = US_DIR / "processed_nomorobo.csv"

# Nomorobo 北美运营商蜜罐 API / Feed 地址
NOMOROBO_FEED_URL = os.environ.get("NOMOROBO_IRS_FEED_URL", "").strip()
NOMOROBO_TOKEN = os.environ.get("NOMOROBO_IRS_TOKEN", "").strip()


def format_nanp_phone(number):
    try:
        parsed = phonenumbers.parse(str(number), "US")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_nomorobo():
    print("\n[开始同步 Nomorobo 北美运营商蜜罐 (35万 Sensors) 黑名单...]")
    US_DIR.mkdir(parents=True, exist_ok=True)

    rows = []

    # 尝试从 ref/data 本地快照或远程授权 Feed 获取
    local_ref_file = PROJECT_DIR / "ref" / "data" / "nomorobo_irs.csv"
    if local_ref_file.exists():
        try:
            df_local = pd.read_csv(local_ref_file, on_bad_lines="skip", dtype=str)
            for _, row in df_local.iterrows():
                phone_raw = row.get("phoneNumber", row.get("number", ""))
                e164 = format_nanp_phone(phone_raw)
                if e164:
                    rows.append({
                        "id": e164,
                        "name": "Nomorobo IRS/Carrier Scam",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "scamslikely",
                        "isEnabled": 1,
                        "count": 3,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "nomorobo-us-carrier"
                    })
            print(f"  读取本地 Nomorobo 运营商缓存数据 ({len(rows)} 条)")
        except Exception as e:
            print(f"  读取本地 Nomorobo 缓存提示: {e}")

    if NOMOROBO_FEED_URL and NOMOROBO_FEED_URL.startswith("https://"):
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            if NOMOROBO_TOKEN:
                headers["Authorization"] = f"Bearer {NOMOROBO_TOKEN}"
            req = urllib.request.Request(NOMOROBO_FEED_URL, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read().decode("utf-8", "ignore")

            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split(",")
                phone_raw = parts[0].strip()
                e164 = format_nanp_phone(phone_raw)
                if e164:
                    rows.append({
                        "id": e164,
                        "name": "Nomorobo Carrier Honeypot Scam",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "scamslikely",
                        "isEnabled": 1,
                        "count": 4,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "nomorobo-us-carrier"
                    })
            print(f"  从 Nomorobo 运营商 Feed 成功拉取 ({len(rows)} 条)")
        except Exception as e:
            print(f"  拉取远程 Nomorobo Feed 提示: {e}")

    if rows:
        df = pd.DataFrame(rows)
        df.drop_duplicates(subset=["phoneNumber"], inplace=True)
        df.to_csv(OUT_CSV, index=False)
        print(f"  已保存 {len(df):,} 条 Nomorobo 北美运营商记录到 {OUT_CSV}")
    else:
        print("  未配置 NOMOROBO_IRS_FEED_URL 环境变量，且无本地缓存，跳过生成空文件")


if __name__ == "__main__":
    fetch_nomorobo()
