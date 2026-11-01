#!/usr/bin/env python3
"""
法国 BegoneFR 垃圾电话规则下载与转换脚本

下载 BegoneFR XML (plist 格式) 规则文件，解析 number 字段，
转写为标准号段正则 CSV，保存至 FR/processed_fr_regex.csv
"""

import os
import plistlib
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import urllib.request
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
FR_DIR = PROJECT_DIR / "FR"
RAW_FR_DIR = PROJECT_DIR / "raw_data" / "FR"
OUT_CSV = FR_DIR / "processed_fr_regex.csv"
BEGONE_XML_URL = "https://raw.githubusercontent.com/oulixalt/BegoneListeFR/refs/heads/Liste-compl%C3%A8te/Begone-FR.xml"


def fetch_begone_fr():
    print("\n[开始下载并解析法国 BegoneFR XML 规则...]")
    FR_DIR.mkdir(parents=True, exist_ok=True)
    RAW_FR_DIR.mkdir(parents=True, exist_ok=True)
    temp_xml = FR_DIR / "temp_begone.xml"

    try:
        req = urllib.request.Request(BEGONE_XML_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()

        with open(temp_xml, "wb") as f:
            f.write(content)

        # 原始未加工 XML 留存备份
        raw_xml_file = RAW_FR_DIR / "begone_fr_raw.xml"
        with open(raw_xml_file, "wb") as rf:
            rf.write(content)

        numbers = []

        # 1. 尝试使用 plistlib 快速解析 plist 格式 XML
        try:
            plist_data = plistlib.loads(content)
            if isinstance(plist_data, list):
                for item in plist_data:
                    if isinstance(item, dict) and "number" in item:
                        numbers.append(str(item["number"]).strip())
        except Exception:
            pass

        # 2. 兼容使用 ElementTree 标准节点遍历 (免 XPath predicate 报错)
        if not numbers:
            tree = ET.parse(temp_xml)
            root = tree.getroot()
            for dict_elem in root.findall(".//dict"):
                keys = [k.text.strip() for k in dict_elem.findall("key") if k.text]
                strings = [s.text.strip() for s in dict_elem.findall("string") if s.text]
                for k, s in zip(keys, strings):
                    if k == "number" and s:
                        numbers.append(s)

        rows = []
        for num in numbers:
            pattern = re.sub(r'\+', '', num)
            pattern = re.sub(r'#', '.*', pattern)
            pattern = f"^33{pattern}$"
            rows.append({
                "id": pattern,
                "name": f"Block numbers matching {pattern[:-1]}",
                "priority": 3,
                "action": "block",
                "pattern": pattern,
                "isEnabled": 1,
                "subscriptionId": "begone-fr-regex",
                "ruleType": "regex"
            })

        if rows:
            df = pd.DataFrame(rows)
            df.drop_duplicates(subset=["pattern"], inplace=True)
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(rows):,} 条法国 Begone 正则规则到 {OUT_CSV}")
    except Exception as e:
        print(f"  抓取/解析 BegoneFR XML 异常: {e}")
    finally:
        if temp_xml.exists():
            temp_xml.unlink()


if __name__ == "__main__":
    fetch_begone_fr()
