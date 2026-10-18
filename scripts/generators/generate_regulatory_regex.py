#!/usr/bin/env python3
"""
正则规则专用生成脚本 (Regex Rules Generator)

完全独立解耦：仅读取 scripts/configs/regex_configs.json 正则规则专用配置文件，
生成各国家/地区的正则规则 JSON 文件。
"""

import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
REGEX_CONFIG_FILE = SCRIPT_DIR.parent / "configs" / "regex_configs.json"


def generate_regulatory_rules():
    print("\n[开始根据 regex_configs.json 独立生成正则规则...]")

    if not REGEX_CONFIG_FILE.exists():
        print(f"  错误: 配置文件不存在: {REGEX_CONFIG_FILE}")
        return

    try:
        with open(REGEX_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            rulesets = data.get("regex_rulesets", [])
    except Exception as e:
        print(f"  读取正则配置文件失败: {e}")
        return

    for item in rulesets:
        if not item.get("enabled", True):
            continue

        country_code = item.get("country_code", "GLOBAL").upper()
        country_dir = PROJECT_DIR / country_code
        country_dir.mkdir(parents=True, exist_ok=True)
        rules = []

        prefixes = item.get("prefixes", [])
        for prefix in prefixes:
            pattern = f"^\\+?{prefix}\\d{{6}}$"
            rules.append({
                "id": f"regex_{country_code.lower()}_{prefix}",
                "name": f"{item.get('name', 'Regex Range')} (+{prefix})",
                "pattern": pattern,
                "action": item.get("action", "block"),
                "isEnabled": 1,
                "priority": item.get("priority", 5),
                "ruleType": "regex"
            })

        patterns = item.get("patterns", [])
        for idx, pattern in enumerate(patterns, 1):
            rules.append({
                "id": f"regex_{country_code.lower()}_{idx}",
                "name": item.get("name", "Regulatory Regex"),
                "pattern": pattern,
                "action": item.get("action", "block"),
                "isEnabled": 1,
                "priority": item.get("priority", 5),
                "ruleType": "regex"
            })

        if rules:
            out_file = country_dir / f"{country_code.lower()}_regulatory_regex.json"
            if country_code == "IN":
                out_file = country_dir / "trai_140_regex.json"
            elif country_code == "FR":
                out_file = country_dir / "arcep_regex.json"

            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(rules, f, ensure_ascii=False, indent=2)
            print(f"  已生成 [{country_code}] 独立正则规则 ({len(rules)} 条) -> {out_file.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    generate_regulatory_rules()
