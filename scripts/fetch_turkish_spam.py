#!/usr/bin/env python3
"""
土耳其黑名单同步脚本

下载 symbuzzer/Turkish-Spam-Numbers 库，覆盖保存至 TR/processed_turkish_spam_numbers.csv
"""

import os
import sys
from pathlib import Path
import urllib.request
import pandas as pd

PROJECT_DIR = Path(__file__).parent.parent
TR_DIR = PROJECT_DIR / "TR"
OUT_CSV = TR_DIR / "processed_turkish_spam_numbers.csv"
TR_SPAM_URL = "https://raw.githubusercontent.com/symbuzzer/Turkish-Spam-Numbers/main/numbers"


def fetch_turkish_spam():
    print("\n[开始同步土耳其黑名单数据...]")
    TR_DIR.mkdir(parents=True, exist_ok=True)

    try:
        df = pd.read_csv(TR_SPAM_URL, header=None, names=['phoneNumber'], on_bad_lines='skip', dtype={'phoneNumber': str})
        df['phoneNumber'] = df['phoneNumber'].astype(str).str.strip()
        df.dropna(subset=['phoneNumber'], inplace=True)
        df = df[df['phoneNumber'] != '']

        if not df.empty:
            df['id'] = df['phoneNumber']
            df['name'] = df['phoneNumber']
            df['action'] = 'block'
            df['priority'] = 3
            df['labelId'] = 'spamlikely'
            df['isEnabled'] = 1
            df['count'] = 0
            df['avatar'] = ''
            df['ruleType'] = 'phone_rule'
            df['subscriptionId'] = 'turkish-spam-weekly'

            final_cols = ['id', 'name', 'action', 'priority', 'phoneNumber', 'labelId', 'isEnabled', 'count', 'avatar', 'ruleType', 'subscriptionId']
            df[final_cols].to_csv(OUT_CSV, index=False)
            print(f"  已保存 {len(df):,} 条土耳其黑名单到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步土耳其黑名单失败: {e}")


if __name__ == "__main__":
    fetch_turkish_spam()
