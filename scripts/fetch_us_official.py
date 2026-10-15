#!/usr/bin/env python3
"""
美国官方全量数据获取脚本 (FTC & FCC)

直接下载官方全量每日 CSV，保存至 US/ 目录，保证数据最高全量度。
"""

import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import urllib.request
import pandas as pd
import phonenumbers

PROJECT_DIR = Path(__file__).parent.parent
US_DIR = PROJECT_DIR / "US"
FTC_OUT_CSV = US_DIR / "ftc_robocalls.csv"
FCC_OUT_CSV = US_DIR / "fcc_processed_data.csv"

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def format_us_phone_number(number):
    try:
        parsed_number = phonenumbers.parse(str(number), "US")
        if phonenumbers.is_valid_number(parsed_number):
            return phonenumbers.format_number(parsed_number, phonenumbers.PhoneNumberFormat.E164)
    except Exception:
        pass
    return None


def fetch_ftc_full_csv():
    print("\n[开始下载美国 FTC 全量每日 CSV 数据...]")
    US_DIR.mkdir(parents=True, exist_ok=True)

    downloaded_file = US_DIR / "temp_ftc.csv"
    success = False

    for i in range(1, 6):
        target_date = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        url = f"https://www.ftc.gov/sites/default/files/DNC_Complaint_Numbers_{target_date}.csv"
        print(f"  尝试下载 {target_date} FTC CSV: {url}")

        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer": "https://www.ftc.gov/"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                content = resp.read()
                if len(content) > 100:
                    with open(downloaded_file, "wb") as f:
                        f.write(content)
                    success = True
                    print(f"  成功下载 FTC CSV ({len(content)} 字节)")
                    break
        except Exception as e:
            print(f"  下载失败: {e}")

    if not success or not downloaded_file.exists():
        print("  未能成功获取最新 FTC CSV，退出")
        return

    try:
        df = pd.read_csv(downloaded_file, encoding='utf-8', on_bad_lines='skip')
        if 'Company_Phone_Number' in df.columns:
            df.rename(columns={'Company_Phone_Number': 'phoneNumber'}, inplace=True)
            df.dropna(subset=['phoneNumber'], inplace=True)
            df['phoneNumber'] = df['phoneNumber'].astype(str).str.replace(r"\.0$", "", regex=True).str.strip()
            df['phoneNumber'] = df['phoneNumber'].apply(format_us_phone_number)
            df.dropna(subset=['phoneNumber'], inplace=True)
            df.drop_duplicates(subset=['phoneNumber'], inplace=True)

            if not df.empty:
                df['id'] = df['phoneNumber']
                df['name'] = 'Robocall'
                df['action'] = 'block'
                df['priority'] = 3
                df['labelId'] = 'robocall'
                df['isEnabled'] = 1
                df['count'] = 0
                df['avatar'] = ''
                df['ruleType'] = 'phone_rule'
                df['subscriptionId'] = 'us-ftc-robocall-daily'

                final_cols = ['id', 'name', 'action', 'priority', 'phoneNumber', 'labelId', 'isEnabled', 'count', 'avatar', 'ruleType', 'subscriptionId']
                df[final_cols].to_csv(FTC_OUT_CSV, index=False)
                print(f"  已成功保存 {len(df):,} 条 FTC 记录到 {FTC_OUT_CSV}")
    except Exception as e:
        print(f"  解析 FTC CSV 出现异常: {e}")
    finally:
        if downloaded_file.exists():
            downloaded_file.unlink()


def fetch_fcc_full_csv():
    print("\n[开始下载美国 FCC 官方 CSV 数据...]")
    US_DIR.mkdir(parents=True, exist_ok=True)
    downloaded_file = US_DIR / "temp_fcc.csv"
    url = "https://fccprod.servicenowservices.com/api/x_g_fmc_rmd/rmd/csv_download"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=60) as resp:
            content = resp.read()
            with open(downloaded_file, "wb") as f:
                f.write(content)
            print(f"  成功下载 FCC CSV ({len(content)} 字节)")

        df = pd.read_csv(downloaded_file)
        if 'business_name' in df.columns and 'contact_telephone_number' in df.columns:
            df = df[['business_name', 'contact_telephone_number']]
            df.rename(columns={'business_name': 'name', 'contact_telephone_number': 'phoneNumber'}, inplace=True)
            df.dropna(subset=['phoneNumber', 'name'], inplace=True)

            df['phoneNumber'] = df['phoneNumber'].astype(str).str.replace(r"[\.']", "", regex=True).str.strip()
            df['name'] = df['name'].astype(str).str.replace(r'[\",./]', '', regex=True).str.strip()
            df['phoneNumber'] = df['phoneNumber'].apply(format_us_phone_number)
            df.dropna(subset=['phoneNumber'], inplace=True)
            df.drop_duplicates(subset=['phoneNumber'], inplace=True)

            if not df.empty:
                df['id'] = df['phoneNumber']
                df['action'] = 'none'
                df['priority'] = 0
                df['labelId'] = 'telemarketing'
                df['isEnabled'] = 1
                df['count'] = 0
                df['avatar'] = ''
                df['ruleType'] = 'phone_rule'
                df['subscriptionId'] = ''

                final_cols = ['id', 'name', 'action', 'priority', 'phoneNumber', 'labelId', 'isEnabled', 'count', 'avatar', 'ruleType', 'subscriptionId']
                df[final_cols].to_csv(FCC_OUT_CSV, index=False)
                print(f"  已成功保存 {len(df):,} 条 FCC 记录到 {FCC_OUT_CSV}")
    except Exception as e:
        print(f"  下载/解析 FCC CSV 失败: {e}")
    finally:
        if downloaded_file.exists():
            downloaded_file.unlink()


if __name__ == "__main__":
    fetch_ftc_full_csv()
    fetch_fcc_full_csv()
