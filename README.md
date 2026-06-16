# 金融舆情监测系统

基于 React + TypeScript + Ant Design 的金融舆情监测系统，含爬虫后端。系统已从基础舆情内容列表升级为**行业温度监测工具**，支持多维度可解释的行业/板块情绪温度指数。

## 技术栈

**前端**
- React 19 + TypeScript + Vite 8
- Ant Design 6 + ECharts 6
- React Router 7 + TanStack React Query
- MSW (Mock Service Worker，后端未启动时自动降级)

**后端（爬虫服务）**
- Node.js + Express 5 + TypeScript (ESM)
- Axios + Cheerio（HTTP 请求与 HTML 解析）
- 金融语义情绪模型（词典增强 + OpenAI 兼容 LLM 可选）
- 结构化事件识别（8 种金融事件类型）
- 主体相关度评分（T013）
- 内容去重与事件聚类（Jaccard 相似度）
- SQLite 持久化存储（`data/sentiment.db`）

## 快速开始

### 模式一：纯前端 Mock 数据（无需后端）

```bash
cd web
pnpm install
pnpm dev
```

### 模式二：真实爬虫数据（推荐）

```bash
# 终端1：启动爬虫后端（端口 3001）
cd server
pnpm install
pnpm dev

# 终端2：启动前端（端口 5173）
cd web
pnpm install
pnpm dev
```

前端会自动检测后端是否可用：
- 后端运行时：使用真实爬取数据
- 后端未运行时：自动降级为 MSW Mock 数据

浏览器访问 http://localhost:5173

### 手动爬取一次（无需启动服务器）

```bash
cd server
pnpm crawl
```

### 数据库迁移（首次或 JSON 数据迁移）

```bash
cd server
pnpm migrate
```

## 项目结构

```
├── openapi/
│   └── openapi.yaml              # OpenAPI 接口定义（前后端共享契约）
├── data/
│   ├── sentiment.db              # SQLite 数据库（内容、配置、温度快照、预警等）
│   ├── lexicons.json             # 词库种子数据
│   └── monitoring-projects.json  # 监测方案种子数据
├── spec/
│   ├── task.md                   # 任务拆解与完成状态
│   └── plan.md                   # 系统改进方案
├── web/                          # 前端源码
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # API 客户端（所有接口调用）
│   │   │   └── types.ts          # 前端 TypeScript 类型定义
│   │   ├── mocks/
│   │   │   ├── handlers.ts       # MSW Mock 处理器（后端不可用时降级）
│   │   │   └── data/             # Mock 数据（contents/alerts/monitoring/dashboard）
│   │   ├── layouts/
│   │   │   └── MainLayout.tsx    # 主布局（侧边栏导航）
│   │   ├── components/
│   │   │   └── ContentDetailDrawer.tsx  # 内容详情抽屉（含 T011/T012 增强展示）
│   │   ├── pages/
│   │   │   ├── dashboard/        # 工作台（聚合首页，H002-H011）
│   │   │   ├── search/           # 舆情检索
│   │   │   ├── monitoring/       # 监测方案管理
│   │   │   ├── alerts/           # 预警中心
│   │   │   ├── industry-mappings/ # 行业映射管理（T001）
│   │   │   ├── temperature/      # 行业温度看板（T005）
│   │   │   └── settings/         # 系统配置（词库 + 爬虫管理 + 数据源权重）
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/                   # 静态资源
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/                       # 爬虫后端
│   ├── src/
│   │   ├── crawlers/             # 22 个数据源爬虫适配器
│   │   │   ├── BaseCrawler.ts    # 抽象基类（重试/熔断/NLP增强/事件识别）
│   │   │   ├── EastMoneyCrawler.ts    # 东方财富快讯
│   │   │   ├── GubaCrawler.ts         # 股吧论坛
│   │   │   ├── XueqiuCrawler.ts       # 雪球
│   │   │   ├── SinaFinanceCrawler.ts  # 新浪财经
│   │   │   ├── ClsCrawler.ts          # 财联社
│   │   │   ├── ThsCrawler.ts          # 同花顺
│   │   │   ├── ChinaSecuritiesJournalCrawler.ts # 中证网/中国证券报
│   │   │   ├── RegulatoryAuthorityCrawler.ts    # 上交所 / 深交所 / 证监会 权威资讯
│   │   │   ├── BrokerResearchCrawler.ts         # 头部券商研报（东方财富研报 API）
│   │   │   ├── StockstarCrawler.ts              # 证券之星（财经新闻）
│   │   │   ├── FirstBankCrawler.ts              # 第一银行（投资趋势洞察）
│   │   │   ├── Laohu8Crawler.ts       # 老虎社区（社交媒体）
│   │   │   ├── HKEXCrawler.ts         # 港交所（存根，需 API）
│   │   │   ├── SECCrawler.ts          # SEC EDGAR（存根，需 API）
│   │   │   ├── BloombergCrawler.ts    # 彭博社（需 API Key）
│   │   │   ├── ReutersCrawler.ts      # 路透社（需 API Key）
│   │   │   ├── FutuCrawler.ts         # 富途证券（需 OpenAPI 或 Cookie）
│   │   │   ├── TigerCrawler.ts        # 老虎证券（需 OpenAPI 或 Token）
│   │   │   ├── WindCrawler.ts         # 万得Wind（存根，需付费 API）
│   │   │   ├── ZhihuCrawler.ts        # 知乎（存根，需 Cookie）
│   │   │   ├── XiaohongshuCrawler.ts  # 小红书（存根，需反爬签名）
│   │   │   └── DouyinCrawler.ts       # 抖音（存根，需反爬签名）
│   │   ├── nlp/
│   │   │   ├── sentiment.ts                # 基础词典情感分析
│   │   │   ├── financialSentimentModel.ts  # T011 金融语义情绪模型（词典/LLM 适配层）
│   │   │   ├── eventRecognitionService.ts  # T012 结构化事件识别（8 种金融事件）
│   │   │   ├── relevanceService.ts         # T013 主体相关度评分
│   │   │   └── industryMappingService.ts   # 行业映射查询服务
│   │   ├── temperature/
│   │   │   ├── temperatureService.ts  # 温度指数计算（T002/T006/T007/T013 集成）
│   │   │   └── temperatureStore.ts    # 温度快照存储与历史查询
│   │   ├── dedup/
│   │   │   ├── dedupService.ts        # T007 内容去重与事件聚类（Jaccard 相似度）
│   │   │   └── eventClusterStore.ts   # 事件簇存储
│   │   ├── alerts/
│   │   │   └── alertEvaluationService.ts  # T010 预警规则自动评估（7 种触发条件）
│   │   ├── scheduler/
│   │   │   └── CrawlScheduler.ts      # T009 定时采集调度器（熔断/增量/日志）
│   │   ├── storage/
│   │   │   ├── db.ts                  # T008 SQLite 数据库连接
│   │   │   ├── JsonStorage.ts         # 内容存储（内存索引 + SQLite 持久化）
│   │   │   ├── alertsStore.ts         # 预警存储
│   │   │   ├── crawlLogsStore.ts      # 采集日志存储
│   │   │   ├── industryMappingsStore.ts  # 行业映射存储
│   │   │   ├── lexiconsStore.ts       # 词库存储
│   │   │   ├── monitoringProjectsStore.ts # 监测方案存储
│   │   │   └── sourceConfigsStore.ts  # 数据源配置存储
│   │   ├── api/
│   │   │   ├── routes.ts              # Express 路由（对齐 OpenAPI 契约）
│   │   │   └── dashboardSummaryHandler.ts  # H006 首页聚合接口处理器
│   │   ├── config.ts                  # 爬虫默认配置
│   │   ├── types.ts                   # 后端 TypeScript 类型定义
│   │   ├── index.ts                   # 服务入口
│   │   ├── crawl-once.ts              # 一次性手动爬取脚本
│   │   └── migrate.ts                 # JSON → SQLite 数据迁移脚本
│   ├── .env                           # 环境变量（LLM API Key 等）
│   ├── tsconfig.json
│   └── package.json
├── AGENTS.md                          # 项目开发规范
├── .gitignore
└── README.md
```

## 核心功能模块

### 行业温度指数（T001-T007）

系统核心能力，对 7 个初始行业（AI科技、半导体、新能源、医药、有色金属、银行、房地产）输出 0-100 的可解释温度指数。

**温度公式：**
```
板块温度 = 情绪得分 × 35%
        + 声量异动 × 25%
        + 传播热度 × 20%
        + 来源可信度 × 20%
```

**温度分层：**

| 分值区间 | 状态 | 含义 |
|---------|------|------|
| 0–19 | 冰点 | 情绪低迷，负面或无人关注 |
| 20–39 | 偏冷 | 关注度和情绪偏弱 |
| 40–59 | 中性 | 情绪和热度处于常态 |
| 60–79 | 偏热 | 正面情绪或讨论热度明显升温 |
| 80–100 | 过热 | 高热度、高波动，需警惕拥挤交易 |

**T013 主体相关度加权：** 温度计算全面接入相关度权重，低于 15 分的偶发提及内容被过滤，避免关键词误伤。

**T007 事件聚类去重：** 声量计算使用事件簇数量而非原始内容数量，避免同一事件跨平台转载后重复放大。

### 金融语义情绪模型（T011）

双模型适配层，支持无缝切换：

- **词典增强模型（默认）**：输出 7 种精细金融情绪标签（强利好/弱利好/中性/弱利空/强利空/风险/传闻）、置信度（0-1）和可读判断理由
- **LLM 模型（可选）**：配置 `LLM_API_KEY` 后自动启用，兼容 OpenAI / DeepSeek / Ollama / Azure 等任意 OpenAI 协议接口；调用失败时自动回落到词典模型
- 高影响内容（含风险词或强信号）自动标记 `secondaryAnalysis=true`

### 结构化事件识别（T012）

识别 8 种金融事件类型，输出影响方向、置信度、触发词和关联主体：

| 事件类型 | 说明 |
|---------|------|
| `policy_change` | 政策变化 |
| `earnings_forecast` | 业绩预告 |
| `shareholding_change` | 增减持 |
| `merger_acquisition` | 并购重组 |
| `regulatory_penalty` | 监管处罚 |
| `debt_default` | 债务违约 |
| `industry_prosperity` | 产业景气变化 |
| `rating_change` | 研报评级变化 |

### 预警规则引擎（T010）

支持 7 种自动触发条件，含冷却机制防止重复告警：

- 行业温度过热（`temperatureAbove`）
- 行业温度快速升温（`temperatureRiseAbove`）
- 研报观点集中转向负面（`brokerNegativeRatioAbove`）
- 负面声量突增（`negativeVolumeRiseAbove`）
- 市场情绪指数偏低（`sentimentBelow`）
- 高风险内容出现（`riskLevelAbove`）
- 风险词命中（`keywords`）

### 采集调度器（T009）

- 分数据源采集频率配置
- 失败重试 + 熔断/退避机制（连续失败 N 次后自动熔断）
- 健康度评分（0-100）
- 增量采集（仅采集上次之后的新内容）
- 采集日志持久化
- 熔断触发时自动生成预警

### 数据源权重体系（T006）

22 个数据源按类型分级，支持：
- 可信度评分（0-100）
- 授权状态（已授权/受限/未授权）
- 反爬风险（低/中/高）
- 可用状态（正常/不稳定/不可用）
- 是否纳入温度计算（可单独开关）

## 数据源支持

| 数据源 | 类型 | 可信度 | 状态 | 说明 |
|--------|------|--------|------|------|
| 监管机构公告 | 监管 | 98 | 可用 | 上交所、深交所、证监会 HTML 解析 |
| 港交所披露易 | 监管 | 97 | 存根 | 需 `HKEX_API_KEY` |
| 美国SEC | 监管 | 96 | 存根 | 需 `SEC_API_KEY` |
| 券商研报 | 研报 | 92 | 可用 | 东方财富 reportapi，覆盖主流券商 |
| 第一银行 | 研报 | 88 | 可用* | 投资趋势洞察，HTML 解析 |
| 彭博社 | 新闻 | 90 | 需授权 | 需 `BLOOMBERG_API_KEY` |
| 路透社 | 新闻 | 88 | 需授权 | 需 `REUTERS_API_KEY` |
| 中国证券报 | 新闻 | 85 | 可用 | 要闻频道 HTML 解析 |
| 财联社 | 新闻 | 83 | 可用* | 多端点容错 |
| 新浪财经 | 新闻 | 75 | 可用 | 滚动新闻 REST API |
| 万得资讯 | 财经APP | 82 | 存根 | 需付费 API 授权 |
| 同花顺 | 财经APP | 72 | 可用 | API + HTML fallback |
| 东方财富 | 财经APP | 70 | 可用 | 财经快讯 API + JSONP fallback |
| 证券之星 | 财经APP | 65 | 可用* | API + HTML fallback |
| 富途证券 | 财经APP | 68 | 需授权 | 需 `FUTU_API_KEY` 或 `FUTU_COOKIE` |
| 老虎证券 | 财经APP | 65 | 需授权 | 需 `TIGER_API_KEY` 或 `TIGER_TOKEN` |
| 雪球 | 社媒 | 52 | 可用* | 需 cookie（自动获取，可能被限制） |
| 老虎社区 | 论坛 | 42 | 可用* | API + HTML fallback |
| 股吧 | 论坛 | 40 | 可用 | HTML 解析热门帖子 |
| 知乎 | 社媒 | 38 | 存根 | 需 `ZHIHU_COOKIE`，不纳入温度计算 |
| 小红书 | 社媒 | 25 | 存根 | 需反爬签名，不纳入温度计算 |
| 抖音 | 社媒 | 20 | 存根 | 需反爬签名，不纳入温度计算 |

*部分数据源受目标站点反爬策略影响，可能需要定期维护。

### 外部市场 / 券商爬虫（环境变量）

| 环境变量 | 说明 |
|----------|------|
| `LLM_API_KEY` | LLM 情绪分析 API Key（兼容 OpenAI/DeepSeek/Ollama 等） |
| `LLM_BASE_URL` | LLM API 地址（默认 `https://api.openai.com/v1`） |
| `LLM_MODEL` | LLM 模型名称（默认 `gpt-4o-mini`） |
| `BLOOMBERG_API_KEY` | 彭博新闻/API（可选 `BLOOMBERG_API_URL`） |
| `REUTERS_API_KEY` | 路透社/Refinitiv（可选 `REUTERS_API_URL`） |
| `FUTU_API_KEY` | 富途 OpenAPI；配合本地 OpenD 时可设 `FUTU_OPEND_URL` |
| `FUTU_COOKIE` | 富途网页端快讯（非官方，易失效） |
| `TIGER_API_KEY` + `TIGER_PRIVATE_KEY` | 老虎 OpenAPI（可选 `TIGER_API_URL`） |
| `TIGER_TOKEN` | 老虎网页端接口 |

上述爬虫默认 `enabled: false`，配置密钥后需在管理端启用。

## API 接口

所有接口以 `/api/v1` 为前缀，完整定义见 `openapi/openapi.yaml`。

| 接口 | 说明 |
|------|------|
| `POST /auth/login` | 用户登录 |
| `GET /contents` | 舆情内容检索（支持关键词/来源/情绪/风险/时间过滤） |
| `GET /contents/stats` | 舆情统计（情绪分布/风险分布/趋势/关键词/实体） |
| `POST /contents/:id/sentiment/analyze` | T011 触发增强情绪二次分析 |
| `POST /contents/:id/events/analyze` | T012 触发结构化事件识别 |
| `GET /contents/events/distribution` | T012 事件类型分布统计 |
| `GET /temperatures` | 行业温度排名列表 |
| `GET /temperatures/:industryId` | 单个行业温度详情（含风险分布和关键内容） |
| `GET /temperatures/:industryId/trend` | 行业温度历史趋势 |
| `GET /monitoring-projects` | 监测方案列表 |
| `POST /monitoring-projects` | 创建监测方案 |
| `GET /alerts` | 预警列表 |
| `POST /alerts/:id/handle` | 处置预警 |
| `GET /alert-rules` | 预警规则列表 |
| `POST /alerts/evaluate` | 手动触发预警规则评估 |
| `GET /industry-mappings` | 行业映射列表 |
| `POST /industry-mappings/query` | 关键词匹配行业查询 |
| `GET /source-configs` | 数据源配置列表 |
| `PUT /source-configs/:id` | 更新数据源配置 |
| `POST /source-configs/:id/toggle` | 切换数据源是否纳入温度计算 |
| `GET /lexicons` | 词库列表 |
| `GET /dashboard/summary` | 首页聚合数据（H006） |
| `GET /crawlers/status` | 爬虫状态列表 |
| `POST /crawlers/run-all` | 运行全部爬虫 |
| `POST /crawlers/:name/run` | 运行单个爬虫 |
| `POST /crawlers/:name/toggle` | 启用/停用爬虫 |

## 前端页面

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | 工作台 | 聚合首页：预警摘要、行业温度 Top5、升降温动态、关键驱动内容、风险事件分布、采集健康、监测方案命中排行 |
| `/search` | 舆情检索 | 多维度过滤检索，支持查看内容详情（含 T011/T012 增强分析） |
| `/monitoring` | 监测方案 | 方案 CRUD，支持行业/板块/股票池监测目标配置 |
| `/alerts` | 预警中心 | 预警列表、处置流程、预警规则管理 |
| `/industry-mappings` | 行业映射 | 行业/板块/概念/主题映射管理，支持关键词匹配测试 |
| `/temperature` | 行业温度 | 温度排行榜、变化榜、高温/低温板块卡片、温度详情抽屉（趋势图/雷达图/事件分布） |
| `/settings` | 系统配置 | 词库管理、爬虫管理、数据源权重配置 |

## 架构数据流

```
前端 React UI (web/)
    ↕ (API Client + React Query)
Vite Dev Proxy (/api/v1 → localhost:3001)
    ↕
Express API Server (server/, port 3001)
    ↕
┌──────────────────────────────────────────────────────┐
│  CrawlScheduler（定时调度 + 熔断 + 增量采集）          │
│    ↕                                                  │
│  Crawlers（22 个数据源适配器）                         │
│    → HTTP/Cheerio → 目标网站                          │
│    ↕                                                  │
│  NLP Pipeline                                         │
│    ├── sentiment.ts（基础词典情感分析）                 │
│    ├── financialSentimentModel.ts（T011 精细情绪）     │
│    ├── eventRecognitionService.ts（T012 事件识别）     │
│    └── relevanceService.ts（T013 相关度评分）          │
│    ↕                                                  │
│  dedupService.ts（T007 去重聚类）                      │
│    ↕                                                  │
│  SQLite Storage（data/sentiment.db）                  │
│    ↕                                                  │
│  temperatureService.ts（T002 温度计算）                │
│    ↕                                                  │
│  alertEvaluationService.ts（T010 预警评估）            │
└──────────────────────────────────────────────────────┘
```

## 任务完成状态

| 任务 | 说明 | 状态 |
|------|------|------|
| T001 | 行业/板块映射体系 | ✅ 已完成 |
| T002 | 温度指数公式 MVP | ✅ 已完成 |
| T003 | 监测方案升级 | ✅ 已完成 |
| T004 | 行业温度 API | ✅ 已完成 |
| T005 | 行业温度看板 | ✅ 已完成 |
| T006 | 数据源权重体系 | ✅ 已完成 |
| T007 | 内容去重和事件聚类 | ✅ 已完成 |
| T008 | 数据库存储升级（SQLite） | ✅ 已完成 |
| T009 | 采集任务稳定性增强 | ✅ 已完成 |
| T010 | 预警规则升级 | ✅ 已完成 |
| T011 | 金融语义情绪模型 | ✅ 已完成 |
| T012 | 结构化事件识别 | ✅ 已完成 |
| T013 | 主体相关度评分 | ✅ 已完成 |
| T014 | 行情数据联动 | ⬜ 未开始 |
| T015 | 回测评估体系 | ⬜ 未开始 |
| T016 | 人工标注与样本管理 | ⬜ 未开始 |
| T017 | 合规和授权治理 | ⬜ 未开始 |
| T018 | 权限、日志和审计 | ⬜ 未开始 |

详细任务说明见 `spec/task.md`，系统改进方案见 `spec/plan.md`。

## 合规提醒

本项目仅用于 POC 演示。爬取第三方网站数据可能违反目标站点的服务条款。
生产使用请：
1. 评估并遵守各平台的 robots.txt 和 ToS
2. 优先使用官方 API 或授权数据服务商
3. 遵守《个人信息保护法》等相关法规
4. 不要将凭证、Cookie 或 Token 写入代码仓库
