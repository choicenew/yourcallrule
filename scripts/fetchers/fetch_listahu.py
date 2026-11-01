#!/usr/bin/env python3
"""
Lista Hũ 巴拉圭官方与社区防诈 API 全量同步脚本

安全约束：原始 JSON 数据留存大小严格限制在 10MB 以内，规避 GitHub 单文件 100MB 限制。
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
PY_DIR = PROJECT_DIR / "PY"
RAW_PY_DIR = PROJECT_DIR / "raw_data" / "PY"
OUT_CSV = PY_DIR / "processed_listahu.csv"

LISTAHU_API_BASE = "https://listahu.org/api/v1/lista/"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def format_py_phone(number):
    try:
        clean = "".join(c for c in str(number) if c.isdigit() or c == "+")
        if not clean:
            return None
        parsed = phonenumbers.parse(clean, "PY")
        if phonenumbers.is_valid_number(parsed):
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    if clean:
        return f"+595{clean.lstrip('0')}" if not clean.startswith("+") else clean
    return None


def fetch_listahu():
    print("\n[开始调用 Lista Hũ 巴拉圭 API 分页同步数据...]")
    PY_DIR.mkdir(parents=True, exist_ok=True)
    RAW_PY_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []
    raw_samples = []
    page = 1
    max_pages = 10  # 限制单次 API 分页页数，防止原始文件突破 100MB 上限

    while page <= max_pages:
        url = f"{LISTAHU_API_BASE}?page={page}"
        print(f"  请求 Lista Hũ 巴拉圭 API 页码 {page}...")

        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw_bytes = resp.read()

            page_data = json.loads(raw_bytes.decode("utf-8"))
            if page <= 3:  # 仅保留前几页原始快照留存，避免体积暴涨
                raw_samples.append(page_data)

            entries = page_data if isinstance(page_data, list) else page_data.get("results", page_data.get("data", page_data.get("lista", [])))

            if not entries:
                print("  Lista Hũ API 无更多页，结束轮询")
                break

            for item in entries:
                if isinstance(item, dict):
                    phone_raw = str(item.get("numero", item.get("phoneNumber", item.get("phone", "")))).strip()
                    category = str(item.get("categoria", item.get("description", "Spam Call"))).strip()
                else:
                    phone_raw = str(item).strip()
                    category = "Spam Call"

                e164 = format_py_phone(phone_raw)
                if e164:
                    new_rows.append({
                        "id": e164,
                        "name": category or "Spam Call (Paraguay)",
                        "action": "block",
                        "priority": 3,
                        "phoneNumber": e164,
                        "labelId": "spamlikely",
                        "isEnabled": 1,
                        "count": 1,
                        "avatar": "",
                        "ruleType": "phone_rule",
                        "subscriptionId": "listahu-py"
                    })

            page += 1
            time.sleep(0.3)
        except Exception as e:
            print(f"  请求 Lista Hũ 巴拉圭 API 提示: {e}")
            break

    if raw_samples:
        raw_dump_file = RAW_PY_DIR / "listahu_raw_response.json"
        with open(raw_dump_file, "w", encoding="utf-8") as rf:
            json.dump(raw_samples, rf, ensure_ascii=False, indent=2)
        print(f"  已保存精简原始未加工数据备份 -> {raw_dump_file.relative_to(PROJECT_DIR)}")

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
        print(f"  已成功历史增量保留并保存 {len(combined_df):,} 条 Lista Hũ 巴拉圭记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_listahu()
