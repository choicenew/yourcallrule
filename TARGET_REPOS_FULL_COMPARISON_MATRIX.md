# 本应用 (Your Call Your Rule) vs 目标参考库全量功能与数据源对比分析矩阵 (Full Comparison Matrix)

本文档针对 6 个**目标参考开源库**（`CallShield`、`saracroche-android`、`Silence`、`SpamBlocker`、`SpamBlocker-Extended`、`web26-050-call-blocker`），与我们的应用 **Your Call Your Rule (`yourcallyourrule`)** 进行干干净净、无遗漏的**功能对比**、**数据源对比**与 **Google Play 合规性审查**。

---

## 一、 核心功能对比矩阵表 (Feature Comparison)

| 核心功能分类 | 细分微观功能点 | 目标参考库实现情况 | 本应用 (`yourcallyourrule`) 真实代码现状 | 对比评估结论与引入建议 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 呼入拦截与响应动作** | **`CallScreeningService` 拦截** | 全库支持 | ✅ 已实现 (`MyCallScreeningService.kt`) | 保持 |
| | **Android 9 降级通道** (`PHONE_STATE`) | `web26-050-call-blocker` 支持 | ✅ 已实现 (`CallerIdChannelHandler.kt`) | 保持双通道兼容 |
| | **接通即挂断 (`ANSWER_THEN_HANGUP`)** | `SpamBlocker`, `web26-050` 支持 | ✅ 已实现 (`CallAction.ANSWER_THEN_HANGUP`) | 保持 |
| | **挂断前静音麦克风** | `SpamBlocker-Extended` 支持 | ❌ **本 App 缺失** | **可优化**（防止接通瞬间泄露环境音） |
| | **无声转语音信箱 (Silent Voicemail)** | `CallShield`, `SpamBlocker` 支持 | ❌ **本 App 缺失** | **需引入**（允许阻断电话留言） |
| | **低置信度自动静音转信箱** | `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（疑虑呼叫降级留言供审核） |
| **2. 呼出防诈重定向** | **呼出重定向角色** (`ROLE_CALL_REDIRECTION`) | `CallShield` 支持 | ⚠️ **仅 Manifest 声明，无类实现** | **需引入**（新建 `MyCallRedirectionService`） |
| | **高危/付费号拦截与 "Call Anyway" 确认** | `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（弹出二次拨号确认弹窗） |
| **3. 短彩信/RCS 垃圾过滤** | **免 SMS 权限通知级拦截** | `saracroche`, `CallShield` 支持 | ❌ **本 App 缺失** (以前因怕被下架直接停用了 SMS) | **强烈推荐引入**（新建 `MyNotificationListenerService`） |
| | **短信轰炸防护 (SMS Burst Protection)** | `SpamBlocker`, `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（短时间频次爆破自动防御） |
| | **RCS/WhatsApp/Telegram 通知筛选** | `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（扩展通知拦截受保护应用） |
| **4. 高级检测与防护** | **PhishTank (域名级) / OpenPhish (离线) 校验**| `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（短彩信/通知内钓鱼链接安全校验） |
| | **SkipCalls 实时补全 (Live Enrichment)** | `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（低置信度呼叫发起在线 API 校验） |
| | **端侧 ML 垃圾打分器 (ML Spam Scorer)** | `SpamBlocker`, `CallShield` 支持 | ❌ **本 App 仅有 JS 脚本，缺失端侧 ML 打分** | **需引入**（端侧朴素贝叶斯/Gradient Boost打分） |
| | **数据库号段前缀扩展 (Prefix Expansion)** | `SpamBlocker`, `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（自动提取骚扰号段通配前缀） |
| | **重复来电阈值自动封禁 (Repeat Caller)** | `SpamBlocker`, `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（设为 N 次未接通自动封禁） |
| **5. 用户控制与模式** | **“期待电话 (Expecting Call)”临时豁免 Tile** | `CallShield` 支持 | ❌ **本 App 缺失** | **需引入**（1h/3h/午夜未知号放行快捷 Tile） |
| | **多卡 (Multi-SIM) 槽位独立策略规则** | `Silence`, `SpamBlocker` 支持 | ✅ **本 App 已完整支持！**<br>(`SimSlotRule.dart` + `SimChecker.kt` + `com.yours.yourcallyourrule/sim_check`) | **已有成熟实现，无需再从外部引入** |
| | **开机锁屏前拦截 (`directBootAware="true"`)**| `CallShield`, `web26-050` 支持 | ❌ **本 App 缺失** | **需引入**（配置开启 `directBootAware`） |
| | **分类策略动作矩阵 (Category Action Matrix)**| `CallShield`, `SpamBlocker` 支持 | ❌ **本 App 缺失** | **需引入**（提供 Debt/Scam 等四态面板） |
| | **悬浮窗 Caller ID 展示** | `SpamBlocker`, `CallShield` 支持 | ✅ 已实现 (`floating_window_android`) | 保持 |
| | **桌面小组件 (Glance AppWidgets)** | `CallShield`, `Silence` 支持 | ✅ 已实现 (3 个 Glance 组件) | 保持 |

---

## 二、 数据源与数据管线对比矩阵表 (Data Sources & Pipeline Comparison)

| 数据源类型与管线模块 | 目标参考库数据源现状 | 本应用 (`yourcallyourrule`) 数据源现状 | 差异与整合方案 |
| :--- | :--- | :--- | :--- |
| **1. 全球开源黑名单订阅包** | 包含 `SpamChile` (GPL-2.0)、`Turkish Spam Numbers` (GPL-3.0)、`Lista Hũ` (CC BY-NC-SA)、`OpenCallShield` 等 | 存储于 `yourcallrule/CN`, `US`, `FR`, `TR` 原始目录下，通过 `scripts/mergers/merge_and_deduplicate.py` 合并 | **完整覆盖**：`yourcallrule` 的归一化引擎已全量合并上述数据源并导出至 `merged_rules/`。 |
| **2. 在线规则索引与配置** | `CallShield` 使用 `DataStore` 管理订阅 URL | 本 App 使用 **`app_delta_setup_config.json`** 进行全量规则注册，支持 SHA-256 哈希比对 | **本 App 架构更优**：引入基于 SHA-256 的增量补丁解析机制。 |
| **3. 动态查号 JS 插件库** | `SpamBlocker` 使用 Kotlin 硬编码 Web 抓取 | 本 App 使用 **`app_plugin_setup_config.json` + `flutter_js`**（支持 Baidu, CallFilter, CleverDialer 等） | **本 App 架构更优**：支持热插拔 JS 插件在线修复。 |
| **4. 官方黄页与识别数据** | `saracroche` 使用法国 Bloctel / ARCEP 数据 | 本 App 包含中国 19 个独立黄页分类（`CN/*.csv`）、美国 FTC/FCC 全量 CSV、法国 ARCEP、印度 TRAI 140 | **本 App 覆盖更全**：保持 19 个分类独立存留并打上 `action: 'none'` 仅做识别。 |

---

## 三、 Google Play 商店合规性全量审查表 (Play Store Compliance)

| 拟引入/现有功能模块 | 涉及权限 / API | 目标参考库机制 | Google Play 合规评估结论 | 本 App 合规落地说明 |
| :--- | :--- | :--- | :--- | :--- |
| **来电拦截** | `BIND_SCREENING_SERVICE` | `CallScreeningService` | ✅ **100% 合规** (`ROLE_CALL_SCREENING`) | 保持 `MyCallScreeningService` |
| **呼出防诈重定向** | `BIND_CALL_REDIRECTION_SERVICE` | `CallRedirectionService` | ✅ **100% 合规** (`ROLE_CALL_REDIRECTION`) | 新建 `MyCallRedirectionService` |
| **短信/RCS 垃圾过滤** | `BIND_NOTIFICATION_LISTENER_SERVICE` | `NotificationListenerService` | ✅ **100% 合规** (免除危险 SMS 权限) | 新建 `MyNotificationListenerService` |
| **期待电话降级 Tile** | `BIND_QUICK_SETTINGS_TILE` | `TileService` | ✅ **100% 合规** | 新建 `ExpectingCallTileService` |
| **PhishTank 域名核验** | `INTERNET` | 域名级 HTTPS POST | ✅ **100% 合规** (需隐私政策声明) | 引入链接安全核验模块 |
| **OpenPhish 本地核验** | 无 | 本地离线比对 | ✅ **100% 合规** (0 联网 0 隐私风险) | 引入离线钓鱼库 |

---

*文件位置: `C:\Users\Ngokel\Desktop\en\designed\yourcallrule\TARGET_REPOS_FULL_COMPARISON_MATRIX.md`*
