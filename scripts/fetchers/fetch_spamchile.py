#!/usr/bin/env python3
"""
SpamChile 智利社区黑名单同步脚本

从 SpamChile 官方 GitHub 仓库下载 ChileSpam.csv，
导出归一化保存至 CL/processed_spamchile.csv
"""

import os
import sys
from pathlib import Path
import urllib.request
import pandas as pd

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
CL_DIR = PROJECT_DIR / "CL"
OUT_CSV = CL_DIR / "processed_spamchile.csv"
SPAMCHILE_URL = "https://raw.githubusercontent.com/racuna/SpamChile/main/ChileSpam.csv"


def fetch_spamchile():
    print("\n[开始同步 SpamChile 智利黑名单数据...]")
    CL_DIR.mkdir(parents=True, exist_ok=True)

    try:
        df = pd.read_csv(SPAMCHILE_URL, on_bad_lines="skip", dtype=str)
        phone_col = None
        for col in df.columns:
            if "phone" in col.lower() or "number" in col.lower() or "telefono" in col.lower():
                phone_col = col
                break

        if phone_col is None and len(df.columns) > 0:
            phone_col = df.columns[0]

        if phone_col:
            df.rename(columns={phone_col: "phoneNumber"}, inplace=True)
            df["phoneNumber"] = df["phoneNumber"].astype(str).str.replace(r"[^\d+]", "", regex=True).str.strip()
            df.dropna(subset=["phoneNumber"], inplace=True)
            df = df[df["phoneNumber"] != ""]

            if not df.empty:
                df["id"] = df["phoneNumber"]
                df["name"] = "Spam Call (Chile)"
                df["action"] = "block"
                df["priority"] = 3
                df["labelId"] = "spamlikely"
                df["isEnabled"] = 1
                df["count"] = 1
                df["avatar"] = ""
                df["ruleType"] = "phone_rule"
                df["subscriptionId"] = "spamchile-cl"

                final_cols = ["id", "name", "action", "priority", "phoneNumber", "labelId", "isEnabled", "count", "avatar", "ruleType", "subscriptionId"]
                df[final_cols].drop_duplicates(subset=["phoneNumber"]).to_csv(OUT_CSV, index=False)
                print(f"  已保存 {len(df):,} 条 SpamChile 智利记录到 {OUT_CSV}")
    except Exception as e:
        print(f"  同步 SpamChile 智利黑名单失败: {e}")


if __name__ == "__main__":
    fetch_spamchile()
