# 目标参考开源库代码级深度拆解报告 (Target Repositories Deep Code Analysis)

本报告对 6 个目标参考开源库（`CallShield`、`saracroche-android`、`Silence`、`SpamBlocker`、`SpamBlocker-Extended`、`web26-050-call-blocker`）进行了逐文件、逐行级的深度代码审计。

---

## 目录
- [一、 CallShield 源码级核心模块剖析](#一-callshield-源码级核心模块剖析)
- [二、 saracroche-android 源码级核心模块剖析](#二-saracroche-android-源码级核心模块剖析)
- [三、 Silence 源码级核心模块剖析](#三-silence-源码级核心模块剖析)
- [四、 SpamBlocker & SpamBlocker-Extended 源码级核心模块剖析](#四-spamblocker--spamblocker-extended-源码级核心模块剖析)
- [五、 web26-050-call-blocker 源码级核心模块剖析](#五-web26-050-call-blocker-源码级核心模块剖析)
- [六、 针对本 App (`yourcallyourrule`) 的干干净净对比与引入路线](#六-针对本-app-yourcallyourrule-的干干净净对比与引入路线)

---

## 一、 CallShield 源码级核心模块剖析

### 1. `SpamMLScorer.kt` (端侧 20 特征 Gradient-Boosted Trees 机器学习引擎)
- **文件路径**: `临时参考/ref/CallShield/app/src/main/java/com/sysadmindoc/callshield/data/SpamMLScorer.kt` (42.7KB)
- **算法设计**: 纯 Kotlin 实现的微秒级梯度提升树 (GBT v3) 推理引擎，不需要 TFLite 或第三方 heavy ML 依赖库。
- **输入的 20 个本地特征维度**:
  1. `toll_free`: 800/888/877/866/855/844/833 免费号码前缀
  2. `high_spam_npa`: FTC/FCC 高投诉区号集 (202, 213, 310, 323, 347, 404, 415, 512, 617, 646, 702 等)
  3. `voip_range`: 高危 VoIP 运营商号段匹配
  4. `repeated_digits_ratio`: 单个数字出现最高频次占比
  5. `sequential_asc_ratio`: 连续递增数字对占比 (如 12, 23, 34)
  6. `all_same_digit`: 10 位数字完全相同
  7. `nxx_555`: NXX 交换局为 555
  8. `last4_zero`: 后 4 位为 0000
  9. `invalid_nxx`: NXX 以 0 或 1 开头（NANP 非法/伪造区号）
  10. `subscriber_all_same`: 后 4 位数字全同 (如 9999)
  11. `alternating_pattern`: 交替重复模式 (如 5050505050)
  12. `sequential_desc_ratio`: 连续递减数字对占比
  13. `nxx_below_200`: NXX < 200 未分配段
  14. `low_digit_entropy`: 整个号码包含的独立数字少于 4 个
  15. `subscriber_sequential`: 后 4 位完全顺增/顺减 (如 1234, 9876)
  16. `time_of_day_sin`: `sin(2π * hour/24)` 呼叫时间正弦编码
  17. `time_of_day_cos`: `cos(2π * hour/24)` 呼叫时间余弦编码
  18. `geographic_distance`: 区号与本机区号数字差 > 200
  19. `short_number`: 号码位数 < 7 (短码/服务号)
  20. `plus_one_prefix`: 以 +1 开头
- **模型健康自愈与降级机制 (`ModelHealth`)**: `UNINITIALIZED` ➔ `GBT_ACTIVE` ➔ `LR_ACTIVE` (逻辑回归降级) ➔ `PARSE_FAILED` ➔ `DEFAULTS`。当更新的 GBT 模型解包校验哈希失败时，平滑降级至本地默认逻辑回归权重，绝不炸崩服务。

### 2. `SmsContentAnalyzer.kt` (短彩信文本与恶意链接分析器)
- **文件路径**: `临时参考/ref/CallShield/app/src/main/java/com/sysadmindoc/callshield/data/SmsContentAnalyzer.kt` (44.6KB)
- **短链与高危 TLD 集合**:
  - `shortenerDomains`: `bit.ly`, `tinyurl.com`, `t.co`, `goo.gl`, `ow.ly`, `is.gd`, `cutt.ly`, `shorturl.at`, `rb.gy`, `t.ly`, `bl.ink` 等。
  - `suspiciousTlds`: `.xyz`, `.top`, `.club`, `.work`, `.buzz`, `.icu`, `.cam`, `.life`, `.click`, `.link`, `.info`, `.loan`, `.win`, `.bid`, `.gq`, `.ml`, `.tk`, `.cf`, `.ga`, `.pw`。
- **多语言（英语、西班牙语、葡萄牙语、意大利语）短彩信诈骗正则集**:
  - 涵盖金融诱骗 (Won prize / Free cash / Crypto)、紧急恐吓 (Account suspended / Immediate action)、快递拦截 (Package held / Payment pending)、贷款陷阱 (Pre-approved / Debt relief) 等多语种精确正则。

### 3. `CallShieldRedirectionService.kt` (呼出电话重定向防护)
- **文件路径**: `临时参考/ref/CallShield/app/src/main/java/com/sysadmindoc/callshield/service/CallShieldRedirectionService.kt` (9.1KB)
- **工作流与超时控制**:
  - 继承自 `CallRedirectionService`，监听 `onPlaceCall()`。
  - 设置 `DEADLINE_MS = 3_000L` (3 秒超时门限)，避免异步查询超时导致 Telecom 强制挂断。
  - 若匹配到高危黑号或付费陷阱号，调用 `cancelCall()` 并发送带有 "Call Anyway" 操作的通知提醒。

### 4. `ExpectingCallTileService.kt` & `ExpectingCall.kt` (期待电话临时降级豁免)
- **文件路径**: `临时参考/ref/CallShield/app/src/main/java/com/sysadmindoc/callshield/service/ExpectingCallTileService.kt` (3.4KB)
- **逻辑**: 用户一键切换开启 1 小时 / 3 小时 / 截至午夜的降级放行窗口。放行未知号码，但保持显式黑名单的阻断。

---

## 二、 saracroche-android 源码级核心模块剖析

### 1. `PhoneNumberMatcher.kt` (Long 型高效通配匹配引擎)
- **文件路径**: `临时参考/ref/saracroche-android/app/src/main/java/com/cbouvat/android/saracroche/util/PhoneNumberMatcher.kt` (4.9KB)
- **算法设计**: 内部将所有号码转为 `Long` 数字类型进行内存哈希和比对，比传统字符串匹配提升一个数量级的处理速度。
- **`#` 尾随通配符生成机制 (`generateCandidates`)**:
  - 通配符通式: `substring(0, prefixLength) + "#".repeat(length - prefixLength)`。如 `33162######` 匹配所有法国 33162 开头的 11 位号码。

### 2. `SmsNotificationListener.kt` (免 SMS 权限通知级拦截器)
- **文件路径**: `临时参考/ref/saracroche-android/app/src/main/java/com/cbouvat/android/saracroche/service/SmsNotificationListener.kt` (5.4KB)
- **工作流**:
  - 继承自 `NotificationListenerService`，通过 `Telephony.Sms.getDefaultSmsPackage(this)` 获取默认短信包名。
  - 过滤获取 `extras.getString("android.title")` 与 `android.text`，匹配到垃圾短信时调用 `cancelNotification(sbn.key)` 静音消除提醒。**100% 避免申请危险的 `RECEIVE_SMS` 权限**。

---

## 三、 Silence 源码级核心模块剖析

### 1. 多卡 (Multi-SIM) 槽位控制与卡槽开关 (`Preferences.kt` & `CallScreeningService.kt`)
- **文件路径**: `临时参考/ref/Silence/app/src/main/java/me/lucky/silence/Preferences.kt`
- **逻辑**: 使用 `READ_PHONE_NUMBERS` 获取 SIM 1 与 SIM 2 订阅 ID，在 `CallScreeningService` 评估拦截规则前，优先检查当前来电所属卡槽的单独开关 (`SET_SIM_1_ALLOW_ON` / `SET_SIM_2_ALLOW_ON`)。

### 2. Panic Kit 紧急销毁机制 (`PanicResponderActivity.kt`)
- **文件路径**: `临时参考/ref/Silence/app/src/main/java/me/lucky/silence/panic/PanicResponderActivity.kt`
- **逻辑**: 响应 `info.guardianproject.panic.action.TRIGGER` 广播，在危机时刻瞬间重置或清空拦截数据库。

---

## 四、 SpamBlocker & SpamBlocker-Extended 源码级核心模块剖析

### 1. `ComplementNaiveBayes.kt` (端侧朴素贝叶斯机器学习分类器)
- **文件路径**: `临时参考/ref/SpamBlocker/app/src/main/java/spam/blocker/util/ComplementNaiveBayes.kt` (14.5KB)
- **算法设计**:
  - 纯 Kotlin 实现的增量朴素贝叶斯分类器，词表上限 `maxFeatures = 50_000` (模型体量仅 1~2MB)。
  - 支持增量训练与类别动态修正: `addSample()`、`removeSample()`、`changeCategory()`。
  - 将模型权重的概率值序列化为 `CnbModelData` JSON 文件保存于本地。

### 2. 接通挂断麦克风静音 (`MODIFY_AUDIO_SETTINGS`)
- **文件路径**: `临时参考/ref/SpamBlocker-Extended/app/src/main/java/spam/blocker/service/CallScreeningService.kt`
- **逻辑**: 在执行 Answer & Hangup 挂断模式时，提前调用 `audioManager.isMicrophoneMute = true`，挂断后再复位，防止背景音泄露。

---

## 五、 web26-050-call-blocker 源码级核心模块剖析

### 1. 双通道兼容与 `specialUse` 前台服务
- **文件路径**: `临时参考/ref/web26-050-call-blocker/app/src/main/java/com/example/callblocker/core/service/CallBlockerForegroundService.kt`
- **逻辑**: 针对 Android 9 (API 28) 保留 `PHONE_STATE` 广播监听；在 Android 10+ 开启 `CallScreeningService`；同时启动 `foregroundServiceType="specialUse"` (Subtype: `callBlocking`) 前台服务，防止在 MIUI/EMUI 等定制系统中被杀后台。

---

## 六、 针对本 App (`yourcallyourrule`) 的干干净净对比与引入路线

| 参考模块 | 核心代码文件/类 | 本 App (`yourcallyourrule`) 现状 | 引入与整合方案 |
| :--- | :--- | :--- | :--- |
| **端侧 ML 垃圾打分** | `SpamMLScorer.kt` (CallShield) / `ComplementNaiveBayes.kt` (SpamBlocker) | 本 App 目前仅靠 `flutter_js` 脚本正则，缺少端侧 ML 概率打分 | **引入**：将 20 特征 GBT 引擎或朴素贝叶斯打分算法封装为 Dart/Kotlin 本地模块。 |
| **钓鱼链接检测** | `SmsContentAnalyzer.kt` (CallShield) | 本 App 缺失链接安全校验 | **引入**：引入 PhishTank 域名核验与 OpenPhish 离线 TLD 黑名单比对。 |
| **免权限短信拦截** | `SmsNotificationListener.kt` (saracroche) | 本 App 以前因怕下架注释掉了 SMS 权限，导致短信过滤完全失能 | **强烈推荐引入**：新建 `MyNotificationListenerService.kt` 通道。 |
| **呼出防诈重定向** | `CallShieldRedirectionService.kt` (CallShield) | 本 App 仅 Manifest 声明了权限，缺少实现类 | **引入**：新建 `MyCallRedirectionService.kt`。 |
| **期待电话降级 Tile** | `ExpectingCallTileService.kt` (CallShield) | 本 App 缺失放行降级窗口 | **引入**：新建 `ExpectingCallTileService.kt` 快捷图块。 |
| **多 SIM 卡槽控制** | `SimSlotRule.dart` + `SimChecker.kt` | **本 App 已完整实现！** | **已有实现，无需重复引入**。 |

---

*文件位置: `C:\Users\Ngokel\Desktop\en\designed\yourcallrule\TARGET_REPOS_DEEP_CODE_ANALYSIS.md`*
