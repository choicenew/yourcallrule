#!/usr/bin/env python3
"""
法定号码段正则规则生成脚本 (Regulatory Regex Generator)

生成各国电信监管机构规定的法定营销/电销号段正则规则（如法国 ARCEP、印度 TRAI 140 等）。
遵循 regex_ai_skills_prompt.md 标准生成包含 id, name, pattern, action, isEnabled, priority, ruleType 的 JSON 规则。
"""

import json
import hashlib
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
IN_DIR = PROJECT_DIR / "IN"
FR_DIR = PROJECT_DIR / "FR"


def generate_regulatory_rules():
    IN_DIR.mkdir(parents=True, exist_ok=True)
    FR_DIR.mkdir(parents=True, exist_ok=True)

    print("\n[开始生成法定号码段正则规则...]")

    # 1. 印度 TRAI 140 营销号段规则
    trai_rules = [
        {
            "id": "regulatory_in_trai_140",
            "name": "India TRAI Promotional/Telemarketing Series (140)",
            "pattern": r"^\+?91140\d{7}$",
            "action": "block",
            "isEnabled": 1,
            "priority": 5,
            "ruleType": "regex"
        }
    ]
    trai_file = IN_DIR / "trai_140_regex.json"
    with open(trai_file, "w", encoding="utf-8") as f:
        json.dump(trai_rules, f, ensure_ascii=False, indent=2)
    print(f"  已生成印度 TRAI 140 正则规则到 {trai_file}")

    # 2. 法国 ARCEP 营销号段标准规则
    arcep_ranges = [
        ("33162", "France ARCEP Telemarketing Range (+33162)"),
        ("33163", "France ARCEP Telemarketing Range (+33163)"),
        ("33244", "France ARCEP Telemarketing Range (+33244)"),
        ("33245", "France ARCEP Telemarketing Range (+33245)"),
        ("33377", "France ARCEP Telemarketing Range (+33377)"),
        ("33378", "France ARCEP Telemarketing Range (+33378)"),
        ("33424", "France ARCEP Telemarketing Range (+33424)"),
        ("33425", "France ARCEP Telemarketing Range (+33425)"),
        ("33568", "France ARCEP Telemarketing Range (+33568)"),
        ("33569", "France ARCEP Telemarketing Range (+33569)"),
        ("33937", "France ARCEP Telemarketing Range (+33937)"),
        ("33938", "France ARCEP Telemarketing Range (+33938)"),
        ("33939", "France ARCEP Telemarketing Range (+33939)"),
    ]

    arcep_rules = []
    for prefix, label in arcep_ranges:
        arcep_rules.append({
            "id": f"regulatory_fr_arcep_{prefix}",
            "name": label,
            "pattern": f"^\\+?{prefix}\\d{{6}}$",
            "action": "block",
            "isEnabled": 1,
            "priority": 5,
            "ruleType": "regex"
        })

    arcep_file = FR_DIR / "arcep_regex.json"
    with open(arcep_file, "w", encoding="utf-8") as f:
        json.dump(arcep_rules, f, ensure_ascii=False, indent=2)
    print(f"  已生成法国 ARCEP {len(arcep_rules)} 条正则规则到 {arcep_file}")


if __name__ == "__main__":
    generate_regulatory_rules()
