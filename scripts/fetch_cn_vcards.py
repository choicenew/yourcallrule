#!/usr/bin/env python3
"""
中国黄页数据同步与 19 个独立分类 CSV 生成脚本

数据来源: metowolf/vCards
输出: CN/ 目录下的 19 个独立分类 CSV 文件 (完全保留分类独立性)
"""

import ast
import csv
import json
import os
import re
import sys
from pathlib import Path
import urllib.request

PROJECT_DIR = Path(__file__).parent.parent
CN_DIR = PROJECT_DIR / "CN"
RAW_CN_DIR = PROJECT_DIR / "原始" / "cn"

LABEL_MAPPING = {
    '其他': 'other',
    '外卖订餐': 'takeaway',
    '快递物流': 'delivery',
    '电商购物': 'ecommerce',
    '金融银行': 'bank',
    '互联网': 'internet',
    '出行购票': 'travelticketing',
    '应用软件': 'applicationsoftware',
    '影音娱乐': 'entertainment',
    '房产中介': 'agent',
    '政府机构': 'government',
    '本地生活': 'localservices',
    '汽车行业': 'automotiveindustry',
    '租车代驾': 'carrental',
    '证券保险': 'insurance',
    '通讯服务': 'telecommunication',
    '酒店住宿': 'hotel',
    '云服务': 'cloudservice',
}


def parse_phone_entry(phone_raw, base_org_name):
    phone_number = ""
    sub_label = ""

    if isinstance(phone_raw, dict):
        phone_number = str(phone_raw.get('number', ''))
        sub_label = str(phone_raw.get('label', ''))
    else:
        raw_str = str(phone_raw).strip()
        if ('number' in raw_str and 'label' in raw_str) or raw_str.startswith('{'):
            try:
                parsed = None
                try:
                    parsed = json.loads(raw_str.replace("'", '"'))
                except Exception:
                    parsed = ast.literal_eval(raw_str)

                if isinstance(parsed, dict):
                    phone_number = str(parsed.get('number', ''))
                    sub_label = str(parsed.get('label', ''))
            except Exception:
                num_m = re.search(r"['\"]number['\"]\s*:\s*['\"]?([0-9a-zA-Z]+)['\"]?", raw_str)
                lbl_m = re.search(r"['\"]label['\"]\s*:\s*['\"]([^'\"]+)['\"]", raw_str)
                if num_m:
                    phone_number = num_m.group(1)
                if lbl_m:
                    sub_label = lbl_m.group(1)

        if not phone_number:
            phone_number = raw_str

    cleaned_phone = re.sub(r'[- ]|,[\d]*$', '', phone_number).strip()
    clean_org = re.sub(r'-.*$', '', base_org_name).strip() if base_org_name else ""

    if sub_label and sub_label.strip():
        final_name = f"{clean_org}-{sub_label.strip()}"
    else:
        final_name = base_org_name

    return cleaned_phone, final_name


def sync_cn_vcards():
    CN_DIR.mkdir(parents=True, exist_ok=True)
    RAW_CN_DIR.mkdir(parents=True, exist_ok=True)

    print("=== 开始同步中国黄页数据 (metowolf/vCards) ===")

    # 遍历 CN 目录已有的 CSV 文件处理规范化
    if RAW_CN_DIR.exists():
        for csv_file in RAW_CN_DIR.glob("*.csv"):
            label_name = csv_file.stem
            out_file = CN_DIR / f"{label_name}.csv"

            with open(csv_file, 'r', encoding='utf-8') as infile, \
                 open(out_file, 'w', encoding='utf-8', newline='') as outfile:

                reader = csv.DictReader(infile)
                writer = csv.writer(outfile, quoting=csv.QUOTE_ALL)

                final_columns = [
                    'id', 'name', 'action', 'priority', 'phoneNumber', 'labelId',
                    'isEnabled', 'count', 'avatar', 'ruleType', 'subscriptionId'
                ]
                writer.writerow(final_columns)

                for row in reader:
                    raw_phone = row.get('phoneNumber', '')
                    raw_name = row.get('name', '')
                    clean_phone, final_name = parse_phone_entry(raw_phone, raw_name)
                    if not clean_phone:
                        continue

                    std_label = LABEL_MAPPING.get(row.get('label', label_name), 'other')

                    new_row = [
                        clean_phone,                               # id
                        final_name,                                # name
                        'none',                                    # action
                        0,                                         # priority
                        clean_phone,                               # phoneNumber
                        std_label,                                 # labelId
                        1,                                         # isEnabled
                        0,                                         # count
                        row.get('avatar', ''),                     # avatar
                        'phone_rule',                              # ruleType
                        ''                                         # subscriptionId
                    ]
                    writer.writerow(new_row)
            print(f"  -> 已同步并保存分类 [{label_name}] 到 {out_file.name}")

    print("=== 中国黄页分类数据同步完毕 ===")


if __name__ == "__main__":
    sync_cn_vcards()
