#!/usr/bin/env python3
"""
数据源驱动 (Source-Driven) 主控合并与 app_delta_setup_config.json 动态更新脚本

核心机制：
1. 语法与规则属性严格对齐 Flutter 客户端 RuleTypeKeys, RuleType 及 RulePriority 领域模型：
   - RuleTypeKeys: 'phone_rule', 'allow_block', 'regex', 'sim_slot', 'sms_regex'
   - RulePriority: 0 (noneAction/veryLow), 1 (silenceAction/low), 3 (blockAction/belowMedium), 5 (medium/regex/hot), 10 (high/allow)
2. 零硬编码 description 逻辑：规则集 description 统一由数据源配置 (source_configs.json) 或数据源元数据动态提供。
3. 中国黄页 (CN) 标注为黄页服务号码（action: "none" / priority: 0），绝不混淆为骚扰电话。
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

# 对齐 Flutter Dart RulePriority 领域模型值
DART_PRIORITY_NONE = 0       # noneAction / veryLow (0) - 黄页标注
DART_PRIORITY_SILENCE = 1    # silenceAction / low (1) - 静音拦截
DART_PRIORITY_BLOCK = 3      # blockAction / belowMedium (3) - 普通单号黑名单
DART_PRIORITY_MEDIUM = 5     # medium (5) - 号段正则 & 24h 社区突发热点
DART_PRIORITY_HIGH = 10      # high (10) - 白名单/放行规则

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
    """清理无用的旧 l10n 目录与 l10n.yaml 文件"""
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
    """【中国数据源】：读取 CN/ 下 19 个独立黄页分类 CSV，导出为对齐 Dart 领域的黄页规则 (action: "none", priority: 0)"""
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
                    name = row.get("name", "").strip() or f"中国黄页 ({category_name})"
                    label_id = row.get("labelId", "").strip() or CATEGORY_TO_LABEL_ID.get(slug, "other")
                    avatar = row.get("avatar", "").strip()

                    if phone:
                        rules.append({
                            "id": generate_rule_id("cn_yellowpage", phone),
                            "name": name,
                            "ruleType": "phone_rule",
                            "phoneNumber": phone,
                            "labelId": label_id,
                            "priority": DART_PRIORITY_NONE,   # 对应 Dart RulePriority.noneAction (0)
                            "action": "none",                  # 黄页仅标注，无阻断动作
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
            desc = f"中国地区官方机构与企业黄页服务号码 ({category_name})"
            generated_rulesets.append({
                "id": f"cn_yellowpage_{slug}",
                "source_id": f"cn_yellowpage_{slug}",
                "name": f"中国黄页 - {category_name}",
                "country_code": "CN",
                "description": desc,
                "icon_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/icons/cn.png",
                "rule_type": "phone_rule",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/CN/{slug}.json",
                "cdn_download_url": f"https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/CN/{slug}.json",
                "checksum_sha256": result["sha256"],
                "total_rules": result["total"],
                "priority": 1,
                "is_enabled": True
            })

    return generated_rulesets


def process_all_other_sources() -> list[dict]:
    """配置驱动处理所有其他数据源（严格对齐 Dart RulePriority 与 RuleType）"""
    print("\n[开始根据 source_configs.json 动态融合其他国家数据源...]")
    by_country_phone_map = defaultdict(lambda: defaultdict(lambda: {"count": 0, "categories": []}))
    regex_by_country = defaultdict(list)
    hot_ruleset = None

    sources = []
    source_descriptions = {}
    source_names = {}
    if SOURCE_CONFIG_FILE.exists():
        try:
            with open(SOURCE_CONFIG_FILE, "r", encoding="utf-8") as f:
                sources = json.load(f).get("sources", [])
                for s in sources:
                    sid = s.get("source_id")
                    if sid:
                        source_descriptions[sid] = s.get("description", "")
                        source_names[sid] = s.get("name", "")
        except Exception:
            pass

    for src in sources:
        if not src.get("enabled", True):
            continue

        stype = src.get("type")
        path = PROJECT_DIR / src.get("path", "")
        s_desc = src.get("description", "")
        s_name = src.get("name", "")

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
                                    "priority": DART_PRIORITY_MEDIUM, # 对应 Dart RulePriority.medium (5)
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
                                "id": "callshield_community_hot",
                                "source_id": "callshield_community_hot",
                                "name": s_name or "CallShield 24h Community Hot Feed",
                                "country_code": "GLOBAL",
                                "description": s_desc or "Recent 24-hour community reported trending spam velocity feed",
                                "icon_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/icons/global.png",
                                "rule_type": "phone_rule",
                                "full_download_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/callshield/GLOBAL/hot_block.json",
                                "cdn_download_url": "https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/callshield/GLOBAL/hot_block.json",
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
                "priority": DART_PRIORITY_BLOCK,   # 对应 Dart RulePriority.belowMedium (3)
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
            s_desc = source_descriptions.get(f"{country.lower()}_spam_csv", f"Community and official blocklist dataset for {country}")
            s_name = source_names.get(f"{country.lower()}_spam_csv", f"{country} Spam Blocklist Ruleset")
            generated_rulesets.append({
                "id": f"{country.lower()}_full_block",
                "source_id": f"{country.lower()}_full_block",
                "name": s_name,
                "country_code": country,
                "description": s_desc,
                "icon_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/icons/{country.lower()}.png",
                "rule_type": "hybrid" if country in ("FR", "IN") else "phone_rule",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/{country}/full_block.json",
                "cdn_download_url": f"https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/{country}/full_block.json",
                "checksum_sha256": res["sha256"],
                "total_rules": res["total"],
                "priority": 3,
                "is_enabled": True
            })

    for country, regex_rules in regex_by_country.items():
        if regex_rules:
            res = save_chunked_merged_rules(country, regex_rules, filename_prefix="full_block")
            s_desc = source_descriptions.get(f"{country.lower()}_regulatory_regex", f"Regulatory telemarketing series and regex rules for {country}")
            s_name = source_names.get(f"{country.lower()}_regulatory_regex", f"{country} Regulatory Regex Ruleset")
            generated_rulesets.append({
                "id": f"{country.lower()}_regulatory_regex",
                "source_id": f"{country.lower()}_regulatory_regex",
                "name": s_name,
                "country_code": country,
                "description": s_desc,
                "icon_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/icons/{country.lower()}.png",
                "rule_type": "regex",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/{country}/full_block.json",
                "cdn_download_url": f"https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/{country}/full_block.json",
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
    print("=== 开始运行数据源驱动的主控规则合并与配置生成脚本 ===")

    cleanup_legacy_l10n()

    all_rulesets = []

    # 1. 中国区黄页服务号码（黄页标注，非骚扰拦截）
    cn_19_rulesets = process_china_19_categories()
    all_rulesets.extend(cn_19_rulesets)

    # 2. 其他国家数据源合并（由 source_configs.json 动态提供描述与属性）
    other_rulesets = process_all_other_sources()
    all_rulesets.extend(other_rulesets)

    # 3. 写入 app_delta_setup_config.json
    update_app_delta_setup_config(all_rulesets)

    print("\n=== 数据源驱动的主控规则合并与配置生成全流程完成 ===")


if __name__ == "__main__":
    main()
