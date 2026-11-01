#!/usr/bin/env python3
"""
CallShield 官方已审核通过全量黑表与分桶号表同步脚本

从 CallShield 官方 GitHub 仓拉取 spam_numbers_approved.json 与分桶文件，
导出归一化保存至 callshield/GLOBAL/callshield_approved.json
"""

import json
import os
import sys
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
CALLSHIELD_GLOBAL_DIR = PROJECT_DIR / "callshield" / "GLOBAL"
OUT_JSON = CALLSHIELD_GLOBAL_DIR / "callshield_approved.json"
APPROVED_URL = "https://raw.githubusercontent.com/SysAdminDoc/CallShield/main/data/spam_numbers_approved.json"


def fetch_callshield_approved():
    print("\n[开始同步 CallShield 官方已审核黑名单数据...]")
    CALLSHIELD_GLOBAL_DIR.mkdir(parents=True, exist_ok=True)

    local_ref_file = PROJECT_DIR / "ref" / "data" / "spam_numbers_approved.json"
    entries = []

    if local_ref_file.exists():
        try:
            with open(local_ref_file, "r", encoding="utf-8") as f:
                entries = json.load(f)
            print(f"  使用本地已配好的 CallShield 文件 ({len(entries)} 条)")
        except Exception:
            pass

    if not entries:
        try:
            req = urllib.request.Request(APPROVED_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                entries = json.loads(resp.read().decode("utf-8"))
            print(f"  成功从 GitHub 远程下载 CallShield 官方黑名单 ({len(entries)} 条)")
        except Exception as e:
            print(f"  远程下载 CallShield 官方黑名单提示: {e}")

    rows = []
    if isinstance(entries, list):
        for item in entries:
            if isinstance(item, dict):
                phone = str(item.get("phoneNumber", item.get("number", ""))).strip()
                name = str(item.get("name", item.get("category", "CallShield Blocked"))).strip()
            else:
                phone = str(item).strip()
                name = "CallShield Blocked"

            if phone:
                rows.append({
                    "id": f"cs_{phone.lstrip('+')}",
                    "phoneNumber": phone,
                    "name": name or "CallShield Blocked",
                    "action": "block",
                    "priority": 3,
                    "ruleType": "phone_rule",
                    "labelId": "spamlikely",
                    "isEnabled": 1,
                    "count": 1
                })

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"  已成功保存 {len(rows):,} 条 CallShield 官方记录到 {OUT_JSON}")


if __name__ == "__main__":
    fetch_callshield_approved()
