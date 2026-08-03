# Financial Sentiment Monitoring System

A financial sentiment monitoring system built with React + TypeScript + Ant Design, including a crawler backend. The system has been upgraded from basic sentiment content lists to an **industry temperature monitoring tool**, supporting multi-dimensional and explainable industry/sector sentiment temperature indices.

## Tech Stack

**Frontend**
- React 19 + TypeScript + Vite 8
- Ant Design 6 + ECharts 6
- React Router 7 + TanStack React Query
- MSW (Mock Service Worker, automatically degrades when backend is not running)

**Backend (Crawler Service)**
- Node.js + Express 5 + TypeScript (ESM)
- Axios + CheerIO (HTTP requests and HTML parsing)
- Financial semantic sentiment model (dictionary-enhanced + optional OpenAI-compatible LLM)
- Structured event recognition (8 types of financial events)
- Subject relevance scoring (T013)
- Content deduplication and event clustering (Jaccard similarity)
- SQLite persistent storage (`data/sentiment.db`)

## Quick Start

### Mode 1: Pure Frontend with Mock Data (No Backend Required)

```bash
cd web
pnpm install
pnpm dev
```

### Mode 2: Real Crawler Data (Recommended)

```bash
# Terminal 1: Start crawler backend (port 3001)
cd server
pnpm install
pnpm dev

# Terminal 2: Start frontend (port 5173)
cd web
pnpm install
pnpm dev
```

Frontend automatically detects backend availability:
- When backend is running: Uses real crawled data
- When backend is not running: Automatically degrades to MSW Mock data

Access via browser at http://localhost:5173

### Manual Crawl Once (No Server Startup Required)

```bash
cd server
pnpm crawl
```

### Database Migration (First Run or JSON to Data Migration)

```bash
cd server
pnpm migrate
```

## Project Structure

```
├── openapi/
│   └── openapi.yaml              # OpenAPI interface definition (shared contract between front and backend)
├── data/
│   ├── sentiment.db              # SQLite database (contents, configs, temperature snapshots, alerts, etc.)
│   ├── lexicons.json             # Lexicon seed data
│   └── monitoring-projects.json  # Monitoring scheme seed data
├── spec/
│   ├── task.md                   # Task breakdown and completion status
│   └── plan.md                   # System improvement plan
├── web/                          # Frontend source code
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts         # API client (all interface calls)
│   │   │   └── types.ts          # Frontend TypeScript type definitions
│   │   ├── mocks/
│   │   │   ├── handlers.ts       # MSW Mock handlers (degraded when backend unavailable)
│   │   │   └── data/             # Mock data (contents/alerts/monitoring/dashboard)
│   │   ├── layouts/
│   │   │   └── MainLayout.tsx    # Main layout (sidebar navigation)
│   │   ├── components/
│   │   │   └── ContentDetailDrawer.tsx  # Content detail drawer (with T011/T012 enhanced display)
│   │   ├── pages/
│   │   │   ├── dashboard/        # Workbench (aggregated homepage, H002-H011)
│   │   │   ├── search/           # Sentiment search
│   │   │   ├── monitoring/       # Monitoring scheme management
│   │   │   ├── alerts/           # Alert center
│   │   │   ├── industry-mappings/ # Industry mapping management (T001)
│   │   │   ├── temperature/      # Industry temperature dashboard (T005)
│   │   │   └── settings/         # System configuration (lexicons + crawler management + data source weights)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/                   # Static resources
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/                       # Crawler backend
│   ├── src/
│   │   ├── crawlers/             # 22 data source crawler adapters
│   │   │   ├── BaseCrawler.ts    # Abstract base class (retry/circuit breaker/NLP enhancement/event recognition)
│   │   │   ├── EastMoneyCrawler.ts    # East Money Quick News
│   │   │   ├── GubaCrawler.ts         # Stock Forum
│   │   │   ├── XueqiuCrawler.ts       # Xueqiu
│   │   │   ├── SinaFinanceCrawler.ts  # Sina Finance
│   │   │   ├── ClsCrawler.ts          # Caixin
│   │   │   ├── ThsCrawler.ts          # Thompson Securities
│   │   │   ├── ChinaSecuritiesJournalCrawler.ts # China Securities Journal / China Securities Daily
│   │   │   ├── RegulatoryAuthorityCrawler.ts    # Exchange / SEC / CSRC official news
│   │   │   ├── BrokerResearchCrawler.ts         # Top broker research reports (East Money research API)
│   │   │   ├── StockstarCrawler.ts              # Securities Star (financial news)
│   │   │   ├── FirstBankCrawler.ts              # First Bank (investment trend insights)
│   │   │   ├── Laohu8Crawler.ts       # T008 Community (social media)
│   │   │   ├── HKEXCrawler.ts         # HKEX (stocks, requires API)
│   │   │   ├── SECCrawler.ts          # SEC EDGAR (stubs, requires API)
│   │   │   ├── BloombergCrawler.ts    # Bloomberg (requires API Key)
│   │   │   ├── ReutersCrawler.ts      # Reuters (requires API Key)
│   │   │   ├── FutuCrawler.ts         # Futu Securities (requires OpenAPI or Cookie)
│   │   │   ├── TigerCrawler.ts        # Tiger Securities (requires OpenAPI or Token)
│   │   │   ├── WindCrawler.ts         # Wind/Wind (stub, requires paid API)
│   │   │   ├── ZhihuCrawler.ts        # Zhihu (stub, requires Cookie)
│   │   │   ├── XiaohongshuCrawler.ts  # Xiaohongshu (stub, requires anti-captcha signature)
│   │   │   └── DouyinCrawler.ts       # Douyin/TikTok (stub, requires anti-captcha signature)
│   │   ├── nlp/
│   │   │   ├── sentiment.ts                # Basic dictionary-based sentiment analysis
│   │   │   ├── financialSentimentModel.ts  # T011 Financial semantic sentiment model (dictionary/LLM adapter layer)
│   │   │   ├── eventRecognitionService.ts  # T012 Structured event recognition (8 types of financial events)
│   │   │   ├── relevanceService.ts         # T013 Subject relevance scoring service
│   │   │   └── industryMappingService.ts   # Industry mapping query service
│   │   ├── temperature/
│   │   │   ├── temperatureService.ts  # Temperature index computation (integrated T002/T006/T007/T013)
│   │   │   └── temperatureStore.ts    # Temperature snapshot storage and historical query
│   │   ├── dedup/
│   │   │   ├── dedupService.ts        # T007 Content deduplication and event clustering (Jaccard similarity)
│   │   │   └── eventClusterStore.ts   # Event cluster storage
│   │   ├── alerts/
│   │   │   └── alertEvaluationService.ts  # T010 Alert rule automatic evaluation (7 trigger conditions)
│   │   ├── scheduler/
│   │   │   └── CrawlScheduler.ts      # T009 Timed collection scheduler (circuit breaker/incremental/logging)
│   │   ├── storage/
│   │   │   ├── db.ts                  # T008 SQLite database connection
│   │   │   ├── JsonStorage.ts         # Content storage (memory index + SQLite persistence)
│   │   │   ├── alertsStore.ts         # Alert storage
│   │   │   ├── crawlLogsStore.ts      # Collection log storage
│   │   │   ├── industryMappingsStore.ts # Industry mapping storage
│   │   │   ├── lexiconsStore.ts       # Lexicon storage
│   │   │   ├── monitoringProjectsStore.ts # Monitoring scheme storage
│   │   │   └── sourceConfigsStore.ts  # Data source configuration storage
│   │   ├── api/
│   │   │   ├── routes.ts              # Express routes (aligned with OpenAPI contract)
│   │   │   └── dashboardSummaryHandler.ts  # H006 Homepage aggregation interface handler
│   │   ├── config.ts                  # Crawler default configuration
│   │   ├── types.ts                   # Backend TypeScript type definitions
│   │   ├── index.ts                   # Service entry point
│   │   ├── crawl-once.ts              # One-time manual crawl script
│   │   └── migrate.ts                 # JSON to SQLite data migration script
│   ├── .env                           # Environment variables (LLM API Key, etc.)
│   ├── tsconfig.json
│   └── package.json
├── AGENTS.md                          # Project development guidelines
├── .gitignore
└── README.md
```

## Core Function Modules

### Industry Temperature Index (T001-T007)

System's core capability, outputting an interpretable temperature index from 0-100 for 7 initial industries (AI Technology, Semiconductors, New Energy, Medical, Non-ferrous Metals, Banking, Real Estate).

**Temperature Formula:**
```
Sector Temperature = Sentiment Score × 35%
                   + Volume Change × 25%
                   + Propagation Heat × 20%
                   + Source Credibility × 20%
```

**Temperature Levels:**

| Range | Status | Meaning |
|-------|--------|---------|
| 0–19 | Cold Point | Low sentiment, negative or no attention |
| 20–39 | Cold | Weak attention and sentiment |
| 40–59 | Neutral | Sentiment and heat at normal levels |
| 60–79 | Hot | Positive sentiment or discussion heat significantly rising |
| 80–100 | Overheating | High heat and volatility, risk of crowd trading |

**T014 Subject Relevance Weighting:** Temperature calculations include relevance weighting. Content with relevance scores below 15 points is filtered out to avoid keyword misattribution.

**T007 Event Cluster Deduplication:** Volume calculations use event cluster count rather than raw content count to avoid amplification from cross-platform reposting of the same event.

### Financial Semantic Sentiment Model (T011)

Dual-model adapter layer supporting seamless switching:

- **Dictionary-enhanced Model (Default):** Outputs 7 fine-grained financial sentiment labels (Strong Positive/Weak Positive/Neutral/Weak Negative/Strong Negative/Risk/Hype), confidence scores (0-1), and human-readable reasoning
- **LLM Model (Optional):** Automatically enabled when `LLM_API_KEY` is configured; compatible with OpenAI/DeepSeek/Ollama/Azure; automatically falls back to dictionary model on failure
- High-impact content (risk keywords or strong signals) automatically tagged with `secondaryAnalysis=true`

### Structured Event Recognition (T012)

Recognizes 8 types of financial events, outputting impact direction, confidence, trigger words, and associated subjects:

| Event Type | Description |
|------------|-------------|
| `policy_change` | Policy changes |
| `earnings_forecast` | Earnings forecast |
| `shareholding_change` | Changes in shareholding |
| `merger_acquisition` | Mergers and acquisitions |
| `regulatory_penalty` | Regulatory penalties |
| `debt_default` | Debt defaults |
| `industry_prosperity` | Industry prosperity changes |
| `rating_change` | Research report rating changes |

### Alert Rule Engine (T010)

Supports 7 auto-trigger conditions with cooldown mechanism to prevent duplicate alerts:

- Industry temperature overheating (`temperatureAbove`)
- Industry temperature rising rapidly (`temperatureRiseAbove`)
- Research reports focusing on negative viewpoints (`brokerNegativeRatioAbove`)
- Sudden increase in negative volume (`negativeVolumeRiseAbove`)
- Market sentiment index too low (`sentimentBelow`)
- High-risk content appearing (`riskLevelAbove`)
- Risk keyword hits (`keywords`)

### Collection Scheduler (T009)

- Configuration of collection intervals per data source
- Failure retry + circuit breaker/backoff mechanisms (automatic circuit breaking after N consecutive failures)
- Health score (0-100)
- Incremental collection (only collects new content since last run)
- Persistent collection logs
- Automatic alert generation when circuit breaker triggers

## Data Source Weight System (T006)

22 data sources categorized by type, supporting:
- Credibility scores (0-100)
- Authorization status (Authorized/Limited/Unauthorized)
- Anti-captcha risk level (Low/Medium/High)
- Availability status (Normal/Unstable/Unavailable)
- Inclusion in temperature calculations (can be toggled individually)

## Supported Data Sources

| Data Source | Type | Credibility | Status | Notes |
|-------------|------|-------------|--------|-------|
| Regulatory Authority Announcements | Regulatory | 98 | Available | Shanghai/Shenzhen Stock Exchanges, CSRC HTML parsing |
| HKEX Disclosure E-Station | Regulatory | 97 | Stub | Requires `HKEX_API_KEY` |
| US SEC | Regulatory | 96 | Stub | Requires `SEC_API_KEY` |
| Brokerage Research Reports | Research | 92 | Available | East Money reportapi, covering mainstream brokers |
| First Bank | Research | 88 | Available* | Investment trend insights, HTML parsing |
| Bloomberg | News | 90 | Requires Authorization | Requires `BLOOMBERG_API_KEY` |
| Reuters | News | 88 | Requires Authorization | Requires `REUTERS_API_KEY` |
| China Securities Journal | News | 85 | Available | News channel HTML parsing |
| Caixin | News | 83 | Available* | Multi-endpoint fault tolerance |
| Sina Finance | News | 75 | Available | Rolling news REST API |
| Wind Information | Financial APP | 82 | Stub | Requires paid API authorization |
| Thompson Securities | Financial APP | 72 | Available | API + HTML fallback |
| East Money | Financial APP | 70 | Available | Finance quick news API + JSONP fallback |
| Securities Star | Financial APP | 65 | Available* | API + HTML fallback |
| Futu Securities | Financial APP | 68 | Requires Authorization | Requires `FUTU_API_KEY` or `FUTU_COOKIE` |
| Tiger Securities | Financial APP | 65 | Requires Authorization | Requires `TIGER_API_KEY` or `TIGER_TOKEN` |
| Xueqiu | Social Media | 52 | Available* | Requires cookie (auto-fetching, may be restricted) |
| T008 Community | Forum | 42 | Available* | API + HTML fallback |
| Stock Forum | Forum | 40 | Available | HTML parsing of hot posts |
| Zhihu | Social Media | 38 | Stub | Requires `ZHIHU_COOKIE`, not included in temperature calculation |
| Xiaohongshu | Social Media | 25 | Stub | Requires anti-captcha signature, not included in temperature calculation |
| Douyin | Social Media | 20 | Stub | Requires anti-captcha signature, not included in temperature calculation |

*Some data sources may be affected by target site anti-captcha strategies and require periodic maintenance.

### External Market / Brokerage Crawlers (Environment Variables)

| Environment Variable | Description |
|----------------------|-------------|
| `LLM_API_KEY` | LLM sentiment analysis API Key (compatible with OpenAI/DeepSeek/Ollama) |
| `LLM_BASE_URL` | LLM API address (default `https://api.openai.com/v1`) |
| `LLM_MODEL` | LLM model name (default `gpt-4o-mini`) |
| `BLOOMBERG_API_KEY` | Bloomberg news/API (optional `BLOOMBERG_API_URL`) |
| `REUTERS_API_KEY` | Reuters/Refinitiv (optional `REUTERS_API_URL`) |
| `FUTU_API_KEY` | Futu OpenAPI; when using local OpenD can set `FUTU_OPEND_URL` |
| `FUTU_COOKIE` | Futu web quick news (non-official, may expire) |
| `TIGER_API_KEY` + `TIGER_PRIVATE_KEY` | Tiger OpenAPI (optional `TIGER_API_URL`) |
| `TIGER_TOKEN` | Tiger web interface token |

The above crawlers are disabled by default (`enabled: false`), and must be enabled in the management backend after configuration.

## API Interfaces

All interfaces prefixed with `/api/v1`, complete definition see `openapi/openapi.yaml`.

| Interface | Description |
|-----------|-------------|
| `POST /auth/login` | User login |
| `GET /contents` | Sentiment content search (supports keyword/source/sentiment/risk/time filtering) |
| `GET /contents/stats` | Sentiment statistics (sentiment distribution/risk distribution/trend/keywords/entities) |
| `POST /contents/:id/sentiment/analyze` | T011 triggers enhanced sentiment secondary analysis |
| `POST /contents/:id/events/analyze` | T012 triggers structured event recognition |
| `GET /contents/events/distribution` | T012 event type distribution statistics |
| `GET /temperatures` | Industry temperature ranking list |
| `GET /temperatures/:industryId` | Single industry temperature details (risk distribution and key content) |
| `GET /temperatures/:industryId/trend` | Industry temperature historical trend |
| `GET /monitoring-projects` | Monitoring scheme list |
| `POST /monitoring-projects` | Create monitoring scheme |
| `GET /alerts` | Alert list |
| `POST /alerts/:id/handle` | Handle alert |
| `GET /alert-rules` | Alert rule list |
| `POST /alerts/evaluate` | Manually trigger alert rule evaluation |
| `GET /industry-mappings` | Industry mapping list |
| `POST /industry-mappings/query` | Keyword matching industry query |
| `GET /source-configs` | Data source configuration list |
| `PUT /source-configs/:id` | Update data source configuration |
| `POST /source-configs/:id/toggle` | Toggle data source inclusion in temperature calculation |
| `GET /lexicons` | Lexicon list |
| `GET /dashboard/summary` | Homepage aggregated data (H006) |
| `GET /crawlers/status` | Crawler status list |
| `POST /crawlers/run-all` | Run all crawlers |
| `POST /crawlers/:name/run` | Run single crawler |
| `POST /crawlers/:name/toggle` | Enable/disable crawler |

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Workbench | Aggregated homepage: alert summary, industry temperature Top5, temperature change dynamics, key driving content, risk event distribution, collection health, monitoring scheme hit ranking |
| `/search` | Sentiment Search | Multi-dimensional filter search, supports content detail viewing (with T011/T012 enhanced analysis) |
| `/monitoring` | Monitoring Schemes | Scheme CRUD, supports industry/sector/stock pool monitoring target configuration |
| `/alerts` | Alert Center | Alert list, handling process, alert rule management |
| `/industry-mappings` | Industry Mapping | Industry/sector/concept/theme mapping management, supports keyword matching test |
| `/temperature` | Industry Temperature | Temperature ranking, change ranking, high/low temperature sector cards, temperature details drawer (trend chart/radar chart/event distribution) |
| `/settings` | System Configuration | Lexicon management, crawler management, data source weight configuration |

## Architecture Data Flow

```
Frontend React UI (web/)
    ↕ (API Client + React Query)
Vite Dev Proxy (/api/v1 → localhost:3001)
    ↕
Express API Server (server/, port 3001)
    ↕
┌──────────────────────────────────────────────────────┐
│  CrawlScheduler（Timed scheduling + circuit breaker + incremental collection）│
│    ↕                                                  │
│  Crawlers（22 data source adapters）                  │
│    → HTTP/CheerIO → Target websites                   │
│    ↕                                                  │
│  NLP Pipeline                                         │
│    ├── sentiment.ts（Basic dictionary sentiment analysis）│
│    ├── financialSentimentModel.ts（T011 Fine-grained sentiment）│
│    ├── eventRecognitionService.ts（T012 Event recognition）│
│    └── relevanceService.ts（T013 Relevance scoring）  │
│    ↕                                                  │
│  dedupService.ts（T007 Deduplication clustering）       │
│    ↕                                                  │
│  SQLite Storage（data/sentiment.db）                  │
│    ↕                                                  │
│  temperatureService.ts（T002 Temperature computation）│
│    ↕                                                  │
│  alertEvaluationService.ts（T010 Alert evaluation）   │
└──────────────────────────────────────────────────────┘
```

## Task Completion Status

| Task | Description | Status |
|------|-------------|--------|
| T001 | Industry/sector mapping system | ✅ Completed |
| T002 | Temperature index formula MVP | ✅ Completed |
| T003 | Monitoring scheme upgrade | ✅ Completed |
| T004 | Industry temperature API | ✅ Completed |
| T005 | Industry temperature dashboard | ✅ Completed |
| T006 | Data source weight system | ✅ Completed |
| T007 | Content deduplication and event clustering | ✅ Completed |
| T008 | Database storage upgrade (SQLite) | ✅ Completed |
| T009 | Collection task stability enhancement | ✅ Completed |
| T010 | Alert rule upgrade | ✅ Completed |
| T011 | Financial semantic sentiment model | ✅ Completed |
| T012 | Structured event recognition | ✅ Completed |
| T013 | Subject relevance scoring | ✅ Completed |
| T014 | Market data linkage | ⬜ Not Started |
| T015 | Backtesting evaluation system | ⬜ Not Started |
| T016 | Manual annotation and sample management | ⬜ Not Started |
| T017 | Compliance and authorization governance | ⬜ Not Started |
| T018 | Permissions, logs and audit | ⬜ Not Started |

See `spec/task.md` for detailed task descriptions, and `spec/plan.md` for system improvement plans.

## Compliance Reminder

This project is for POC demonstration only. Scraping third-party website data may violate the target site's terms of service.
For production use, please:
1. Assess and comply with each platform's robots.txt and Terms of Service
2. Prefer official APIs or authorized data service providers
3. Comply with laws and regulations such as the Personal Information Protection Law
4. Do not commit credentials, Cookies, or tokens to code repositories
