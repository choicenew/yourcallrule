#!/usr/bin/env python3
"""
自动扫描 plugins html/ 目录下的全部 JS 插件，解析提取 PLUGIN_CONFIG 元数据，
并自动生成根目录下的 app_plugin_setup_config.json 插件订阅配置文件。
"""

import hashlib
import json
import os
import re
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
PLUGINS_DIR = PROJECT_DIR / "plugins html"
CONFIG_FILE = PROJECT_DIR / "app_plugin_setup_config.json"


def compute_file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def detect_country_code(filename: str, js_content: str) -> str:
    # 1. 尝试从 JS 代码里的 countryCode 字段抓取
    country_m = re.search(r"countryCode\s*:\s*['\"]([^'\"]+)['\"]", js_content, re.IGNORECASE)
    if country_m:
        val = country_m.group(1).strip().upper()
        if len(val) == 2:
            return val

    # 2. 根据文件名及代码中的关键关键词判断国家/地区
    fn_upper = filename.upper()
    if any(k in fn_upper for k in ("_CN", " CN", "BAIDU", "BD", "SOGOU", "SOO", "CHINESE")):
        return "CN"
    if "US" in fn_upper or "USPHONEBOOK" in fn_upper:
        return "US"
    if "FR" in fn_upper or "DOISJE" in fn_upper:
        return "FR"
    if "DE" in fn_upper:
        return "DE"
    if "ES" in fn_upper or "LISTASPAM" in fn_upper:
        return "ES"
    if "JP" in fn_upper or "JPNUMBER" in fn_upper or "TELNAVI" in fn_upper or "MEIWAKU" in fn_upper:
        return "JP"
    if "RU" in fn_upper:
        return "RU"
    if "UK" in fn_upper or "ODEBRACTELEFON" in fn_upper:
        return "UK"
    if "HK" in fn_upper or "TW" in fn_upper or "MO" in fn_upper:
        return "HK"
    if "MY" in fn_upper or "ID" in fn_upper:
        return "MY"
    if "AR" in fn_upper:
        return "AR"
    if "AT" in fn_upper:
        return "AT"

    return "GLOBAL"


def parse_js_plugin_file(file_path: Path) -> dict | None:
    filename = file_path.name
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"  错误读取文件 {filename}: {e}")
        return None

    # 匹配 PLUGIN_CONFIG 结构
    id_m = re.search(r"id\s*:\s*['\"]([^'\"]+)['\"]", content)
    name_m = re.search(r"name\s*:\s*['\"]([^'\"]+)['\"]", content)
    version_m = re.search(r"version\s*:\s*['\"]([^'\"]+)['\"]", content)
    desc_m = re.search(r"description\s*:\s*['\"]([^'\"]+)['\"]", content)

    source_id = id_m.group(1) if id_m else filename.replace('.js', '').replace(' ', '_')
    name = name_m.group(1) if name_m else filename.replace('.js', '')
    version = version_m.group(1) if version_m else "1.0.0"
    description = desc_m.group(1) if desc_m else f"JS Lookup Plugin for {name}"
    country_code = detect_country_code(filename, content)

    # 对文件名做安全的 URL Encode (处理文件名中的空格，如 "bd action copy.js" -> "bd%20action%20copy.js")
    encoded_filename = urllib.parse.quote(filename)
    full_url = f"https://raw.githubusercontent.com/choicenew/yourcallrule/main/plugins%20html/{encoded_filename}"
    sha256 = compute_file_sha256(file_path)

    return {
        "source_id": source_id,
        "name": name,
        "country_code": country_code,
        "rule_type": "plugin",
        "full_download_url": full_url,
        "checksum_sha256": sha256,
        "version": version,
        "description": description,
        "is_enabled": True
    }


def generate_app_plugin_setup_config():
    print("=== 开始自动生成 app_plugin_setup_config.json 插件订阅配置 ===")

    if not PLUGINS_DIR.exists():
        print(f"  错误: 找不到目录 {PLUGINS_DIR}")
        return

    rulesets = []
    seen_ids = set()

    # 递归遍历 plugins html/ 目录下的全部 .js 文件
    for js_file in sorted(PLUGINS_DIR.glob("**/*.js")):
        if js_file.is_file():
            item = parse_js_plugin_file(js_file)
            if item:
                # 确保 id 不重复（如果遇到副本同名 id，加后缀标识）
                sid = item["source_id"]
                if sid in seen_ids:
                    item["source_id"] = f"{sid}_{js_file.stem.replace(' ', '_')}"
                seen_ids.add(item["source_id"])

                rulesets.append(item)
                print(f"  -> 已解析插件: [{item['country_code']}] {item['name']} ({item['source_id']}) v{item['version']}")

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    config_payload = {
        "config_version": "1.0.0",
        "last_updated": now_iso,
        "rulesets": rulesets
    }

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_payload, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 成功生成全自动插件配置文件: {CONFIG_FILE.name} (共计 {len(rulesets)} 个 JS 插件)")


if __name__ == "__main__":
    generate_app_plugin_setup_config()
