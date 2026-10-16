---
name: yourcallrule-data-pipeline
description: YourCallYourRule 规则管线维护与扩展 SKILL 指南。包含数据自抓取、分类独立导出、标签对齐、正则生成、规则集订阅索引更新与 GitHub Actions 工作流最佳实践。
---

# YourCallYourRule Data Pipeline & Ruleset Management Skill

本 Skill 文件为 **YourCallYourRule** 项目的标准化维护与自动化扩展指南。任何维护者或 AI 智能体在接手本项目时，均需遵循本指南执行数据抓取、去重归一化、规则集导出与订阅索引更新。

---

## 模块 1：系统架构与四大数据块 (System Architecture)

系统采用分层解耦的模块化数据流：

1. **数据块 A：CallShield 镜像转换包 (`callshield/`)**
   * 由 `callshield/scripts/convert_callshield.py` 转换上游 CallShield 打包好的数据库，独立保存在 `callshield/` 目录中。
2. **数据块 B：国家/地区直接原始数据包 (`CN/`, `US/`, `FR/`, `TR/`)**
   * **中国 (`CN/`)**：包含 19 个完全独立的分类 CSV（`金融银行.csv`, `快递物流.csv` 等），**100% 保持分类独立存留**。
   * **美国 (`US/`)**：`ftc_robocalls.csv` 与 `fcc_processed_data.csv` 全量官方 CSV。
   * **法国 (`FR/`) & 土耳其 (`TR/`)**：包含 BegoneFR、土耳其黑名单 CSV。
3. **数据块 C：法定号码段正则库 (`IN/`, `FR/`)**
   * 法国 ARCEP、印度 TRAI 140 等法定电销号段，独立生成为标准正则规则 (`ruleType: 'regex'`)。
4. **数据块 D：顶层汇总与配置更新 (`scripts/merge_and_deduplicate.py`)**
   * 配置驱动的主合并引擎。统一读取 Raw 数据，进行 E.164 规范化、`predefined_labels.dart` 标签对齐、商标中立化，导出规则至 `merged_rules/` 并自动生成 `app_delta_setup_config.json`。

---

## 模块 2：新增数据源扩展指南 (Zero-YAML & Zero-Code Extension)

本项目支持**无需修改 GitHub Workflows YAML、无需修改 Python 核心代码**的无损新增扩展：

### 扩展步骤：
1. 将新获取的原始 CSV / JSON 文件存入对应国家的文件夹中。
2. 打开 `scripts/source_configs.json`，在 `"sources"` 数组中追加一个数据源配置项：
   ```json
   {
     "source_id": "your_new_source_id",
     "name": "新数据源展示名称",
     "description": "由该数据源自己提供的母语/官方原生描述",
     "enabled": true,
     "type": "directory_csv",
     "path": "数据所在的文件夹相对路径",
     "country_mode": "auto",
     "priority": 3
   }
   ```
3. 运行 `python scripts/merge_and_deduplicate.py`，主脚本会自动扫描新数据源，完成格式化、导出，并在 `app_delta_setup_config.json` 中**自动注册新规则集及其 SHA-256 哈希校验和**。

---

## 模块 3：规则属性与 Flutter 领域模型映射标准 (Domain Model Schema)

所有导出的规则文件（`merged_rules/{COUNTRY}/*.json`）必须严格匹配 Flutter App 端的领域模型：

### 1. 规则动作 (`action`) 与优先级 (`priority`) 对应标准
* **黄页/官方机构标注**：`action: "none"`, `priority: 0` (`RulePriority.noneAction`)
* **静音拦截**：`action: "silence"`, `priority: 1` (`RulePriority.silenceAction`)
* **普通单号黑名单**：`action: "block"`, `priority: 3` (`RulePriority.blockAction` / `belowMedium`)
* **24h 社区热点 & 法定号段正则**：`action: "block"`, `priority: 5` (`RulePriority.medium`)
* **白名单/放行规则**：`action: "allow"`, `priority: 10` (`RulePriority.high`)

### 2. 规则类型 (`ruleType`) 标准取值
* `'phone_rule'`：普通单号规则
* `'regex'`：号码正则表达式规则
* `'allow_block'`：允许/阻断规则
* `'sim_slot'`：卡槽规则
* `'sms_regex'`：短信正则规则

### 3. 分类 Key (`labelId`) 对齐规范
必须映射至 `predefined_labels.dart` 支持的标准标签：
`bank`, `delivery`, `ecommerce`, `takeaway`, `internet`, `travelticketing`, `applicationsoftware`, `entertainment`, `agent`, `government`, `localservices`, `automotiveindustry`, `carrental`, `insurance`, `telecommunication`, `hotel`, `cloudservice`, `other`, `telemarketing`, `collection`, `robocall`, `spamlikely`, `scamslikely`, `risk`。

---

## 模块 4：中国区 (CN) 差异化规则生成逻辑

* **数据 1（中国 19 个独立黄页分类）**：
  * 读取 `CN/*.csv` 全部 19 个分类。
  * 保持 19 个分类各自完全独立存留，分别导出为 `merged_rules/CN/bank.json`, `delivery.json`, `ecommerce.json` ...
  * 标注属性：`action: "none"`, `priority: 0`, `ruleType: "phone_rule"`。
  * 在 `app_delta_setup_config.json` 中独立注册为 19 个独立规则集（`cn_yellowpage_bank`, `cn_yellowpage_delivery` ...）。
* **数据 2（中国骚扰黑名单大列表）**：
  * 国际多源数据中归属于 `+86` 的骚扰电话，导出为 `merged_rules/CN/full_block.json`（`action: "block"`, `priority: 3`）。
  * 在 `app_delta_setup_config.json` 中独立注册为 `cn_full_block`。

---

## 模块 5：动态国家代码解析 (`libphonenumber`)

* 主脚本在处理非中国区号码时，禁止硬编码有限的国家列表。
* 统一使用 Google 官方 `phonenumbers`（libphonenumber）解析库：
  `phonenumbers.region_code_for_number(parsed)` 动态获取 200+ 国家和地区的 ISO 代码（`US`, `FR`, `DE`, `ES`, `IN`, `BR`, `JP`, `KR`, `RU`, `AU` 等），动态创建并导出至 `merged_rules/{COUNTRY}/`。

---

## 模块 6：`app_delta_setup_config.json` 自动更新标准

生成的根目录配置文件必须完全对齐 Flutter 端 `CountryData` 数据结构：
```json
{
  "id": "cn_yellowpage_bank",
  "source_id": "cn_yellowpage_bank",
  "name": "中国黄页 - 金融银行",
  "country_code": "CN",
  "description": "中国地区官方机构与企业黄页服务号码 (金融银行)",
  "icon_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/icons/cn.png",
  "rule_type": "phone_rule",
  "full_download_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/CN/bank.json",
  "cdn_download_url": "https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/CN/bank.json",
  "checksum_sha256": "3a8d11c...",
  "total_rules": 1250,
  "priority": 1,
  "is_enabled": true
}
```

---

## 模块 7：GitHub Actions 工作流与调度规范

* **主工作流**：`.github/workflows/update_all_rules.yml`。
* **最佳空闲 Cron 表达式**：`cron: '37 7 * * *'`（07:37 UTC / 北京时间 15:37 / 美国太平洋时间前一日 23:37）。
  * 使用非整点 `:37` 避开 GitHub Actions 全球服务器拥堵高峰。
  * 确保美国 FTC/FCC 官方前一日全量 CSV 均已完全归档发布。
* **全过程单线串行执行**：数据抓取 -> 社区热点计算 -> 归一化合并 -> 生成配置 -> 单次推送，彻底消除 Actions 资源滥用与 Git commit/push 竞态冲突。
