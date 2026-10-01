#!/usr/bin/env python3
"""
CallShield 到 YourCallRule 按国家/地区分拣转换脚本

规则：
1. 保持原数据语言风格（CallShield 国际源保持英文分类，如 'Telemarketing', 'Scam Call'）。
2. 不添加任何第三方数据源品牌前缀 (如不添加 'CallShield')。
3. 规范对齐 App predefined_labels.dart 的标准 labelId。
"""

import hashlib
import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
CALLSHIELD_DIR = SCRIPT_DIR.parent

CALLSHIELD_RAW_BASE = "https://raw.githubusercontent.com/SysAdminDoc/CallShield/main/data"
FULL_DB_URL = f"{CALLSHIELD_RAW_BASE}/spam_numbers.json"
HOT_NUMBERS_URL = f"{CALLSHIELD_RAW_BASE}/hot_numbers.json"
HOT_RANGES_URL = f"{CALLSHIELD_RAW_BASE}/hot_ranges.json"

COUNTRY_CODE_MAP = {
    "1": "US",    # 美国/加拿大/NANP
    "33": "FR",   # 法国
    "49": "DE",   # 德国
    "86": "CN",   # 中国
    "91": "IN",   # 印度
    "55": "BR",   # 巴西
    "34": "ES",   # 西班牙
    "44": "UK",   # 英国
    "39": "IT",   # 意大利
    "81": "JP",   # 日本
    "82": "KR",   # 韩国
    "90": "TR",   # 土耳其
    "7": "RU",    # 俄罗斯
}

LABEL_MAP = {
    "scam": "scamslikely",
    "fraud": "fraudscamlikely",
    "robocall": "robocall",
    "telemarketing": "telemarketing",
    "sales": "telemarketing",
    "wangiri": "spamlikely",
    "spam": "spamlikely",
}

# 保持原始英文分类描述
CATEGORY_NAME_MAP = {
    "scam": "Scam Call",
    "fraud": "Fraud Scam Call",
    "robocall": "Robocall",
    "telemarketing": "Telemarketing",
    "sales": "Telemarketing",
    "wangiri": "Wangiri Spam Call",
    "spam": "Spam Call",
}


def fetch_json(url: str, local_path: Path | None = None) -> dict:
    if local_path and local_path.exists():
        print(f"--> [读取本地文件] {local_path}")
        with open(local_path, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"--> [从网络下载] {url}")
    req = urllib.request.Request(
        url, headers={"User-Agent": "YourCallRule-Subscription-Generator/1.0"}
    )
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode("utf-8")
        return json.loads(content)


def generate_rule_id(prefix: str, value: str) -> str:
    raw = f"{prefix}:{value}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()


def extract_country_code(e164_str: str) -> str:
    digits = e164_str.strip().lstrip("+")
    if digits[:2] in COUNTRY_CODE_MAP:
        return COUNTRY_CODE_MAP[digits[:2]]
    if digits[:1] in COUNTRY_CODE_MAP:
        return COUNTRY_CODE_MAP[digits[:1]]
    return "GLOBAL"


def normalize_label_id(category: str) -> str:
    cat = (category or "").lower().strip()
    for key, std_label in LABEL_MAP.items():
        if key in cat:
            return std_label
    return "spamlikely"


def format_clean_name(category: str, desc: str = "") -> str:
    """按原数据语言（英文）格式化名称，不加数据源前缀"""
    cat = (category or "").lower().strip()
    readable_cat = "Spam Call"
    for key, name_str in CATEGORY_NAME_MAP.items():
        if key in cat:
            readable_cat = name_str
            break

    if desc and not desc.startswith("FCC:") and not desc.startswith("FTC:"):
        return desc[:100]
    return readable_cat


def convert_number_entry(item: dict) -> dict:
    phone = item.get("number", "").strip()
    category = item.get("type", "spam")
    reports_count = item.get("reports", 1)
    desc = item.get("description", "").strip()

    label_id = normalize_label_id(category)
    display_name = format_clean_name(category, desc)

    return {
        "id": generate_rule_id("phone", phone),
        "name": display_name,
        "ruleType": "phone_rule",
        "phoneNumber": phone,
        "labelId": label_id,
        "priority": 3,
        "action": "block",
        "isEnabled": 1,
        "count": reports_count,
    }


def convert_prefix_entry(prefix_str: str, name: str = "") -> dict:
    clean_prefix = prefix_str.strip().lstrip("+")
    pattern = f"^\\+{clean_prefix}.*"
    display_name = name if name else f"High Risk Prefix (+{clean_prefix})"

    return {
        "id": generate_rule_id("prefix", clean_prefix),
        "name": display_name,
        "ruleType": "regex",
        "pattern": pattern,
        "priority": 5,
        "action": "block",
        "isEnabled": 1,
    }


def save_rules_by_country(by_country_dict: dict, filename: str):
    global_rules = []

    for country, rules in by_country_dict.items():
        global_rules.extend(rules)
        country_dir = CALLSHIELD_DIR / country
        country_dir.mkdir(parents=True, exist_ok=True)
        out_file = country_dir / filename
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(rules, f, ensure_ascii=False, indent=2)
        print(f"  -> 已保存 [{country}] 规则 ({len(rules)} 条) 到 {out_file}")

    global_dir = CALLSHIELD_DIR / "GLOBAL"
    global_dir.mkdir(parents=True, exist_ok=True)
    global_file = global_dir / filename
    with open(global_file, "w", encoding="utf-8") as f:
        json.dump(global_rules, f, ensure_ascii=False, indent=2)
    print(f"  -> 已保存 [GLOBAL] 汇总规则 ({len(global_rules)} 条) 到 {global_file}")


def process_full_database(callshield_dir: Path | None = None):
    print("\n[开始处理全量黑名单数据库...]")
    local_db = (callshield_dir / "data" / "spam_numbers.json") if callshield_dir else None
    db_data = fetch_json(FULL_DB_URL, local_db)

    by_country = defaultdict(list)

    for num_item in db_data.get("numbers", []):
        phone = num_item.get("number", "")
        if phone:
            country = extract_country_code(phone)
            by_country[country].append(convert_number_entry(num_item))

    for prefix_item in db_data.get("prefixes", []):
        p_str = prefix_item.get("prefix") or prefix_item.get("pattern")
        if p_str:
            desc = prefix_item.get("description", "")
            country = extract_country_code(p_str)
            by_country[country].append(convert_prefix_entry(p_str, desc))

    save_rules_by_country(by_country, "full_block.json")


def process_hot_database(callshield_dir: Path | None = None):
    print("\n[开始处理热点爆发黑名单...]")
    local_hot_num = (callshield_dir / "data" / "hot_numbers.json") if callshield_dir else None
    local_hot_range = (callshield_dir / "data" / "hot_ranges.json") if callshield_dir else None

    hot_num_data = fetch_json(HOT_NUMBERS_URL, local_hot_num)
    hot_range_data = fetch_json(HOT_RANGES_URL, local_hot_range)

    by_country = defaultdict(list)

    for item in hot_num_data.get("numbers", []):
        phone = item.get("number", "")
        if phone:
            country = extract_country_code(phone)
            by_country[country].append(convert_number_entry(item))

    for range_item in hot_range_data.get("ranges", []):
        p_str = range_item.get("range") or range_item.get("pattern")
        if p_str:
            country = extract_country_code(p_str)
            by_country[country].append(convert_prefix_entry(p_str, "24h Trending Range"))

    save_rules_by_country(by_country, "hot_block.json")


def main():
    print("=== 开始运行 CallShield 规范化订阅规则转换脚本 ===")
    local_callshield = CALLSHIELD_DIR.parent / "CallShield"
    if not local_callshield.exists():
        local_callshield = None

    process_full_database(local_callshield)
    process_hot_database(local_callshield)
    print("\n=== CallShield 规范化规则处理完成 ===")


if __name__ == "__main__":
    main()
