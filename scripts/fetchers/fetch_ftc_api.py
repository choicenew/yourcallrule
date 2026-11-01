#!/usr/bin/env python3
"""
美国 FTC Do Not Call 官方 API 增量/全量拉取脚本

通过 https://api.ftc.gov/v0/dnc-complaints API 接口分页轮询，
提取所有被投诉电话号码，导出归一化保存至 US/processed_ftc_api.csv
"""

import json
import os
import sys
import time
import urllib.request
from pathlib import Path
import pandas as pd
import phonenumbers

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
US_DIR = PROJECT_DIR / "US"
OUT_CSV = US_DIR / "processed_ftc_api.csv"

FTC_API_URL = "https://api.ftc.gov/v0/dnc-complaints"
FTC_API_KEY = os.environ.get("FTC_API_KEY", "DEMO_KEY")
PAGE_SIZE = 50
MAX_PAGES = 100  # 全量/增量分页上限


def format_us_phone(number):
    try:
        parsed = phonenumbers.parse(str(number), "US")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_ftc_api():
    print("\n[开始调用 FTC DNC 官方 API 分页拉取数据...]")
    US_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    offset = 0

    for page in range(MAX_PAGES):
        url = f"{FTC_API_URL}?api_key={FTC_API_KEY}&items_per_page={PAGE_SIZE}&offset={offset}&sort_order=desc"
        print(f"  查询 FTC API 页码 {page+1} (offset={offset})...")

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            records = data.get("data", [])
            if not isinstance(records, list) or not records:
                print("  FTC API 无更多数据，结束轮询")
                break

            for rec in records:
                attrs = rec.get("attributes", {}) or {}
                phone_raw = attrs.get("company-phone-number", "")
                subject = attrs.get("subject", "FTC Robocall") or "FTC Robocall"
                e164 = format_us_phone(phone_raw)

                if e164:
                    rows.append({
                        "id": e164,
                        "name": str(subject).strip() or "FTC Robocall",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "robocall",
                        "isEnabled": 1,
                        "count": 1,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "us-ftc-api"
                    })

            offset += len(records)
            if len(records) < PAGE_SIZE:
                break
            time.sleep(0.3)
        except Exception as e:
            print(f"  FTC API 请求提示/中断: {e}")
            break

    if rows:
        df = pd.DataFrame(rows)
        df.drop_duplicates(subset=["phoneNumber"], inplace=True)
        df.to_csv(OUT_CSV, index=False)
        print(f"  已保存 {len(df):,} 条 FTC API 记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_ftc_api()
