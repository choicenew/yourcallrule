#!/usr/bin/env python3
"""
PhoneBlock.net 欧洲开源社区全量 Dump 库同步脚本

包含原始数据留存备份功能：从网络拉取到的原始 API/Dump 响应字节，
无损留存备份保存至 raw_data/EU/phoneblock_raw.json / txt。
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
import pandas as pd
import phonenumbers

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
EU_DIR = PROJECT_DIR / "EU"
RAW_EU_DIR = PROJECT_DIR / "raw_data" / "EU"
OUT_CSV = EU_DIR / "processed_phoneblock.csv"

PHONEBLOCK_API_URL = "https://phoneblock.net/phoneblock/api/blocklist"

PHONEBLOCK_USERNAME = os.environ.get("PHONEBLOCK_USERNAME", "").strip()
PHONEBLOCK_PASSWORD = os.environ.get("PHONEBLOCK_PASSWORD", "").strip()
PHONEBLOCK_API_KEY = os.environ.get("PHONEBLOCK_API_KEY", "").strip()


def format_eu_phone(number):
    try:
        clean = "".join(c for c in str(number) if c.isdigit() or c == "+")
        if not clean:
            return None
        if not clean.startswith("+"):
            clean = f"+{clean.lstrip('0')}"
        if len(clean) >= 8:
            return clean
    except Exception:
        pass
    return None


def fetch_phoneblock():
    print("\n[开始同步 PhoneBlock.net 欧洲全量社区黑名单库...]")
    EU_DIR.mkdir(parents=True, exist_ok=True)
    RAW_EU_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []
    headers = {"User-Agent": "Mozilla/5.0"}

    if PHONEBLOCK_USERNAME and PHONEBLOCK_PASSWORD:
        userpass = f"{PHONEBLOCK_USERNAME}:{PHONEBLOCK_PASSWORD}"
        encoded_u_p = base64.b64encode(userpass.encode("utf-8")).decode("utf-8")
        headers["Authorization"] = f"Basic {encoded_u_p}"
        print("  已从环境变量加载 PHONEBLOCK_USERNAME / PHONEBLOCK_PASSWORD 授权头")
    elif PHONEBLOCK_API_KEY:
        headers["Authorization"] = f"Bearer {PHONEBLOCK_API_KEY}"
        headers["X-API-Key"] = PHONEBLOCK_API_KEY
        print("  已从环境变量加载 PHONEBLOCK_API_KEY 授权头")

    try:
        url = f"{PHONEBLOCK_API_URL}?limit=50000"
        print(f"  正在请求 PhoneBlock 全量 API: {url}")
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw_bytes = resp.read()

        # 原始数据备份留存 (Raw Data Retention)
        raw_dump_file = RAW_EU_DIR / "phoneblock_raw_response.json"
        with open(raw_dump_file, "wb") as rf:
            rf.write(raw_bytes)
        print(f"  已保存原始未加工数据备份 -> {raw_dump_file.relative_to(PROJECT_DIR)}")

        data = json.loads(raw_bytes.decode("utf-8"))
        entries = data if isinstance(data, list) else data.get("numbers", data.get("blocklist", data.get("data", [])))
        for item in entries:
            phone_raw = item.get("phoneNumber", item.get("number", item.get("phone", ""))) if isinstance(item, dict) else str(item)
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
        print(f"  成功从 PhoneBlock API 解析出 {len(new_rows):,} 条欧洲黑号记录")
    except urllib.error.HTTPError as err:
        if err.code in (401, 403):
            print(f"  PhoneBlock 提示: 凭证未配置或失效 (HTTP {err.code})，安全降级使用本地历史沉淀库")
        else:
            print(f"  PhoneBlock API 请求错误: {err}")
    except Exception as e:
        print(f"  PhoneBlock 请求异常: {e}")

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
        print(f"  已成功历史沉淀并保存 {len(combined_df):,} 条 PhoneBlock 欧洲记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_phoneblock()
