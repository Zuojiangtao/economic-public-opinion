# 金融舆情监测系统

基于 React + TypeScript + Ant Design 的金融舆情监测系统，含爬虫后端。

## 技术栈

**前端**
- React 19 + TypeScript + Vite 8
- Ant Design 6 + ECharts 6
- React Router 7 + TanStack React Query
- MSW (Mock Service Worker，后端未启动时自动降级)

**后端（爬虫服务）**
- Node.js + Express 5 + TypeScript
- Axios + Cheerio (HTTP 请求与 HTML 解析)
- 字典式中文金融情感分析 NLP
- JSON 文件持久化存储

## 快速开始

### 模式一：纯前端 Mock 数据（无需后端）

```bash
cd web
npm install
npm run dev
```

### 模式二：真实爬虫数据（推荐）

```bash
# 终端1：启动爬虫后端
cd server
npm install
npm run dev

# 终端2：启动前端
cd web
npm install
npm run dev
```

前端会自动检测后端是否可用：
- 后端运行时：使用真实爬取数据
- 后端未运行时：自动降级为 MSW Mock 数据

浏览器访问 http://localhost:5173

### 手动爬取一次（无需启动服务器）

```bash
cd server
npm run crawl
```

## 项目结构

```
├── openapi/
│   └── openapi.yaml              # OpenAPI 接口定义（前后端共享契约）
├── data/
│   └── contents.json             # 爬取数据持久化
├── web/                          # 前端源码
│   ├── src/
│   │   ├── api/                  # TS 类型 + API 客户端
│   │   ├── mocks/                # MSW Mock（后端不可用时降级使用）
│   │   ├── layouts/              # 主布局
│   │   ├── components/           # 共享组件
│   │   ├── pages/
│   │   │   ├── dashboard/        # 工作台
│   │   │   ├── search/           # 舆情检索
│   │   │   ├── monitoring/       # 监测方案
│   │   │   ├── alerts/           # 预警中心
│   │   │   └── settings/         # 系统配置 + 爬虫管理
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/                   # 静态资源
│   ├── index.html                # SPA 入口
│   ├── vite.config.ts            # Vite 构建配置
│   ├── tsconfig.json             # 前端 TypeScript 配置
│   ├── eslint.config.js          # ESLint 配置
│   └── package.json              # 前端依赖
├── server/                       # 爬虫后端
│   ├── src/
│   │   ├── crawlers/             # 19 个数据源爬虫适配器
│   │   │   ├── BaseCrawler.ts    # 抽象基类（重试/限速/NLP增强）
│   │   │   ├── EastMoneyCrawler.ts    # 东方财富快讯
│   │   │   ├── GubaCrawler.ts         # 股吧论坛
│   │   │   ├── XueqiuCrawler.ts       # 雪球
│   │   │   ├── SinaFinanceCrawler.ts  # 新浪财经
│   │   │   ├── ClsCrawler.ts          # 财联社
│   │   │   ├── ThsCrawler.ts          # 同花顺
│   │   │   ├── ZhihuCrawler.ts        # 知乎（存根）
│   │   │   ├── XiaohongshuCrawler.ts  # 小红书（存根）
│   │   │   ├── DouyinCrawler.ts       # 抖音（存根）
│   │   │   ├── WindCrawler.ts         # 万德Wind（存根）
│   │   │   ├── ChinaSecuritiesJournalCrawler.ts # 中证网/中国证券报
│   │   │   ├── RegulatoryAuthorityCrawler.ts    # 上交所 / 深交所 / 证监会 权威资讯
│   │   │   ├── BrokerResearchCrawler.ts         # 头部券商研报（东方财富研报 API）
│   │   │   ├── HKEXCrawler.ts           # 港交所/港股（存根，需 API）
│   │   │   ├── SECCrawler.ts            # SEC EDGAR/美股（存根，需 API）
│   │   │   ├── BloombergCrawler.ts      # 彭博社（外部市场，需 API Key）
│   │   │   ├── ReutersCrawler.ts        # 路透社（外部市场，需 API Key）
│   │   │   ├── FutuCrawler.ts           # 富途证券（港股/美股，需 OpenAPI 或 Cookie）
│   │   │   ├── TigerCrawler.ts          # 老虎证券（美股/港股，需 OpenAPI 或 Token）
│   │   │   ├── Laohu8Crawler.ts         # 老虎社区（社交媒体）
│   │   │   ├── FirstBankCrawler.ts      # 第一银行（投资趋势洞察）
│   │   │   └── StockstarCrawler.ts      # 证券之星（财经新闻）
│   │   ├── nlp/
│   │   │   └── sentiment.ts      # 中文金融情感词典分析
│   │   ├── storage/
│   │   │   └── JsonStorage.ts    # JSON 文件存储 + 内存索引
│   │   ├── scheduler/
│   │   │   └── CrawlScheduler.ts # 定时采集调度器
│   │   ├── api/
│   │   │   └── routes.ts         # Express API（对齐 OpenAPI）
│   │   ├── index.ts              # 服务入口
│   │   └── crawl-once.ts         # 一次性手动爬取脚本
│   ├── tsconfig.json             # 后端 TypeScript 配置
│   └── package.json              # 后端依赖
├── .gitignore
└── README.md
```

## 数据源支持

| 数据源 | 类型 | 状态 | 说明 |
|--------|------|------|------|
| 东方财富 | 新闻 | 可用 | 财经快讯 API + JSONP fallback |
| 股吧 | 论坛 | 可用 | HTML 解析热门帖子 |
| 雪球 | 社媒 | 可用* | 需 cookie（自动获取，可能被限制） |
| 新浪财经 | 新闻 | 可用 | 滚动新闻 REST API |
| 财联社 | 新闻 | 可用* | 多端点容错（API 可能变化） |
| 同花顺 | 新闻 | 可用 | API + HTML fallback |
| 知乎 | 社媒 | 存根 | 需设置 ZHIHU_COOKIE 环境变量 |
| 小红书 | 社媒 | 存根 | 需反爬签名实现 |
| 抖音 | 社媒 | 存根 | 需反爬签名实现 |
| 万德Wind | 研报 | 存根 | 需付费 API 授权 |
| 中证网（中国证券报） | 机构/权威媒体 | 可用 | 要闻频道 HTML 解析（监管与资本市场资讯） |
| 权威监管机构 | 新闻 | 可用 | 上交所、深交所（含规则与指南）、证监会 栏目 HTML 解析 |
| 券商机构研报 | 研报 | 可用 | 东方财富 `reportapi` 列表，覆盖中信证券、广发证券、中金公司、中信建投、招商证券、国信证券、华泰证券、申万宏源、中国银河等 |
| 港交所/港股 | 公告/资讯 | 存根 | `HKEXCrawler`：建议接入披露易或第三方 API，需 `HKEX_API_KEY` 等 |
| SEC/美股 | 公告/资讯 | 存根 | `SECCrawler`：建议接入 EDGAR API 等，需 `SEC_API_KEY` 等 |
| 彭博社 Bloomberg | 新闻 | 需授权 | `BloombergCrawler`：付费 API，设置 `BLOOMBERG_API_KEY`（可选 `BLOOMBERG_API_URL`） |
| 路透社 Reuters | 新闻 | 需授权 | `ReutersCrawler`：Refinitiv 等付费 API，设置 `REUTERS_API_KEY`（可选 `REUTERS_API_URL`） |
| 富途证券 Futu | 券商/快讯 | 需授权 | `FutuCrawler`：OpenAPI 需 `FUTU_API_KEY` + 本地 OpenD；或网页端 `FUTU_COOKIE` |
| 老虎证券 Tiger | 券商/资讯 | 需授权 | `TigerCrawler`：OpenAPI 需 `TIGER_API_KEY` + `TIGER_PRIVATE_KEY`；或网页端 `TIGER_TOKEN` |
| 老虎社区 | 社媒 | 可用* | API + HTML fallback，社区热门帖子 |
| 第一银行 | 新闻 | 可用* | 投资趋势洞察新闻，HTML 解析 |
| 证券之星 | 新闻 | 可用* | API + HTML fallback，财经新闻 |

*部分数据源受目标站点反爬策略影响，可能需要定期维护。

### 外部市场 / 券商爬虫（环境变量）

| 环境变量 | 说明 |
|----------|------|
| `BLOOMBERG_API_KEY` | 彭博新闻/API（可选 `BLOOMBERG_API_URL`） |
| `REUTERS_API_KEY` | 路透社/Refinitiv（可选 `REUTERS_API_URL`） |
| `FUTU_API_KEY` | 富途 OpenAPI；配合本地 OpenD 时可设 `FUTU_OPEND_URL` |
| `FUTU_COOKIE` | 富途网页端快讯（非官方，易失效） |
| `TIGER_API_KEY` + `TIGER_PRIVATE_KEY` | 老虎 OpenAPI（可选 `TIGER_API_URL`） |
| `TIGER_TOKEN` | 老虎网页端接口 |

上述爬虫默认 `enabled: false`，配置密钥后需在代码或管理端启用。

## 爬虫管理

在前端「系统配置 → 爬虫管理」页面可以：
- 查看所有爬虫状态（启用/停用/异常）
- 启用/停用单个爬虫
- 手动触发单个爬虫采集
- 一键触发全部采集
- 查看采集数量和最近采集时间

后端 API 端点：
- `GET /api/v1/crawlers/status` - 查看爬虫状态
- `POST /api/v1/crawlers/run-all` - 运行全部
- `POST /api/v1/crawlers/:name/run` - 运行单个
- `POST /api/v1/crawlers/:name/toggle` - 启用/停用

## NLP 情感分析

内置字典式中文金融情感分析：
- 50+ 正面词（利好/涨停/突破/反弹...）
- 60+ 负面词（利空/跌停/暴跌/崩盘...）
- 12+ 高风险词（暴雷/违约/做空...）
- 实体识别（上市公司/指数/行业）
- 情感分数 (-1 ~ 1) + 风险等级 (low/medium/high/critical)

## 架构数据流

```
前端 React UI (web/)
    ↕ (API Client + React Query)
Vite Dev Proxy (/api/v1 → localhost:3001)
    ↕
Express API Server (server/, port 3001)
    ↕
┌─────────────────────────────────┐
│  CrawlScheduler (定时调度)       │
│    ↕                            │
│  Crawlers (22个数据源适配器)     │
│    → HTTP/Cheerio → 目标网站    │
│    ↕                            │
│  NLP Sentiment (情感分析)        │
│    ↕                            │
│  JsonStorage (内存+JSON持久化)   │
│    → data/contents.json         │
└─────────────────────────────────┘
```

## 合规提醒

本项目仅用于 POC 演示。爬取第三方网站数据可能违反目标站点的服务条款。
生产使用请：
1. 评估并遵守各平台的 robots.txt 和 ToS
2. 优先使用官方 API 或授权数据服务商
3. 遵守《个人信息保护法》等相关法规
