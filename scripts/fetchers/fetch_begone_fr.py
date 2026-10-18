#!/usr/bin/env python3
"""
法国 BegoneFR 垃圾电话规则下载与转换脚本

下载 BegoneFR XML 规则文件并转换为标准 CSV 覆盖保存至 FR/ processed_fr_regex.csv
"""

import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
import urllib.request
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
FR_DIR = PROJECT_DIR / "FR"
OUT_CSV = FR_DIR / "processed_fr_regex.csv"
BEGONE_XML_URL = "https://raw.githubusercontent.com/oulixalt/BegoneListeFR/refs/heads/Liste-compl%C3%A8te/Begone-FR.xml"


def fetch_begone_fr():
    print("\n[开始下载并解析法国 BegoneFR XML 规则...]")
    FR_DIR.mkdir(parents=True, exist_ok=True)
    temp_xml = FR_DIR / "temp_begone.xml"

    try:
        req = urllib.request.Request(BEGONE_XML_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            with open(temp_xml, "wb") as f:
                f.write(content)

        tree = ET.parse(temp_xml)
        root = tree.getroot()

        rows = []
        numbers = []
        for elem in root.findall(".//dict/key[text()='number']/following-sibling::string[1]"):
            if elem.text:
                numbers.append(elem.text.strip())

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
            df.to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(rows)} 条法国 Begone 正则规则到 {OUT_CSV}")
    except Exception as e:
        print(f"  抓取/解析 BegoneFR XML 失败: {e}")
    finally:
        if temp_xml.exists():
            temp_xml.unlink()


if __name__ == "__main__":
    fetch_begone_fr()
