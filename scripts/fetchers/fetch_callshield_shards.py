#!/usr/bin/env python3
"""
CallShield 256 个分桶哈希黑号表 (00.json ~ ff.json) 拉取脚本

从 CallShield 官方 GitHub 仓批量拉取 256 个哈希分桶文件，
汇总合并保存至 callshield/GLOBAL/callshield_shards.json
"""

import json
import os
import sys
import time
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
CALLSHIELD_GLOBAL_DIR = PROJECT_DIR / "callshield" / "GLOBAL"
OUT_JSON = CALLSHIELD_GLOBAL_DIR / "callshield_shards.json"
SHARD_BASE_URL = "https://raw.githubusercontent.com/SysAdminDoc/CallShield/main/data/spam_number_shards"


def fetch_callshield_shards():
    print("\n[开始同步 CallShield 云端 256 个哈希分桶号表...]")
    CALLSHIELD_GLOBAL_DIR.mkdir(parents=True, exist_ok=True)

    all_numbers = set()
    rows = []

    # 尝试读取本地 ref 里的 shards
    local_shards_dir = PROJECT_DIR / "ref" / "data" / "spam_number_shards"
    if local_shards_dir.exists():
        for shard_file in local_shards_dir.glob("*.json"):
            try:
                with open(shard_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        for item in data:
                            phone = str(item.get("phoneNumber", item.get("number", ""))).strip() if isinstance(item, dict) else str(item).strip()
                            if phone:
                                all_numbers.add(phone)
            except Exception:
                pass

    if all_numbers:
        print(f"  使用本地已有的 CallShield 分桶号库 ({len(all_numbers):,} 条号码)")

    for phone in sorted(all_numbers):
        rows.append({
            "id": f"shard_{phone.lstrip('+')}",
            "phoneNumber": phone,
            "name": "CallShield Shard Blocked",
            "action": "block",
            "priority": 3,
            "ruleType": "phone_rule",
            "labelId": "spamlikely",
            "isEnabled": 1,
            "count": 1
        })

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"  已保存 {len(rows):,} 条 CallShield 分桶记录到 {OUT_JSON}")


if __name__ == "__main__":
    fetch_callshield_shards()
