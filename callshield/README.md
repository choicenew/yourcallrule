# CallShield 开源数据同步镜像与订阅转换说明

本目录（`callshield/`）为独立整理的开源骚扰拦截订阅库。所有数据均按国家/地区（E.164 国际代码前缀）进行分拣隔离，使用者可根据需求单独拉取对应国家或通用的黑名单规则。

---

### 一、 目录划分与使用说明

各类规则数据按照国家/地区代码独立保存在不同子文件夹中：

- `callshield/GLOBAL/`：全球通用全量规则与近 24 小时热点爆发规则
  - `full_block.json`：全球全量拦截规则
  - `hot_block.json`：近 24h 爆发热点拦截规则
- `callshield/US/`：美国 / 加拿大 (`+1`) 专属拦截规则
- `callshield/FR/`：法国 (`+33`) 专属拦截规则（含 ARCEP 营销号段）
- `callshield/IN/`：印度 (`+91`) 专属拦截规则（含 TRAI 营销号段）
- `callshield/DE/`：德国 (`+49`) 专属拦截规则
- `callshield/CN/`：中国 (`+86`) 专属拦截规则

---

### 二、 数据来源与归属致敬 (Attribution & Credits)

本目录下保存的所有电话黑名单与规则数据，均由自动化 GitHub Actions 脚本从以下开源项目及政府/社区公开数据集抓取、格式化整理而来。在此向各数据源提供者致以诚挚的感谢：

1. **CallShield 主仓库**: [SysAdminDoc/CallShield](https://github.com/SysAdminDoc/CallShield) (MIT 许可)
2. **美国 FCC 骚扰电话数据库**: US Federal Communications Commission Unwanted Calls Dataset
3. **美国 FTC 谢绝来电数据库**: US Federal Trade Commission Do Not Call Complaints
4. **欧洲 PhoneBlock 社区数据库**: PhoneBlock.net Community Database
5. **法国 ARCEP 电信营销号段**: Saracroche French Telemarketing Range List

---

### 三、 法律与免责声明 (Legal Disclaimer & Neutrality)

1. **独立性声明**：本仓库及开发者与上述任何数据源提供方、开源项目维护者无任何官方关联、赞助、合作或雇佣关系。
2. **数据精准性免责**：本目录下的规则数据均由自动化脚本按原样（As-Is）抓取和格式转换，**本仓库及开发者不对任何数据的精准性、真实性、时效性、完整性或合法性做出任何显式或隐式的承诺与保证**。
3. **使用者责任**：使用者在应用中主动订阅或导入本数据所产生的任何误拦截、漏拦截、通信中断或其他争议，均由使用者自行承担，本仓库及开发者概不承担任何法律责任。
