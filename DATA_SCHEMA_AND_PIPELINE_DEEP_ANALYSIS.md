# 目标参考库全量数据模型 (Data Schema)、字段算法与管线集成深拆报告

本报告摒弃一切无用的文件大小数值，聚焦于 6 个目标参考库的**真实数据模型 (Data Models)、数据库 Schema、字段规范、防 ReDoS 正则引擎算法、端侧 ML 特征向量与数据管线**。

---

## 目录
- [一、 参考库物理数据库 Schema 与数据实体全解](#一-参考库物理数据库-schema-与数据实体全解)
  - [1. `SpamNumber` 与分片主数据库 (`CallShield`)](#1-spamnumber-与分片主数据库-callshield)
  - [2. `WildcardRule` 正则规则实体与防 ReDoS 计算器 (`CallShield`)](#2-wildcardrule-正则规则实体与防-redos-计算器-callshield)
  - [3. `SmsKeywordRule` 与 Unicode 同形字折叠规整器 (`CallShield`)](#3-smskeywordrule-与-unicode-同形字折叠规整器-callshield)
  - [4. `ExternalBlocklistSubscription` 订阅与 Preview 预览元数据](#4-externalblocklistsubscription-订阅与-preview-预览元数据)
- [二、 算法与特征向量数据模型](#二-算法与特征向量数据模型)
  - [1. `SpamMLScorer` 20 维纯本地特征向量定义](#1-spammlscorer-20-维纯本地特征向量定义)
  - [2. `SmsContentAnalyzer` 短链、高危 TLD 与多语种诈骗正则数据](#2-smscontentanalyzer-短链高危-tld-与多语种诈骗正则数据)
- [三、 整合至本 App 数据管线 (`yourcallrule`)](#三-整合至本-app-数据管线-yourcallrule)

---

## 一、 参考库物理数据库 Schema 与数据实体全解

---

### 1. `SpamNumber` 与分片主数据库 (`CallShield`)

**源码路径**: `com/sysadmindoc/callshield/data/model/SpamNumber.kt`

#### 物理数据库表结构 (`spam_numbers`):
- `id`: `Long` (主键，自增)
- `number`: `String` (唯一索引 `unique = true`)
- `type`: `String` (如 `robocall`, `scam`, `telemarketing`)
- `reports`: `Int` (众包标记次数)
- `first_seen` / `last_seen`: `String` (首次/末次发现 ISO 时间戳)
- `description`: `String` (标签与补充说明)
- `source`: `String` (数据源 ID，如 `subscription:open_callshield`, `community`)
- `evidenceJson`: `String` (透明保存的源头 JSON 证据链)
- `evidenceExpiresAt`: `Long?` (证据过期时间戳，索引用于过期清除)
- `isUserBlocked`: `Boolean` (用户是否显式黑名单)
- `expiresAt`: `Long?` (黑名单到期时间戳)

#### 数据库分片网络清单 (`SpamShardManifest` & `SpamShardDescriptor`):
为了避免单次拉取数MB的大 JSON 崩溃，`CallShield` 将海量黑名单拆分为 Content-Addressed Shards（内容寻址分片）:
- `shard_id`: 分片 ID
- `sha256`: 分片 SHA-256 签名
- `bytes`: 字节数
- `numbers` / `prefixes`: 包含的单号与号段数量

---

### 2. `WildcardRule` 正则规则实体与防 ReDoS 计算器 (`CallShield`)

**源码路径**: `com/sysadmindoc/callshield/data/model/WildcardRule.kt`

#### 物理数据库表结构 (`wildcard_rules`):
- `id`: `Long` (主键)
- `pattern`: `String` (通配符如 `+1832555*` 或标准正则 `^\+1832555\d{4}$`)
- `isRegex`: `Boolean` (是否为标准正则)
- `scheduleDays`: `Int` (时间段位图: Bitmask 1=Sun..64=Sat, 0 表示全天候)
- `scheduleStartHour` / `scheduleEndHour`: `Int` (生效起止小时 0~23)

#### 🛡️ 防灾难性回溯 (ReDoS) 算力计算器引擎 (`BacktrackingPaths`):
为了防止恶意或错误的正则在呼入拦截的毫秒级主线程上导致 CPU 卡死挂起，系统在编译前计算算力图：
1. **长度上限**: `MAX_REGEX_LENGTH = 200`
2. **无限量词上限**: `MAX_UNBOUNDED_QUANTIFIERS = 8` (`*`, `+`, `{n,}`)
3. **回溯路径门限**: `MAX_BACKTRACKING_PATHS = 1_000_000.0`
4. **语法形态安全校验**:
   - 拒绝嵌套量词：如 `(a+)+`, `(a*)+`, `(a+)*`（经典 catastrophic-backtracking 爆栈结构）。
   - 拒绝重复组内的交替：如 `(...|...)+`。
   - `globToRegex()` 引擎自动将连续通配符 `**` 塌陷合并为单个 `*`（即 `\d*`）。

---

### 3. `SmsKeywordRule` 与 Unicode 同形字折叠规整器 (`CallShield`)

**源码路径**: `com/sysadmindoc/callshield/data/model/SmsKeywordRule.kt`

#### 物理数据库表结构 (`sms_keyword_rules`):
- `keyword`: `String` (关键词)
- `caseSensitive`: `Boolean` (大小写敏感)
- `TimeSchedule`: 绑定时间段

#### 🔍 同形字与不可见字符折叠规整器 (`SmsTextNormalizer.fold(text)`):
黑产经常利用全角字符、不可见零宽字符 (Zero-Width Space) 或形近字绕过关键词匹配。系统在匹配前统一对文本与关键词执行折叠：
- 撤销 Unicode 零宽字符（如 `\u200B`, `\u200C`, `\u200D`, `\uFEFF`）。
- 全角字符转半角 ASCII。
- 归一化拉丁/斯拉夫同形替换字（如 `а` ➔ `a`）。

---

### 4. `ExternalBlocklistSubscription` 订阅与 Preview 预览元数据

**源码路径**: `com/sysadmindoc/callshield/data/model/ExternalBlocklistSubscription.kt`

#### 订阅实体字段:
- `id`: 唯一识别码（前缀 `subscription:`）
- `label`: 展示名称
- `url`: 规则下载 HTTPS 路径
- `lastSyncedAt` / `lastAttemptAt`: 上次成功/尝试时间戳
- `lastNumberCount`: 当前列表维护的活动号码数
- `lastAdded` / `lastRemoved`: 上次同步新增/删除量
- `numberPlan`: 绑定的国家编号计划 (`country`, `callingCode`, `trunkPrefix`, `nationalLengths`)

#### Preview (预览比对结果) 元数据模型 (`ExternalBlocklistPreview`):
在正式将外部 URL 写入本地数据库前，返回增量预检视图：
- `numberCount`: 目标文件包含的总号码数
- `added`: 相比本地新增的号码数
- `removed`: 目标文件已剔除的号码数
- `unchanged`: 未变更的号码数
- `skippedRows`: 格式错误跳过的行数
- `blockedByOtherSources`: 已被其他更高优先级数据源覆盖的号码数

---

## 二、 算法与特征向量数据模型

---

### 1. `SpamMLScorer` 20 维纯本地特征向量定义

**源码路径**: `com/sysadmindoc/callshield/data/SpamMLScorer.kt`

用于在端侧推导垃圾概率得分（Spam Score）的 20 维浮点特征向量表：

| 索引 | 特征 Key | 含义与判定逻辑 |
| :--- | :--- | :--- |
| `0` | `toll_free` | 属于 800/888/877/866/855/844/833 免费热线 |
| `1` | `high_spam_npa` | 处于高投诉区号集中 (202, 213, 310, 323, 347, 404, 415, 512, 617, 646, 702...) |
| `2` | `voip_range` | 处于已知高频骚扰 VoIP 运营商 NPA-NXX 号段 |
| `3` | `repeated_digits_ratio` | 出现频率最高的单个数字在整个号码中的占比 |
| `4` | `sequential_asc_ratio` | 连续递增数字对占比 (如 12, 23, 34) |
| `5` | `all_same_digit` | 10 位数字完全一致（如 8888888888） |
| `6` | `nxx_555` | 交换局号为 555 (测试专用段) |
| `7` | `last4_zero` | 后 4 位全部为 0000 |
| `8` | `invalid_nxx` | NXX 以 0 或 1 开头 (NANP 规定非法的伪造区号) |
| `9` | `subscriber_all_same` | 用户段 4 位完全相同 (如 9999) |
| `10` | `alternating_pattern` | 交替重复模式 (如 5050505050) |
| `11` | `sequential_desc_ratio` | 连续递减数字对占比 (如 98, 87, 76) |
| `12` | `nxx_below_200` | NXX 数值 < 200 未分配段 |
| `13` | `low_digit_entropy` | 整个号码包含的独立数字种类少于 4 种 |
| `14` | `subscriber_sequential` | 后 4 位构成完整连续顺增/顺减 (如 1234, 9876) |
| `15` | `time_of_day_sin` | 呼叫时刻正弦编码 `sin(2π * hour / 24)` |
| `16` | `time_of_day_cos` | 呼叫时刻余弦编码 `cos(2π * hour / 24)` |
| `17` | `geographic_distance` | 来电区号与本机区号数字相差 > 200 |
| `18` | `short_number` | 号码总位数 < 7 (短码服务) |
| `19` | `plus_one_prefix` | 以 +1 国家码开头 |

---

### 2. `SmsContentAnalyzer` 短链、高危 TLD 与多语种诈骗正则数据

**源码路径**: `com/sysadmindoc/callshield/data/SmsContentAnalyzer.kt`

#### 嵌入式数据集合:
- **短链域名集合 (`shortenerDomains`)**: `bit.ly`, `tinyurl.com`, `t.co`, `goo.gl`, `ow.ly`, `is.gd`, `cutt.ly`, `shorturl.at`, `rb.gy`, `t.ly`, `bl.ink`, `lnk.to`。
- **高危顶域集合 (`suspiciousTlds`)**: `.xyz`, `.top`, `.club`, `.work`, `.buzz`, `.icu`, `.cam`, `.life`, `.click`, `.link`, `.info`, `.loan`, `.win`, `.bid`, `.stream`, `.racing`, `.download`, `.gq`, `.ml`, `.tk`, `.cf`, `.ga`, `.pw`。

---

## 三、 整合至本 App 数据管线 (`yourcallrule`)

将上述数据结构与算法无缝对齐并整合至 `C:/Users/Ngokel/Desktop/en/designed/yourcallrule` 仓库中的数据管线中：

```mermaid
flowchart LR
    subgraph Raw Ingestion [源数据解析]
        S1[SpamNumber & Shards]
        S2[ExternalBlocklistPreview 元数据]
        S3[SmsKeywordRule & Fold折叠]
        S4[SpamMLScorer 20维向量]
    end

    subgraph Pipeline Processing [merge_and_deduplicate.py]
        P1[ReDoS 回溯树预检]
        P2[E.164 规范化 & 标签映射]
        P3[SHA-256 哈希计算与签名]
    end

    subgraph App Schema [our app drift SQLite]
        D1[app_delta_setup_config.json]
        D2[Drift 本地数据库表规则持久化]
    end

    Raw Ingestion --> Pipeline Processing --> App Schema
```

1. **`app_delta_setup_config.json` 索引集成**:
   - 将第三方订阅库按 `source_id`、`full_download_url`、`checksum_sha256` 填入 JSON，App 端同步前先请求预览 `ExternalBlocklistPreview` 避免不必要的全量下载。
2. **防 ReDoS 正则引擎移至 Dart/Kotlin**:
   - 将 `BacktrackingPaths` 算法嵌入至 `yourcallrule` 的规则添加 UI 与匹配引擎中，拒绝包含 `(a+)+` 或路径算力超过 $10^6$ 的恶意正则规则。

---

*文件位置: `C:\Users\Ngokel\Desktop\en\designed\yourcallrule\DATA_SCHEMA_AND_PIPELINE_DEEP_ANALYSIS.md`*
