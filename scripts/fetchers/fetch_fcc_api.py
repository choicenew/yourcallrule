#!/usr/bin/env python3
"""
美国 FCC Unwanted Calls 官方 Socrata 开放 API 拉取脚本

通过 https://opendata.fcc.gov/resource/vakf-fz8e.json API 接口分页轮询，
提取所有用户及运营商投诉黑号，导出归一化保存至 US/processed_fcc_api.csv
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
OUT_CSV = US_DIR / "processed_fcc_api.csv"

FCC_API_URL = "https://opendata.fcc.gov/resource/vakf-fz8e.json"
PAGE_SIZE = 5000
MAX_PAGES = 10  # 默认翻页抓取上限 50,000 条


def format_us_phone(number):
    try:
        parsed = phonenumbers.parse(str(number), "US")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_fcc_api():
    print("\n[开始调用 FCC Socrata 开放 API 分页拉取数据...]")
    US_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    offset = 0

    for page in range(MAX_PAGES):
        url = f"{FCC_API_URL}?$limit={PAGE_SIZE}&$offset={offset}&$order=:created_at%20DESC"
        print(f"  查询 FCC API 页码 {page+1} (offset={offset})...")

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=45) as resp:
                records = json.loads(resp.read().decode("utf-8"))

            if not isinstance(records, list) or not records:
                print("  FCC API 无更多数据，结束轮询")
                break

            for rec in records:
                phone_raw = rec.get("caller_id_number", "")
                issue = rec.get("issue", "Unwanted Calls") or "Unwanted Calls"
                e164 = format_us_phone(phone_raw)

                if e164:
                    rows.append({
                        "id": e164,
                        "name": f"FCC: {str(issue).strip()}",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "telemarketing",
                        "isEnabled": 1,
                        "count": 1,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "us-fcc-api"
                    })

            offset += len(records)
            if len(records) < PAGE_SIZE:
                break
            time.sleep(0.3)
        except Exception as e:
            print(f"  FCC API 请求提示/中断: {e}")
            break

    if rows:
        df = pd.DataFrame(rows)
        df.drop_duplicates(subset=["phoneNumber"], inplace=True)
        df.to_csv(OUT_CSV, index=False)
        print(f"  已保存 {len(df):,} 条 FCC API 记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_fcc_api()
