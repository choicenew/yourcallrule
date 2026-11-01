#!/usr/bin/env python3
"""
PhoneBlock.net 欧洲开源社区 Bulk API 同步脚本

注：PhoneBlock 官方已要求账户 API Key 凭证（未配置 PHONEBLOCK_API_KEY 时无权访问 401）。
本脚本会在配置凭证时动态同步，未配置时安全降级使用已有的本地缓存数据。
"""

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
OUT_CSV = EU_DIR / "processed_phoneblock.csv"

PHONEBLOCK_API_URL = "https://phoneblock.net/phoneblock/api/blocklist"
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
    print("\n[开始同步 PhoneBlock.net 欧洲社区黑名单库...]")
    EU_DIR.mkdir(parents=True, exist_ok=True)

    existing_df = pd.DataFrame()
    if OUT_CSV.exists():
        try:
            existing_df = pd.read_csv(OUT_CSV, dtype=str)
        except Exception:
            pass

    new_rows = []

    if PHONEBLOCK_API_KEY:
        print("  发现 PHONEBLOCK_API_KEY 凭证，尝试发起批量请求...")
        try:
            req = urllib.request.Request(
                f"{PHONEBLOCK_API_URL}?limit=5000",
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Authorization": f"Bearer {PHONEBLOCK_API_KEY}",
                    "X-API-Key": PHONEBLOCK_API_KEY,
                },
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
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
            print(f"  成功从 PhoneBlock API 拉取到 {len(new_rows):,} 条记录")
        except urllib.error.HTTPError as err:
            if err.code == 401:
                print("  PhoneBlock 提示: 凭证无效或全量接口需要商业授权 (HTTP 401 Unauthorized)，安全跳过在线下载")
            else:
                print(f"  PhoneBlock API 请求错误: {err}")
        except Exception as e:
            print(f"  PhoneBlock 请求异常: {e}")
    else:
        print("  未配置 PHONEBLOCK_API_KEY 凭证 (PhoneBlock 批量导出需要专有授权 401)，自动安全降级使用本地增量缓存")

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
        print(f"  已成功历史保留并保存 {len(combined_df):,} 条 PhoneBlock 欧洲记录到 {OUT_CSV}")


if __name__ == "__main__":
    fetch_phoneblock()
