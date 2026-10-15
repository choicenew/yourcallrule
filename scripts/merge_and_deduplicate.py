#!/usr/bin/env python3
"""
配置驱动 (Configuration-Driven) 主控合并、去重与 app_delta_setup_config.json 自动生成脚本

支持：
1. 双重中国区数据融合：
   - 数据 1：CN/ 目录下 19 个独立黄页分类 CSV，保持分类独立性，导出为 CN/*.json。
   - 数据 2：全球多源库中归属中国 (+86) 的骚扰黑名单，导出为 CN/full_block.json。
2. 未来无损扩展 (Zero-YAML Config Driven)：
   - 读取 scripts/source_configs.json 数据源注册文件。未来新增数据源时只需在配置文件中追加，无需修改 YAML 工作流与 Python 核心代码。
"""

import csv
import hashlib
import json
import os
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

try:
    import phonenumbers
except ImportError:
    phonenumbers = None

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
SOURCE_CONFIG_FILE = SCRIPT_DIR / "source_configs.json"
MERGED_OUT_DIR = PROJECT_DIR / "merged_rules"
CONFIG_FILE = PROJECT_DIR / "app_delta_setup_config.json"

MAX_RULES_PER_FILE = 25000

# 严格对齐 App predefined_labels.dart 标准 labelId
CATEGORY_TO_LABEL_ID = {
    "bank": "bank",
    "delivery": "delivery",
    "ecommerce": "ecommerce",
    "takeaway": "takeaway",
    "internet": "internet",
    "travelticketing": "travelticketing",
    "applicationsoftware": "applicationsoftware",
    "entertainment": "entertainment",
    "agent": "agent",
    "government": "government",
    "localservices": "localservices",
    "automotiveindustry": "automotiveindustry",
    "carrental": "carrental",
    "insurance": "insurance",
    "telecommunication": "telecommunication",
    "hotel": "hotel",
    "cloudservice": "cloudservice",
    "other": "other",
    "telemarketer": "telemarketing",
    "telemarketing": "telemarketing",
    "debt_collector": "collection",
    "silent_call": "robocall",
    "nuisance_call": "spamlikely",
    "unsolicited_call": "telemarketing",
    "call_centre": "telemarketing",
    "fax_machine": "other",
    "non_profit_org": "charity",
    "political_call": "political",
    "scam_call": "scamslikely",
    "scam": "scamslikely",
    "prank_call": "scamslikely",
    "sms": "spamlikely",
    "survey": "survey",
    "finance_service": "financial",
    "company": "other",
    "service": "customerservice",
    "robocall": "robocall",
    "spam": "spamlikely",
    "risk": "risk",
}

CATEGORY_TO_NEUTRAL_NAME = {
    "telemarketer": "Telemarketer",
    "telemarketing": "Telemarketing",
    "debt_collector": "Debt Collector",
    "silent_call": "Silent Call",
    "nuisance_call": "Nuisance Call",
    "unsolicited_call": "Unsolicited Call",
    "call_centre": "Call Centre",
    "fax_machine": "Fax Machine",
    "non_profit_org": "Non-Profit Organization",
    "political_call": "Political Call",
    "scam_call": "Scam Call",
    "scam": "Scam Call",
    "prank_call": "Prank Call",
    "sms": "SMS Spam",
    "survey": "Survey",
    "other": "Spam Call",
    "finance_service": "Financial Service",
    "company": "Company",
    "service": "Customer Service",
    "robocall": "Robocall",
    "spam": "Spam Call",
    "risk": "Risk Number",
}

LABEL_TO_FILE_SLUG = {
    "金融银行": "bank",
    "快递物流": "delivery",
    "电商购物": "ecommerce",
    "外卖订餐": "takeaway",
    "互联网": "internet",
    "出行购票": "travelticketing",
    "应用软件": "applicationsoftware",
    "影音娱乐": "entertainment",
    "房产中介": "agent",
    "政府机构": "government",
    "本地生活": "localservices",
    "汽车行业": "automotiveindustry",
    "租车代驾": "carrental",
    "证券保险": "insurance",
    "通讯服务": "telecommunication",
    "酒店住宿": "hotel",
    "云服务": "cloudservice",
    "其它": "other",
}


def cleanup_legacy_l10n():
    """彻底清理无用的旧 l10n 目录与 l10n.yaml 文件"""
    l10n_dir = PROJECT_DIR / "l10n"
    l10n_yaml = PROJECT_DIR / "l10n.yaml"
    if l10n_dir.exists():
        try:
            shutil.rmtree(l10n_dir, ignore_errors=True)
            print("  [清理] 已删除无用的 l10n/ 目录")
        except Exception:
            pass
    if l10n_yaml.exists():
        try:
            l10n_yaml.unlink()
            print("  [清理] 已删除无用的 l10n.yaml 文件")
        except Exception:
            pass


def compute_file_sha256(path: Path) -> str:
    if not path.exists():
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def generate_rule_id(prefix: str, value: str) -> str:
    raw = f"{prefix}:{value}".encode("utf-8")
    return hashlib.md5(raw).hexdigest()


def extract_country_code(phone_e164: str) -> str:
    """使用 phonenumbers (libphonenumber) 动态解析全球 200+ 国家 ISO 代码"""
    if phonenumbers:
        try:
            raw = phone_e164 if phone_e164.startswith("+") else f"+{phone_e164}"
            parsed = phonenumbers.parse(raw, None)
            if phonenumbers.is_valid_number(parsed):
                region = phonenumbers.region_code_for_number(parsed)
                if region:
                    return region.upper()
        except Exception:
            pass

    digits = phone_e164.strip().lstrip("+")
    if digits.startswith("86"):
        return "CN"
    if digits.startswith("33"):
        return "FR"
    if digits.startswith("49"):
        return "DE"
    if digits.startswith("91"):
        return "IN"
    if digits.startswith("90"):
        return "TR"
    if digits.startswith("1"):
        return "US"
    return "GLOBAL"


def save_chunked_merged_rules(country_code: str, rules_list: list, filename_prefix: str = "full_block") -> dict:
    country_dir = MERGED_OUT_DIR / country_code
    country_dir.mkdir(parents=True, exist_ok=True)

    total = len(rules_list)
    out_file = country_dir / f"{filename_prefix}.json"

    if total <= MAX_RULES_PER_FILE or filename_prefix != "full_block":
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(rules_list, f, ensure_ascii=False, indent=2)
        sha256 = compute_file_sha256(out_file)
        print(f"  -> 已导出 [{country_code}/{filename_prefix}.json] ({total} 条) -> {out_file.relative_to(PROJECT_DIR)}")
        return {"file": out_file, "total": total, "sha256": sha256, "country": country_code, "slug": filename_prefix}
    else:
        part_idx = 1
        for i in range(0, total, MAX_RULES_PER_FILE):
            chunk = rules_list[i : i + MAX_RULES_PER_FILE]
            part_file = country_dir / f"{filename_prefix}_part{part_idx}.json"
            with open(part_file, "w", encoding="utf-8") as f:
                json.dump(chunk, f, ensure_ascii=False, indent=2)
            part_idx += 1

        index_file = country_dir / "index.json"
        index_data = {
            "country": country_code,
            "total_rules": total,
            "parts_count": part_idx - 1,
            "files": [f"{filename_prefix}_part{p}.json" for p in range(1, part_idx)],
        }
        with open(index_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

        sha256 = compute_file_sha256(country_dir / f"{filename_prefix}_part1.json")
        return {"file": country_dir / f"{filename_prefix}_part1.json", "total": total, "sha256": sha256, "country": country_code, "slug": filename_prefix}


def process_china_19_categories() -> list[dict]:
    """【中国数据源 1】：读取 CN/ 下 19 个独立黄页分类 CSV，保持各分类完全独立导出"""
    print("\n[开始处理中国区 19 个独立黄页分类...]")
    cn_dir = PROJECT_DIR / "CN"
    generated_rulesets = []

    if not cn_dir.exists():
        return generated_rulesets

    for csv_file in cn_dir.glob("*.csv"):
        category_name = csv_file.stem
        slug = LABEL_TO_FILE_SLUG.get(category_name, category_name)
        rules = []

        try:
            with open(csv_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    phone = row.get("phoneNumber", "").strip()
                    name = row.get("name", "").strip() or f"China Yellowpage ({category_name})"
                    label_id = row.get("labelId", "").strip() or CATEGORY_TO_LABEL_ID.get(slug, "other")
                    avatar = row.get("avatar", "").strip()

                    if phone:
                        rules.append({
                            "id": generate_rule_id("cn_yellowpage", phone),
                            "name": name,
                            "ruleType": "phone_rule",
                            "phoneNumber": phone,
                            "labelId": label_id,
                            "priority": 0,
                            "action": "none",
                            "isEnabled": 1,
                            "count": 0,
                            "avatar": avatar,
                            "subscriptionId": f"cn-yellowpage-{slug}"
                        })
        except Exception as e:
            print(f"  错误处理 {csv_file.name}: {e}")
            continue

        if rules:
            result = save_chunked_merged_rules("CN", rules, filename_prefix=slug)
            generated_rulesets.append({
                "source_id": f"cn_yellowpage_{slug}",
                "name": f"China Yellowpage - {category_name}",
                "country_code": "CN",
                "rule_type": "phone_rule",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/CN/{slug}.json",
                "checksum_sha256": result["sha256"],
                "total_rules": result["total"],
                "priority": 1,
                "is_enabled": True
            })

    return generated_rulesets


def process_all_other_sources() -> list[dict]:
    """配置驱动处理所有其他源（含中国区第二份数据 CN Spam Blocklist、US, FR, TR, IN, GLOBAL 等）"""
    print("\n[开始根据 source_configs.json 融合其他国家数据源...]")
    by_country_phone_map = defaultdict(lambda: defaultdict(lambda: {"count": 0, "categories": []}))
    regex_by_country = defaultdict(list)
    hot_ruleset = None

    sources = []
    if SOURCE_CONFIG_FILE.exists():
        try:
            with open(SOURCE_CONFIG_FILE, "r", encoding="utf-8") as f:
                sources = json.load(f).get("sources", [])
        except Exception:
            pass

    for src in sources:
        if not src.get("enabled", True):
            continue

        stype = src.get("type")
        path = PROJECT_DIR / src.get("path", "")

        if stype in ("directory_csv", "directory_csv_regex") and path.exists():
            for csv_file in path.glob("*.csv"):
                try:
                    with open(csv_file, "r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            pattern = row.get("pattern", "").strip()
                            phone = row.get("phoneNumber", "").strip()
                            if pattern:
                                target_country = src.get("country_mode", "GLOBAL")
                                regex_by_country[target_country].append({
                                    "id": row.get("id", generate_rule_id("regex", pattern)),
                                    "name": row.get("name", "Regulatory Regex"),
                                    "ruleType": "regex",
                                    "pattern": pattern,
                                    "priority": 5,
                                    "action": "block",
                                    "isEnabled": 1,
                                })
                            elif phone:
                                target_country = extract_country_code(phone) if src.get("country_mode") == "auto" else src.get("country_mode", "GLOBAL")
                                by_country_phone_map[target_country][phone]["count"] += 1
                                by_country_phone_map[target_country][phone]["categories"].append(row.get("labelId", "spamlikely"))
                except Exception:
                    pass

        elif stype == "json_rules" and path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if src.get("is_hot_feed"):
                        numbers = data.get("numbers", [])
                        if numbers:
                            sha256 = compute_file_sha256(path)
                            hot_ruleset = {
                                "source_id": "callshield_community_hot",
                                "name": "CallShield 24h Community Hot Feed",
                                "country_code": "GLOBAL",
                                "rule_type": "phone_rule",
                                "full_download_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/callshield/GLOBAL/hot_block.json",
                                "checksum_sha256": sha256,
                                "total_rules": len(numbers),
                                "priority": 5,
                                "is_enabled": True
                            }
                    else:
                        target_country = src.get("country_mode", "GLOBAL")
                        if isinstance(data, list):
                            regex_by_country[target_country].extend(data)
            except Exception:
                pass

        elif stype == "unpacked_json" and path.exists():
            for json_file in path.glob("*.json"):
                try:
                    with open(json_file, "r", encoding="utf-8") as f:
                        records = json.load(f)
                        if isinstance(records, list):
                            for r in records:
                                phone = r.get("phoneNumber", "").strip()
                                if phone:
                                    target_country = extract_country_code(phone)
                                    by_country_phone_map[target_country][phone]["count"] += r.get("negative", r.get("searches", 1))
                                    by_country_phone_map[target_country][phone]["categories"].append(r.get("category", "spam"))
                except Exception:
                    pass

    generated_rulesets = []
    if hot_ruleset:
        generated_rulesets.append(hot_ruleset)

    for country, phone_dict in by_country_phone_map.items():
        rules = []
        for phone, meta in phone_dict.items():
            cats = meta["categories"]
            main_cat = cats[0] if cats else "spam"
            label_id = CATEGORY_TO_LABEL_ID.get(main_cat, "spamlikely")
            display_name = CATEGORY_TO_NEUTRAL_NAME.get(main_cat, "Spam Call")

            rules.append({
                "id": generate_rule_id("merged_phone", phone),
                "name": display_name,
                "ruleType": "phone_rule",
                "phoneNumber": phone,
                "labelId": label_id,
                "priority": 3,
                "action": "block",
                "isEnabled": 1,
                "count": meta["count"],
                "avatar": "",
                "subscriptionId": f"{country.lower()}-spam-blocklist"
            })

        if country in regex_by_country:
            rules.extend(regex_by_country[country])
            del regex_by_country[country]

        if rules:
            res = save_chunked_merged_rules(country, rules, filename_prefix="full_block")
            generated_rulesets.append({
                "source_id": f"{country.lower()}_full_block",
                "name": f"{country} Spam Blocklist Ruleset",
                "country_code": country,
                "rule_type": "hybrid" if country in ("FR", "IN") else "phone_rule",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/{country}/full_block.json",
                "checksum_sha256": res["sha256"],
                "total_rules": res["total"],
                "priority": 3,
                "is_enabled": True
            })

    for country, regex_rules in regex_by_country.items():
        if regex_rules:
            res = save_chunked_merged_rules(country, regex_rules, filename_prefix="full_block")
            generated_rulesets.append({
                "source_id": f"{country.lower()}_regulatory_regex",
                "name": f"{country} Regulatory Regex Ruleset",
                "country_code": country,
                "rule_type": "regex",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/{country}/full_block.json",
                "checksum_sha256": res["sha256"],
                "total_rules": res["total"],
                "priority": 5,
                "is_enabled": True
            })

    return generated_rulesets


def update_app_delta_setup_config(all_rulesets: list[dict]):
    print("\n[开始自动更新/生成根目录 app_delta_setup_config.json...]")
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    config_data = {
        "config_version": "1.0.0",
        "last_updated": now_iso,
        "update_strategy": {
            "sync_interval_hours": 24,
            "allow_cellular_download": False,
            "enable_delta_update": True,
            "max_delta_depth": 7
        },
        "rulesets": all_rulesets,
        "delta_patches": []
    }

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_data, f, ensure_ascii=False, indent=2)

    print(f"✅ 成功生成并覆盖更新根目录配置文件: {CONFIG_FILE.name} (共包含 {len(all_rulesets)} 个独立规则集)")


def main():
    print("=== 开始运行配置驱动的主控规则合并与订阅配置生成脚本 ===")

    # 0. 自动清理无用的旧 l10n
    cleanup_legacy_l10n()

    all_rulesets = []

    # 1. 中国区【数据 1】：19 个独立黄页分类处理
    cn_19_rulesets = process_china_19_categories()
    all_rulesets.extend(cn_19_rulesets)

    # 2. 其他国家数据源合并（含中国区【数据 2】：CN 骚扰黑名单大列表 cn_full_block）
    other_rulesets = process_all_other_sources()
    all_rulesets.extend(other_rulesets)

    # 3. 写入 app_delta_setup_config.json
    update_app_delta_setup_config(all_rulesets)

    print("\n=== 主控规则合并与 app_delta_setup_config.json 自动生成全流程完成 ===")


if __name__ == "__main__":
    main()
