#!/usr/bin/env python3
"""
解耦驱动 (Decoupled Architecture) 主控合并与 app_delta_setup_config.json 动态更新脚本

结构解耦：
1. 独立读取 scripts/configs/phone_sources_config.json（单号数据源配置）
2. 独立读取 scripts/configs/regex_configs.json（正则规则配置）
3. 独立读取 scripts/configs/country_i18n.json（国家与母语描述）
4. 中国黄页 (CN) 保持 19 个分类完全独立，明确为黄页标注（action: "none" / priority: 0）。
5. 自动生成并覆盖更新 app_delta_setup_config.json。
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

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
UTILS_DIR = SCRIPT_DIR.parent / "utils"
if str(UTILS_DIR) not in sys.path:
    sys.path.insert(0, str(UTILS_DIR))

try:
    import phonenumbers
    from phonenumbers import geocoder
except ImportError:
    phonenumbers = None
    geocoder = None

CONFIGS_DIR = SCRIPT_DIR.parent / "configs"
PHONE_CONFIG_FILE = CONFIGS_DIR / "phone_sources_config.json"
REGEX_CONFIG_FILE = CONFIGS_DIR / "regex_configs.json"
COUNTRY_I18N_FILE = CONFIGS_DIR / "country_i18n.json"

MERGED_OUT_DIR = PROJECT_DIR / "merged_rules"
CONFIG_FILE = PROJECT_DIR / "app_delta_setup_config.json"

MAX_RULES_PER_FILE = 25000

# 对齐 Flutter Dart RulePriority 领域模型值
DART_PRIORITY_NONE = 0       # noneAction / veryLow (0) - 黄页标注 (非拦截)
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


def load_country_i18n() -> tuple[dict[str, dict], dict[str, dict]]:
    if COUNTRY_I18N_FILE.exists():
        try:
            with open(COUNTRY_I18N_FILE, "r", encoding="utf-8") as f:
                payload = json.load(f)
                return payload.get("countries", {}), payload.get("cn_categories", {})
        except Exception:
            pass
    return {}, {}


def cleanup_legacy_l10n():
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
    if not phone_e164:
        return "GLOBAL"

    raw = phone_e164.strip()
    if not raw.startswith("+"):
        raw = f"+{raw}"

    if phonenumbers:
        try:
            parsed = phonenumbers.parse(raw, None)
            region = phonenumbers.region_code_for_number(parsed)
            if region:
                return region.upper()
        except Exception:
            pass

    return "GLOBAL"


def resolve_country_i18n_info(country_code: str, country_i18n_db: dict[str, dict]) -> tuple[str, str, str]:
    code_upper = country_code.upper()
    code_lower = country_code.lower()

    if code_upper in country_i18n_db:
        info = country_i18n_db[code_upper]
        name = info.get("name", code_upper)
        desc = info.get("description", f"Official and community blocklist for {name}")
        flag_code = info.get("flag_code", code_lower)
        flag_url = f"https://flagcdn.com/w80/{flag_code}.png"
        return name, desc, flag_url

    resolved_name = code_upper
    if phonenumbers and geocoder:
        try:
            sample_number = phonenumbers.parse(f"+{phonenumbers.country_code_for_region(code_upper)}12345678", None)
            name_geo = geocoder.country_name_for_number(sample_number, "en")
            if name_geo:
                resolved_name = name_geo
        except Exception:
            pass

    flag_url = f"https://flagcdn.com/w80/{code_lower}.png"
    default_desc = f"Official and community spam & scam numbers blocklist for {resolved_name}"
    return resolved_name, default_desc, flag_url


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


def process_china_19_categories(cn_cat_i18n: dict[str, dict]) -> list[dict]:
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
                            "action": "none",                  # 明确为 "none"（黄页服务标注，非拦截）
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
            cat_meta = cn_cat_i18n.get(slug, {})
            title_name = cat_meta.get("name", f"中国黄页 - {category_name}")
            desc = cat_meta.get("description", f"中国地区官方机构与企业黄页服务号码 ({category_name})")

            generated_rulesets.append({
                "id": f"cn_yellowpage_{slug}",
                "source_id": f"cn_yellowpage_{slug}",
                "name": title_name,
                "country_code": "CN",
                "description": desc,
                "icon_url": "https://flagcdn.com/w80/cn.png",
                "rule_type": "phone_rule",
                "full_download_url": f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/CN/{slug}.json",
                "cdn_download_url": f"https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/CN/{slug}.json",
                "checksum_sha256": result["sha256"],
                "total_rules": result["total"],
                "priority": 0,
                "is_enabled": True
            })

    return generated_rulesets


def process_decoupled_sources(country_i18n_db: dict) -> list[dict]:
    print("\n[开始分别读取单号配置与正则配置进行整合...]")
    by_country_phone_map = defaultdict(lambda: defaultdict(lambda: {"count": 0, "categories": []}))
    regex_by_country = defaultdict(list)
    hot_ruleset = None

    phone_sources = []
    if PHONE_CONFIG_FILE.exists():
        try:
            with open(PHONE_CONFIG_FILE, "r", encoding="utf-8") as f:
                phone_sources = json.load(f).get("phone_sources", [])
        except Exception:
            pass

    for src in phone_sources:
        if not src.get("enabled", True):
            continue

        stype = src.get("type")
        path = PROJECT_DIR / src.get("path", "")
        s_desc = src.get("description", "")
        s_name = src.get("name", "")

        if stype == "directory_csv" and path.exists():
            for csv_file in path.glob("*.csv"):
                try:
                    with open(csv_file, "r", encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            phone = row.get("phoneNumber", "").strip()
                            if phone:
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
                        # 同步保存至 merged_rules/GLOBAL/hot_block.json
                        merged_global_dir = MERGED_OUT_DIR / "GLOBAL"
                        merged_global_dir.mkdir(parents=True, exist_ok=True)
                        merged_hot_file = merged_global_dir / "hot_block.json"

                        if isinstance(data, list):
                            hot_entries = data
                        else:
                            hot_entries = numbers

                        with open(merged_hot_file, "w", encoding="utf-8") as hf:
                            json.dump(hot_entries, hf, ensure_ascii=False, indent=2)

                        sha256 = compute_file_sha256(merged_hot_file)
                        hot_ruleset = {
                            "id": "callshield_community_hot",
                            "source_id": "callshield_community_hot",
                            "name": s_name or "Global 24h Community Velocity Feed",
                            "country_code": "GLOBAL",
                            "description": s_desc or "Recent 24-hour community reported trending spam velocity feed",
                            "icon_url": "https://flagcdn.com/w80/un.png",
                            "rule_type": "phone_rule",
                            "full_download_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/GLOBAL/hot_block.json",
                            "cdn_download_url": "https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/GLOBAL/hot_block.json",
                            "checksum_sha256": sha256,
                            "total_rules": len(hot_entries),
                            "priority": 5,
                            "is_enabled": True
                        }
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

    regex_sources = []
    if REGEX_CONFIG_FILE.exists():
        try:
            with open(REGEX_CONFIG_FILE, "r", encoding="utf-8") as f:
                regex_sources = json.load(f).get("regex_rulesets", [])
        except Exception:
            pass

    for rset in regex_sources:
        if not rset.get("enabled", True):
            continue

        target_country = rset.get("country_code", "GLOBAL").upper()
        prefixes = rset.get("prefixes", [])
        for prefix in prefixes:
            pattern = f"^\\+?{prefix}\\d{{6}}$"
            regex_by_country[target_country].append({
                "id": f"regex_{target_country.lower()}_{prefix}",
                "name": f"{rset.get('name', 'Regex Range')} (+{prefix})",
                "ruleType": "regex",
                "pattern": pattern,
                "priority": rset.get("priority", 5),
                "action": rset.get("action", "block"),
                "isEnabled": 1,
            })

        patterns = rset.get("patterns", [])
        for idx, pattern in enumerate(patterns, 1):
            regex_by_country[target_country].append({
                "id": f"regex_{target_country.lower()}_{idx}",
                "name": rset.get("name", "Regulatory Regex"),
                "ruleType": "regex",
                "pattern": pattern,
                "priority": rset.get("priority", 5),
                "action": rset.get("action", "block"),
                "isEnabled": 1,
            })

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

        if rules:
            res = save_chunked_merged_rules(country, rules, filename_prefix="full_block")
            c_name, c_desc, c_flag = resolve_country_i18n_info(country, country_i18n_db)
            s_name = f"{c_name} Spam Blocklist Ruleset"

            generated_rulesets.append({
                "id": f"{country.lower()}_full_block",
                "source_id": f"{country.lower()}_full_block",
                "name": s_name,
                "country_code": country,
                "description": c_desc,
                "icon_url": c_flag,
                "rule_type": "phone_rule",
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
            c_name, c_desc, c_flag = resolve_country_i18n_info(country, country_i18n_db)
            s_name = f"{c_name} Regulatory Regex Ruleset"

            generated_rulesets.append({
                "id": f"{country.lower()}_regulatory_regex",
                "source_id": f"{country.lower()}_regulatory_regex",
                "name": s_name,
                "country_code": country,
                "description": c_desc,
                "icon_url": c_flag,
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
    print("=== 开始运行完全解耦主控规则合并与配置生成脚本 ===")

    cleanup_legacy_l10n()
    country_i18n_db, cn_cat_i18n = load_country_i18n()

    all_rulesets = []

    # 1. 中国区黄页服务号码（黄页标注，action: "none", priority: 0）
    cn_19_rulesets = process_china_19_categories(cn_cat_i18n)
    all_rulesets.extend(cn_19_rulesets)

    # 2. 解耦读取 phone_sources_config.json 与 regex_configs.json 进行合并处理
    other_rulesets = process_decoupled_sources(country_i18n_db)
    all_rulesets.extend(other_rulesets)

    # 3. 写入 app_delta_setup_config.json
    update_app_delta_setup_config(all_rulesets)

    print("\n=== 解耦主控规则合并与配置生成全流程完成 ===")


if __name__ == "__main__":
    main()
