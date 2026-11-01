# 目标参考库全量功能核查审计报告 (Feature-by-Feature Audit Report)

本报告对 6 个目标参考开源库（`CallShield`、`saracroche-android`、`Silence`、`SpamBlocker`、`SpamBlocker-Extended`、`web26-050-call-blocker`）的**每一个具体功能**进行了逐一核查，并与我们应用 **Your Call Your Rule (`yourcallyourrule`)** 的源代码现状进行了精确分类比对（分为：【我们没有的】、【我们已经做了的】、【我们做了但有差距的】三类）。

---

## 一、 `CallShield` (`SysAdminDoc/CallShield`) 功能逐一剖析

| 功能名称 | 功能详细定义与工作机制 | 本 App (`yourcallyourrule`) 现状状态 | 代码事实与对比说明 |
| :--- | :--- | :--- | :--- |
| **1. 呼出防诈重定向 (`CallRedirectionService`)** | 使用 `ROLE_CALL_REDIRECTION` 角色，在呼出电话拨出前拦截比对高危/付费/诈骗号码，若匹配则挂起并弹出 "Call Anyway" 确认通知。 | ❌ **我们没有 (Missing)** | 我们仅在 Manifest 中声明了权限，无 Native 类实现，缺少呼出防诈能力。 |
| **2. “期待电话” 降级放行 Tile (`ExpectingCallTileService`)** | 提供 Quick Settings 快捷开关，开启 1h/3h/午夜临时豁免期，放行未知号码响铃，但保持显式黑名单阻断。 | ❌ **本 App 缺失** | 我们缺少临时放行降级窗口与对应的 Tile 控制器。 |
| **3. 免 SMS 权限通知级拦截 (`RcsNotificationListener`)** | 基于 `NotificationListenerService` 监听默认短信、WhatsApp、Telegram 等消息通知，匹配垃圾规则时调用 `cancelNotification` 隐蔽消除通知。 | ❌ **本 App 缺失** | 我们之前因为怕被 Play 商店下架而注释了 SMS 权限，导致短彩信拦截失能，急需引入此免权限方案。 |
| **4. 端侧 20 特征 GBT 机器学习打分 (`SpamMLScorer`)** | 在纯 Kotlin 下利用 20 个本地特征（如免费前缀、高投诉区号、连号比例、叫号时刻 sin/cos 编码等）运行梯度提升树 (GBT) 模型推导 Spam Score。 | ❌ **本 App 缺失** | 我们仅有 `flutter_js` 脚本与本地正则，缺少端侧 ML 概率打分模型。 |
| **5. 短彩信钓鱼链接与短链分析 (`SmsContentAnalyzer`)** | 分析文本中的短链 (`bit.ly` 等) 和高危 TLD (`.xyz`, `.icu` 等)，结合多语言 (英/西/葡/意) 诈骗正则评估钓鱼风险。 | ❌ **本 App 缺失** | 我们缺少文本短链提取与 TLD 安全校验库。 |
| **6. 防 ReDoS 正则算力树 (`BacktrackingPaths`)** | 计算正则表达式的回溯路径数，拒绝算力超过 $10^6$ 或包含 `(a+)+` 灾难性回溯的坏正则，防止主拦截线程卡死。 | ❌ **本 App 缺失** | 我们的正则匹配依赖 Dart 标准正则，未加算力树与回溯死锁防御。 |
| **7. 开机锁屏前拦截 (`directBootAware`)** | 声明 `directBootAware="true"`，在手机重启未解锁 PIN 码前即可加载黑名单拦截服务。 | ❌ **本 App 缺失** | 我们的 `MyCallScreeningService` 尚未开启 `directBootAware="true"`。 |
| **8. 接通即挂断 (`ANSWER_THEN_HANGUP`)** | 拦截时先接通再挂断破坏外呼机器人。 | ⚠️ **我们做了但有差距 (Gap)** | 我们已有 `CallAction.ANSWER_THEN_HANGUP`，但缺乏挂断前麦克风静音保护，且清理标志依赖简单的 `handler.postDelayed`。 |
| **9. STIR/SHAKEN 源头验真** | 解析 Telecom 传递的 STIR/SHAKEN 验真结果。 | ✅ **我们已经做了 (Implemented)** | 我们已有 `StirChecker.kt` 解析 `VERIFICATION_STATUS_PASSED` 并发送给 Flutter。 |
| **10. 悬浮窗 Caller ID 展示** | 收到来电时弹出置顶悬浮窗展示来电归属地与标记。 | ✅ **我们已经做了 (Implemented)** | 我们通过 `floating_window_android.OverlayService` 实现。 |

---

## 二、 `saracroche-android` 功能逐一剖析

| 功能名称 | 功能详细定义与工作机制 | 本 App (`yourcallyourrule`) 现状状态 | 代码事实与对比说明 |
| :--- | :--- | :--- | :--- |
| **1. Long 型超高速通配符匹配引擎 (`PhoneNumberMatcher`)** | 将号码规整为 `Long` 数字类型，以 `#` 作为尾随通配符（如 `33162######`）快速生成候选集并完成拦截匹配。 | ⚠️ **我们做了但有差距 (Gap)** | 我们有 `PhoneRule` 与 `RegexRule`，但在内存匹配时使用 Dart 字符串与正则，未针对高并发海量数据做数字型 Long/通配哈希优化。 |
| **2. 免 SMS 权限通知级拦截 (`SmsNotificationListener`)** | 利用 `NotificationListenerService` 提取通知标题与文本，匹配黑名单时清除通知。 | ❌ **本 App 缺失** | 同样属于我们需要引入的免权限短信拦截模式。 |
| **3. `ROLE_CALL_SCREENING` 引导与申请** | 处理拦截角色的引导与自动申请。 | ✅ **我们已经做了 (Implemented)** | 我们在 `CallerIdChannelHandler.kt` 的 `setDefaultCallerIdApp` 中实现。 |
| **4. 企业 MDM 管理配置 (`APP_RESTRICTIONS`)** | 支持通过 Android App Restrictions 进行企业/家长控制配置下发。 | ❌ **本 App 缺失** | 我们缺少 MDM `restrictions.xml` 相关的解析支持。 |

---

## 三、 `Silence` 功能逐一剖析

| 功能名称 | 功能详细定义与工作机制 | 本 App (`yourcallyourrule`) 现状状态 | 代码事实与对比说明 |
| :--- | :--- | :--- | :--- |
| **1. 多 SIM 卡槽独立策略控制 (`SimScreen` / `Preferences`)** | 使用 `READ_PHONE_NUMBERS` 读取卡槽，为 SIM 1 与 SIM 2 分别提供独立开关。 | ✅ **我们已经做了 (Implemented)** | 我们有 `SimSlotRule.dart` + `SimChecker.kt` + `app_zh.arb` 中的 SIM 卡槽规则配置。 |
| **2. Panic 紧急重销/重置机制 (`PanicResponderActivity`)** | 响应 Guardian Project 紧急广播，瞬间清空/重置规则，防止危机时刻误封。 | ❌ **本 App 缺失** | 我们没有接入 Panic 广播响应逻辑。 |

---

## 四、 `SpamBlocker` & `SpamBlocker-Extended` 功能逐一剖析

| 功能名称 | 功能详细定义与工作机制 | 本 App (`yourcallyourrule`) 现状状态 | 代码事实与对比说明 |
| :--- | :--- | :--- | :--- |
| **1. 增量朴素贝叶斯分类器 (`ComplementNaiveBayes`)** | 纯 Kotlin 实现的 Complement Naive Bayes 模型，支持本地增量学习 (`addSample`, `removeSample`)。 | ❌ **本 App 缺失** | 我们缺少端侧增量机器学习分类模型。 |
| **2. 自动化工作流 Bot 引擎 (`Triggers` / `Actions`)** | 允许用户自定义条件触发器并联动自动化操作（发送 SMS、创建日历事件、改变设置）。 | ❌ **本 App 缺失** | 我们没有 Bot 自动化工作流节点。 |
| **3. 接通挂断麦克风静音 (`MODIFY_AUDIO_SETTINGS`)** | 执行接通挂断时，提前调用 `isMicrophoneMute = true`，挂断后恢复，防止泄漏环境音。 | ⚠️ **我们做了但有差距 (Gap)** | 我们的 `CallScreeningService.kt` 实现了 `ANSWER_THEN_HANGUP`，但未加入麦克风静音保护。 |
| **4. 自定义强提醒通知 (闪光灯/震动/亮屏)** | 在拦截允许放行的重要通知时，触发自定义闪光灯闪烁、震动模式和亮屏。 | ❌ **本 App 缺失** | 我们没有绑定硬件闪光灯与震动模式控制。 |

---

## 五、 `web26-050-call-blocker` 功能逐一剖析

| 功能名称 | 功能详细定义与工作机制 | 本 App (`yourcallyourrule`) 现状状态 | 代码事实与对比说明 |
| :--- | :--- | :--- | :--- |
| **1. Android 9 与 10+ 双通道兼容** | 同时实现 `PhoneStateReceiver` 与 `CallScreeningService`。 | ✅ **我们已经做了 (Implemented)** | 我们有 `MyCallScreeningService.kt` + `CallerIdChannelHandler.kt` / `CallStateReceiver.kt`。 |
| **2. `specialUse` 保活前台服务** | 声明 `foregroundServiceType="specialUse"` (Subtype: `callBlocking`) 防止被系统杀死。 | ✅ **物理实现了结构** | 我们在 Manifest 中为 `floating_window_android.OverlayService` 声明了 `specialUse`。 |

---

*文件位置: `C:\Users\Ngokel\Desktop\en\designed\yourcallrule\TARGET_REPOS_FEATURE_AUDIT_REPORT.md`*
