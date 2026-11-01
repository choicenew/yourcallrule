# YourCallYourRule (本应用) 微观功能矩阵与数据源管线 (Data Pipeline) 深度融合规划

本文档针对用户提交的 4 张 UI 截图及 `C:/Users/Ngokel/Desktop/en/designed/yourcallrule` 目录下的完整数据源架构，进行外科手术式的**微观功能点分析**与**全量数据源管线整合规划**。

---

## 目录
- [一、 4 张 UI 截图微观功能点深度解剖](#一-4-张-ui-截图微观功能点深度解剖)
  - [图 1：在线规则订阅与自定义数据源 (Blocklist Subscriptions & Custom URLs)](#图-1在线规则订阅与自定义数据源-blocklist-subscriptions--custom-urls)
  - [图 2：高级检测与防护细节矩阵 (Advanced Screening & Protection)](#图-2高级检测与防护细节矩阵-advanced-screening--protection)
  - [图 3：拦截阻断动作与挂断参数配置 (Block Actions & Handling)](#图-3拦截阻断动作与挂断参数配置-block-actions--handling)
  - [图 4：基于分类的细粒度策略动作矩阵 (Category Call Action Matrix)](#图-4基于分类的细粒度策略动作矩阵-category-call-action-matrix)
- [二、 数据源管线 (Data Pipeline) 整合至 `yourcallrule` 架构](#二-数据源管线-data-pipeline-整合至-yourcallrule-架构)
  - [1. 四大数据块与 `app_delta_setup_config.json` 的标准归一化](#1-四大数据块与-app_delta_setup_configjson-的标准归一化)
  - [2. 动态 JS 查号插件管线与 `app_plugin_setup_config.json`](#2-动态-js-查号插件管线与-app_plugin_setup_configjson)
  - [3. `RuleActionType` 与 `RulePriority` 在领域模型中的完整映射表](#3-ruleactiontype-与-rulepriority-在领域模型中的完整映射表)
- [三、 落地与工程改造清单](#三-落地与工程改造清单)

---

## 一、 4 张 UI 截图微观功能点深度解剖

---

### 图 1：在线规则订阅与自定义数据源 (Blocklist Subscriptions & Custom URLs)

#### 🔍 细节功能点拆解：
1. **预设订阅库管理 (Preset Subscriptions List)**
   - 包含多国开源黑名单订阅（如 `SpamChile` [GPL-2.0]、`Turkish Spam Numbers` [GPL-3.0]、`Lista Hũ` [CC BY-NC-SA 4.0]、`OpenCallShield` 等）。
   - **动态更新监控**: 展示活动号码总数（如 `1514 active`）、上次同步增减量（如 `+14 / -0 last sync`）以及上次更新相对时间（`Last updated: 4 minutes ago`）。
   - **单项控制**: 每个订阅源均有独立开关 (Switch Toggle) 和删除按钮。

2. **自定义 URL 订阅与预览加载 (Custom URL Ingestion)**
   - 支持用户输入任意第三方黑名单 URL（`Blocklist URL`）和可选标签（`Label`）。
   - 提供 **`Preview` (预览)** 按钮：在正式写入本地数据库前拉取元数据，展示规则条数与样本数据，校验格式合法性。
   - 提供 **`Apply` (应用)** 按钮：校验 SHA-256 哈希后解析并持久化至本地 `drift` 数据库。

---

### 图 2：高级检测与防护细节矩阵 (Advanced Screening & Protection)

#### 🔍 细节功能点拆解：
1. **短彩信恶意链接双轨核验 (PhishTank & OpenPhish Link Checkers)**
   - **PhishTank (域名级联网核验)**: 仅向 PhishTank 发送提取出的 URL 域名部分，保护用户敏感上下文隐私。
   - **OpenPhish (端侧离线核验)**: 本地全量黑名单比对，无需任何网络请求，实现 0 隐私泄露。
2. **实时 suspicious 号码在线补全 (Live Caller Enrichment via SkipCalls)**
   - 当本地判定为“低置信度疑似骚扰”时，可选将号码匿名发送至 `SkipCalls` 等在线 API 实时检索最新众包标记。
3. **短信轰炸与频次爆破防护 (SMS Burst Protection)**
   - 自动检测未知发送方在短时间内发送的大量重复/爆破短信，触发临时封禁。
4. **重复来电自动封禁 (Repeat Caller Auto-Block)**
   - 动态设置阈值（如设为 `3 calls` 3 次来电），当非联系人在设定时间内连续呼叫达指定次数时自动升格阻断。
5. **端侧梯度提升树机器学习分类器 (ML Spam Scorer - Gradient Boosted Model)**
   - 在本地无需联网运行轻量级 ML 模型（Gradient-Boosted Classifier），为短彩信与通话记录实时计算 Spam Score（垃圾概率得分）。
6. **数据库号段前缀自动拓展 (Database Prefix Expansion)**
   - 识别同一黑产团伙/呼叫中心号段，自动对数据库中的已知黑号提取相同前缀（如 `+1 800 123 xxxx`）扩展为野生前缀通配规则。
7. **多应用消息通知过滤与证据捕获 (Message Notification Screening & Evidence)**
   - 支持 `Choose screened apps` (多选受保护应用，如 WhatsApp, Telegram, Google Messages)。
   - **`Notification Evidence` (通知证据流)**: 捕捉拦截到的消息样本，便于用户后续审计与离线分析。

---

### 图 3：拦截阻断动作与挂断参数配置 (Block Actions & Handling)

#### 🔍 细节功能点拆解：
1. **无声语音信箱模式 (Silent Voicemail Mode)**
   - 被拦截的呼叫被无声静音转移至语音信箱，主叫方听到正常响铃，但本机保持完全静音。
2. **低置信度自动静音 (Auto-mute Low-confidence Blocks)**
   - 针对得分处于中立临界区的呼叫，自动降级转入语音信箱供事后人工审核。
3. **秒挂模式与防自动外呼自动接断 (Answer & Hang Up Blocked Calls)**
   - **自动接通并立即挂断**: 防止自动外呼机器人 (Autodialer) 留下语音留言。
   - **挂断延时精细调节 (Hang up after X seconds)**: 提供秒级调节选择器（如设为 `1 second`），应对部分电信运营商要求的响应延时。

---

### 图 4：基于分类的细粒度策略动作矩阵 (Category Call Action Matrix)

#### 🔍 细节功能点拆解：
针对已分类的呼叫（如 `Debt collector` 催收、`Political` 政治推销、`Robocall` 自动语音、`Scam` 诈骗、`Phishing` 钓鱼），提供**分类独立的四态处理矩阵**：

| 骚扰分类 (Category) | 动作状态 1: Inherit (继承) | 动作状态 2: Allow (放行) | 动作状态 3: Voicemail (转语音信箱) | 动作状态 4: Block (阻断秒挂) |
| :--- | :--- | :--- | :--- | :--- |
| **Debt collector (催收)** | 继承全局配置 | 强制响铃 | 转无声信箱 | 挂断阻断 |
| **Political (政治宣讲)** | 继承全局配置 | 强制响铃 | 转无声信箱 | 挂断阻断 |
| **Robocall (机器人外呼)** | 继承全局配置 | 强制响铃 | 转无声信箱 | 挂断阻断 |
| **Scam (诈骗高危)** | 继承全局配置 | 强制响铃 | 转无声信箱 | 挂断阻断 |
| **Phishing (钓鱼号段)** | 继承全局配置 | 强制响铃 | 转无声信箱 | 挂断阻断 |

- **最高优先权红线规则**: 紧急联系人 (Emergency contacts) 与用户手动添加的白名单 (Trusted numbers) 永远强制放行响铃；用户显式添加的个人黑名单永远阻断。

---

## 二、 数据源管线 (Data Pipeline) 整合至 `yourcallrule` 架构

在 `C:/Users/Ngokel/Desktop/en/designed/yourcallrule` 仓库中，数据源管线分为**全量规则集**与**动态 JS 插件集**。

---

### 1. 四大数据块与 `app_delta_setup_config.json` 的标准归一化

`yourcallrule` 仓库中的 Python 归一化引擎 (`scripts/mergers/merge_and_deduplicate.py`) 负责将全球数据打包输出并生成 `app_delta_setup_config.json`：

```mermaid
flowchart TD
    A1[数据块 A: CallShield 镜像库 callshield/] --> M[主合并引擎 scripts/mergers/merge_and_deduplicate.py]
    A2[数据块 B: 国家原始 CSV CN/, US/, FR/, TR/] --> M
    A3[数据块 C: 法定号段正则 IN/ TRAI 140, FR/ ARCEP] --> M
    A4[数据块 D: 在线订阅 Lista Hũ, SpamChile 等] --> M

    M --> E1164[libphonenumber E.164 规范化 & 标签映射]
    E1164 --> Hash[计算 SHA-256 哈希校验码]
    Hash --> OutRules[导出 merged_rules/{COUNTRY}/*.json]
    Hash --> OutConfig[更新 app_delta_setup_config.json 索引表]
```

#### `app_delta_setup_config.json` 数据结构全貌：
```json
{
  "config_version": "1.0.0",
  "last_updated": "2026-11-01T12:00:00Z",
  "rulesets": [
    {
      "id": "cn_yellowpage_bank",
      "source_id": "cn_yellowpage_bank",
      "name": "中国 (China) 官方黄页 - 金融银行",
      "country_code": "CN",
      "description": "中国地区官方机构与各大银行金融服务热线号码",
      "icon_url": "https://flagcdn.com/w80/cn.png",
      "rule_type": "phone_rule",
      "full_download_url": "https://raw.githubusercontent.com/choicenew/yourcallrule/main/merged_rules/CN/bank.json",
      "cdn_download_url": "https://cdn.jsdelivr.net/gh/choicenew/yourcallrule@main/merged_rules/CN/bank.json",
      "checksum_sha256": "3a8d11c...",
      "total_rules": 1250,
      "priority": 0,
      "is_enabled": true
    }
  ]
}
```

---

### 2. 动态 JS 查号插件管线与 `app_plugin_setup_config.json`

`yourcallrule` 目录中的 `/plugins` (及 `/plugins html`) 存放使用 `flutter_js` 引擎在 App 端动态运行的抓取解析脚本。

- **`app_plugin_setup_config.json`**:
  - 管理如 `baiduPhoneNumberPlugin` (百度号码反查)、`callfilterPlugin` (CallFilter 反查)、`cleverdialerPlugin` 等。
  - 每个插件配置包含 URL、`checksum_sha256`、版本号与 Regex 抓取规范。
  - App 启动时比对 SHA-256，热更新 JS 插件代码，实现无需更新 App 即可修复查号解析失效。

---

### 3. `RuleActionType` 与 `RulePriority` 在领域模型中的完整映射表

所有由 `yourcallrule` 打包的规则在下载导入 App 的 `drift` 本地数据库时，必须严格遵守以下映射规约：

```dart
enum RuleActionType {
  allow,    // 'allow' - 白名单放行 (Priority: 10)
  block,    // 'block' - 挂断阻断 (Priority: 3 ~ 5)
  silence,  // 'silence' - 无声响铃 (Priority: 1)
  redirect, // 'redirect' - 呼出重定向 (Priority: 5)
  label,    // 'label' - 标记识别 (Priority: 0)
  notify,   // 'notify' - 仅通知 (Priority: 0)
  log,      // 'log' - 仅日志记录 (Priority: 0)
  custom,   // 'custom' - 自定义 (Priority: 2)
  none,     // 'none' - 黄页展示 (Priority: 0)
}
```

---

## 三、 落地与工程改造清单

1. **Flutter UI 侧新增/对齐页面**:
   - `lib/features/settings/presentation/category_action_matrix_sheet.dart`: 分类阻断动作矩阵底部弹窗（对齐截图 4）。
   - `lib/features/settings/presentation/advanced_screening_settings_page.dart`: 高级检测项设置页（PhishTank/OpenPhish、SkipCalls Enrichment、SMS Burst、Repeat Caller 滑块、ML Spam Scorer开关）（对齐截图 2）。
   - `lib/features/subscriptions/presentation/online_rules_subscription_page.dart`: 在线订阅列表与 Preview/Apply 自定义 URL 加载器（对齐截图 1）。

2. **Native Android 侧服务对齐**:
   - `MyCallScreeningService`: 接入 `Answer & Hang Up` 秒挂延时控制器与 `Silent Voicemail` 模式支持。
   - `MyNotificationListenerService`: 接入 `Message notification screening` 与 `Notification evidence` 捕获流。

3. **数据源同步引擎**:
   - 接入 `app_delta_setup_config.json` 与 `app_plugin_setup_config.json` 的自动增量同步器，校验 SHA-256 哈希后解压写入 `drift` SQLite 数据库。

---

*文件位置: `C:\Users\Ngokel\Desktop\en\designed\yourcallrule\DETAILED_FEATURE_AND_DATASOURCE_PIPELINE.md`*
