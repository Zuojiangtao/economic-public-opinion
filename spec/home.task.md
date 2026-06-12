# 首页工作台改版任务拆解

## 完成状态说明

| 标记 | 含义 |
| --- | --- |
| ✅ 已完成 | 核心功能已实现，验收标准基本达到 |
| 🚧 部分完成 | 主体功能已实现，存在待完善项 |
| ⬜ 未开始 | 尚未实现 |

## 任务优先级说明

| 优先级 | 定义 | 目标 |
| --- | --- | --- |
| P0 | 低成本高收益 | 在不大改架构的前提下，让首页更像工作台 |
| P1 | 角色重构 | 把首页从统计页升级为异常识别中心 |
| P2 | 可解释闭环 | 让首页结论更可信、更便于投研使用 |

改版总体方向参见 [home.spec.md](./home.spec.md)。

---

## P0 低成本高收益优化

### H001 修正首页预警数字口径 ✅ 已完成

**任务类别**：前端数据修正

**目标**：确保首页"待处理预警"和"高风险预警"统计数字可信，不受列表截断影响。

**背景**：当前首页只拉取 5 条预警，再从结果里 filter `pending` 计数，真实待处理数超过 5 条时会少报。

**需求拆解**：

- 首页指标卡的预警数字改为从专用统计接口获取，而不是从分页列表截断后再计算。
- 若后端暂无专用统计接口，可复用 `GET /alerts` 接口并传 `pageSize=1`，读 `total` 字段作为全量数。
- 分两个独立请求分别获取 `pending` 总数和 `high/critical` 总数。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 修改：指标卡预警数改用全量统计值。
- 两个独立 React Query：`['alertCount', 'pending']` 和 `['alertCount', 'highRisk']`。

**验收标准**：

- 首页"待处理预警"数字与预警中心页展示的 pending 总数一致。
- 首页"高风险预警"数字与预警中心按 `high/critical` 筛选后的 total 一致。

---

### H002 首页顶部指标卡重组 ✅ 已完成

**任务类别**：前端改版

**目标**：将顶部 4 个通用统计卡（总量、正面、负面、待处理预警）替换为 6 个业务价值更高的异常指标。

**需求拆解**：

- 新的 6 个指标卡依次为：
  1. **待处理预警数**：全量 pending 总数，点击跳转 `/alerts?status=pending`。
  2. **高风险预警数**：`high + critical` 总数，点击跳转 `/alerts?riskLevel=high`。
  3. **最热行业**：当前温度排名第一的行业名称及分数，点击进入行业温度详情抽屉。
  4. **升温最快行业**：`scoreDelta` 最大的行业名称及变化值，点击进入行业温度详情抽屉。
  5. **负面占比最高行业**：所有行业中负面内容占比最高的行业名称及占比，点击跳转 `/search?sentiment=negative&industryId=xxx`。
  6. **近 24 小时异常事件数**：所有内容中识别到高风险事件（`riskLevel=high/critical`）的数量。
- 每个指标卡保留颜色语义：预警/风险类为红/橙，热度类为火红，正常为蓝。
- 指标卡支持 `loading` 骨架占位。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 改版：6 卡布局，含跳转逻辑。
- 用到 `temperaturesApi.list()` 获取最热行业和升温最快行业。
- 用到 `contentsApi.getStats()` 获取近 24 小时高风险事件数。

**验收标准**：

- 首屏 6 卡全部有明确跳转目标，点击不报错。
- 最热行业、升温最快行业数字与行业温度页展示一致。
- 页面在加载中有 loading 状态，数据到位前不展示空值或 `0`。

---

### H003 行业温度摘要上浮首页 ✅ 已完成

**任务类别**：前端改版

**目标**：将行业温度 Top 榜和升降温榜从行业温度页提取并展示在首页第二行。

**需求拆解**：

- 首页第二行分两列：
  - 左侧：行业温度 Top 5，按当前分数从高到低，展示行业名、分数、温度标签，点击进入行业温度详情。
  - 右侧：升温前 3 / 降温前 3，展示行业名、变化值，按 `scoreDelta` 绝对值排序，点击进入行业温度详情。
- 温度榜不需要完整的 `TemperatureCard` 组件，改用精简列表样式，信息密度更高。
- 两列均展示"查看全部"跳转到 `/temperature`。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 新增第二行温度榜区域。
- 复用 `temperaturesApi.list()` 接口，Query Key `['temperatures', 'dashboard']`。
- 颜色和温度标签复用 `temperature/index.tsx` 中已有的 `levelConfig`，提取为共享常量或 inline 定义。

**验收标准**：

- 首页第二行展示行业温度 Top 5 和升降温各前 3。
- 点击行业名可进入行业温度详情。
- 点击"查看全部"跳转到行业温度页。

---

### H004 将最新预警升级为高优先级预警列表 ✅ 已完成

**任务类别**：前端改版

**目标**：将首页底部预警列表从"最新 5 条"改为"高优先级（pending + high/critical）"，增加处置入口。

**需求拆解**：

- 列表默认展示 `status=pending` 且 `riskLevel` 为 `high` 或 `critical` 的预警，最多 8 条。
- 若无高优先级预警，则展示最新 pending 预警，同时展示"暂无高风险预警"空态提示。
- 每行增加"处置"按钮，点击跳转到预警中心并打开对应预警详情。
- 列表右上角标题区改为"高优先级预警"，旁边展示 badge 数量。
- 保留"查看全部"跳转 `/alerts`。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 预警列表部分改版。
- Query Key 改为 `['alerts', { status: 'pending', riskLevel: 'high', pageSize: 8 }]`。
- 新增"处置"列，点击时通过 `useNavigate` 跳转到 `/alerts` 并携带 query 参数 `?openId=xxx`，由预警中心页自行读取并弹出详情。

**验收标准**：

- 首页预警列表只展示 pending 且 high/critical 的预警。
- 若无此类预警，展示合理空态，不展示 0 或空表格。
- 点击"处置"可跳转并定位到对应预警。

---

### H005 首页增加时间范围筛选 ✅ 已完成

**任务类别**：前端改版

**目标**：为首页统计数据增加时间范围上下文，支持"今日""近 24 小时""近 7 日"切换。

**需求拆解**：

- 首页标题行右侧增加 `Segmented` 时间范围组件，默认"今日"。
- 选项：今日 / 近 24 小时 / 近 7 日。
- 时间范围切换后，`contentsApi.getStats()`、`temperaturesApi.list()` 均传入对应 `startDate/endDate` 重新请求。
- 预警列表和预警数字暂不受时间筛选影响（预警是操作型数据，不宜按时间截断）。
- 筛选状态用 `useState` 管理，不需要持久化。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 标题区增加时间筛选。
- 构造 `startDate/endDate` 的 helper 函数（今日取 `00:00:00`，近 24 小时取 `now - 24h`，近 7 日取 `now - 7d`）。
- 各 Query Key 带入时间参数，确保切换时触发 refetch。

**验收标准**：

- 切换时间范围后，舆情统计和温度榜数据刷新。
- 数据加载中有 loading 状态。
- 时间范围筛选仅影响内容类数据，不影响预警数字口径。

---

## P1 首页角色重构

### H006 新增首页聚合接口（后端） ✅ 已完成

**任务类别**：后端接口

**目标**：新增一个首页专用聚合接口，避免前端拼装多路请求时的口径不一致问题。

**需求拆解**：

- 新增接口 `GET /api/v1/dashboard/summary`，支持以下 query 参数：
  - `startDate`：统计起始时间。
  - `endDate`：统计截止时间。
  - `market`：市场范围，`cn / hk / us`，可多选以逗号分隔。
  - `projectId`：监测方案 ID。
- 接口返回以下字段（初版）：
  - `pendingAlertCount`：待处理预警总数。
  - `highRiskAlertCount`：高风险预警总数（`high + critical`）。
  - `hotIndustry`：温度最高的行业名称、ID、分数、温度等级。
  - `fastestRisingIndustry`：升温最快的行业名称、ID、`scoreDelta`。
  - `mostNegativeIndustry`：负面占比最高的行业名称、ID、负面占比。
  - `recentHighRiskEventCount`：时间范围内高风险事件数量。
  - `temperatureTopList`：温度 Top 5，含名称、分数、等级、`scoreDelta`。
  - `risingList`：升温前 3。
  - `fallingList`：降温前 3。
  - `topAlerts`：高优先级预警前 8 条（`pending + high/critical`）。
- 接口数据各字段应与对应独立接口的统计口径保持一致。

**交付物**：

- `server/src/api/routes.ts`：新增 `GET /dashboard/summary` 路由。
- 新建 `server/src/api/dashboardSummaryHandler.ts`（或 inline handler）：聚合各服务数据。
- `openapi/openapi.yaml`：补充该接口的 schema 定义。
- `web/src/api/types.ts`：新增 `DashboardSummary` 类型。
- `web/src/api/client.ts`：新增 `dashboardApi.getSummary(params)` 方法。
- `web/src/mocks/handlers.ts`：新增对应 MSW mock handler。
- `web/src/mocks/data/`：新增 `dashboard.ts` mock 数据。

**验收标准**：

- `GET /api/v1/dashboard/summary` 可正常返回完整字段。
- 接口返回的预警数、行业温度与对应独立接口一致。
- 前端 mock 模式下可正常渲染首页。

---

### H007 首页接入聚合接口（前端） ✅ 已完成

**任务类别**：前端改版

**目标**：用 H006 聚合接口替换首页多路零散请求，统一数据来源和筛选口径。

**需求拆解**：

- 用 `dashboardApi.getSummary(params)` 替换首页现有的 `contentsApi.getStats()`、`alertsApi.list()`、`temperaturesApi.list()` 三路请求。
- 所有首页模块（指标卡、温度榜、预警列表）统一从聚合接口取数，保证口径一致。
- 时间范围、市场、监测方案筛选统一通过聚合接口参数传递。
- Query Key `['dashboardSummary', { startDate, endDate, market, projectId }]`。
- 整体加载状态统一由聚合接口控制，不再出现各区域 loading 时序不一致的问题。

**交付物**：

- `web/src/pages/dashboard/index.tsx` 大幅精简：移除多路 Query，改为单路聚合 Query。

**验收标准**：

- 首页切换筛选条件后，所有区域数据同步刷新。
- 不出现"预警数字与列表不一致"的情况。
- 新增监测方案筛选后，数据按方案范围返回。

---

### H008 首页增加关键驱动内容模块 ✅ 已完成

**任务类别**：前端改版 + 后端增强

**目标**：在首页第二层展示当前最热行业的关键驱动内容，让"为什么热"有内容支撑。

**需求拆解**：

- 首页新增"关键驱动内容"模块，展示当前最热行业的高影响力内容 Top 5。
- 每条内容展示：标题（截断 50 字）、情感标签、风险等级、来源名称、发布时间、摘要（截断 80 字）。
- 点击内容标题进入 `ContentDetailDrawer`。
- 若当前筛选有监测方案，优先展示该方案范围内的关键内容。
- 后端：`GET /api/v1/dashboard/summary` 的 `topAlerts` 附近增加 `keyContents` 字段，返回前 5 条影响力最高内容（按 `riskLevel` 降序再按 `publishedAt` 降序）。

**交付物**：

- `server/src/api/dashboardSummaryHandler.ts`：补充 `keyContents` 字段逻辑。
- `web/src/api/types.ts`：`DashboardSummary` 补充 `keyContents: ContentItem[]`。
- `web/src/pages/dashboard/index.tsx`：新增关键驱动内容 Card。
- 复用 `web/src/components/ContentDetailDrawer.tsx`。

**验收标准**：

- 首页展示 Top 5 关键驱动内容，字段完整。
- 点击标题可打开内容详情。
- 无数据时展示合理空态。

---

### H009 首页增加风险事件分布模块 ✅ 已完成

**任务类别**：前端改版

**目标**：在首页第二层展示当前时间范围内高风险事件的类型分布，支持下钻到检索页。

**需求拆解**：

- 新增"风险事件分布"Card，展示各事件类型（`FinancialEventType`）的 `count` 横向条形图或标签云。
- 高风险类型（`regulatory_penalty`、`debt_default`）颜色突出。
- 点击某事件类型跳转到 `/search`，并携带事件类型参数（前端 URL query 方式）。
- 数据来源：`contentsApi.getEventDistribution()` 或通过聚合接口返回。
- 如果聚合接口已包含此数据，从聚合接口取；否则单独请求。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：新增风险事件分布 Card。
- `web/src/pages/search/index.tsx`：检索页支持读取 URL query 中的 `eventType` 参数并自动填入筛选。

**验收标准**：

- 首页展示各事件类型分布。
- 点击某类型可跳转检索页并自动筛选。
- 无事件数据时展示合理空态，不展示空图表。

---

### H010 首页增加采集健康摘要 ✅ 已完成

**任务类别**：前端改版

**目标**：在首页第三层展示采集源健康状态摘要，帮助运营快速感知数据管道是否正常。

**需求拆解**：

- 新增"采集健康摘要"Card，展示以下指标：
  - 当前可用数据源数量 / 总数。
  - 近 24 小时发生过采集失败的来源数量。
  - 最近 3 条失败来源名称和最近失败时间。
- 点击"查看详情"跳转到 `/settings`（系统配置页中数据源配置区域）。
- 数据来源：`GET /api/v1/crawlers/status` 或 `sourceConfigsApi.list()`，取 `availabilityStatus` 为 `unavailable/unstable` 的条目统计。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：新增采集健康摘要 Card。
- `web/src/api/client.ts`：若需要新增 `crawlersApi.getStatus()` 调用则补充。

**验收标准**：

- 首页展示当前采集源可用数和失败数。
- 有失败来源时明确展示来源名称。
- 全部正常时展示绿色"采集正常"状态。

---

### H011 首页增加监测方案活跃度模块 ✅ 已完成

**任务类别**：前端改版

**目标**：在首页第三层展示监测方案当日命中排行，帮助分析师了解哪个方案正在高强度运转。

**需求拆解**：

- 新增"监测方案命中排行"Card，展示命中次数前 5 的监测方案。
- 每行展示方案名称、命中数量、是否有高风险内容（以 badge 形式）。
- 点击方案名称跳转到 `/monitoring` 监测方案列表页。
- 数据来源：`contentsApi.getStats()` 中已有 `matches` 信息，或通过后端增加方案命中统计字段。
- P1 阶段可以使用现有 stats 数据按 `matches.projectName` 聚合，P2 阶段改为专用接口。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：新增监测方案命中排行 Card。

**验收标准**：

- 首页展示前 5 监测方案命中数排行。
- 有高风险命中时有显著提示。
- 点击方案名可进入监测方案页。

---

## P2 可解释闭环

### H012 首页支持监测方案筛选 ⬜ 未开始

**任务类别**：前端改版

**目标**：在首页顶部筛选条增加"监测方案"维度，让分析师聚焦特定方案看首页数据。

**需求拆解**：

- 筛选条增加监测方案 `Select`，从 `monitoringApi.list()` 拉取可选方案列表。
- 默认"全部方案"（不传 `projectId`）。
- 选中某方案后，所有统计数据以该方案为上下文过滤。
- 聚合接口 `GET /dashboard/summary` 需要支持 `projectId` 参数。
- 筛选状态用 `useState` 管理，不持久化。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：顶部筛选条增加监测方案 Select。
- `server/src/api/dashboardSummaryHandler.ts`：支持 `projectId` 参数过滤。

**验收标准**：

- 选择某监测方案后，首页各模块数据缩小到该方案范围。
- 全部方案下与无筛选行为一致。

---

### H013 首页行业温度分项贡献快速展示 ⬜ 未开始

**任务类别**：前端改版

**目标**：在首页温度榜中，支持悬停或展开查看某行业的温度分项贡献，无需跳转。

**需求拆解**：

- 行业温度榜每行增加分项迷你条，展示情绪得分、声量异动、传播热度、来源可信度四项，用不同颜色区分。
- 每项使用 `Tooltip` 展示具体数值。
- 不增加新的网络请求，数据已在 `temperaturesApi.list()` 的 `breakdown` 字段中。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：温度榜精简卡片增加 breakdown 迷你展示。

**验收标准**：

- 首页温度榜每行显示 4 项分项小图标或分项条。
- Tooltip 悬停可看到具体分值。

---

### H014 首页关键事件置信度展示 ✅ 已完成

**任务类别**：前端改版

**目标**：在关键驱动内容模块中，为每条内容展示识别到的事件类型和置信度，增强可解释性。

**需求拆解**：

- 关键驱动内容每条展示识别到的 `StructuredEvent` 中置信度最高的一条事件类型标签和置信度值。
- 置信度低于 0.6 的展示"待确认"标记。
- 仅在 `nlp.events` 存在时展示，无事件时不占位。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：关键驱动内容 Card 补充事件标签。

**验收标准**：

- 识别到事件的内容展示事件类型标签和置信度。
- 置信度低的有"待确认"标记。
- 无事件的内容不展示事件区域。

---

### H015 首页保存筛选视图（可选） ⬜ 未开始

**任务类别**：前端增强

**目标**：允许用户保存常用的首页筛选组合（时间范围 + 市场 + 监测方案），下次进入首页自动恢复。

**需求拆解**：

- 筛选状态改为 `localStorage` 持久化，key 为 `dashboard_filter`。
- 用户下次进入首页时读取并恢复筛选状态。
- 增加"重置"按钮清除持久化筛选。

**交付物**：

- `web/src/pages/dashboard/index.tsx`：筛选状态持久化。

**验收标准**：

- 刷新页面后筛选状态恢复。
- 点击重置后清除并恢复默认。

---

## 依赖关系

| 任务 | 依赖任务 |
| --- | --- |
| H001 | 无 |
| H002 | H001 |
| H003 | 无 |
| H004 | H001 |
| H005 | 无 |
| H006 | 无（后端新接口） |
| H007 | H006 |
| H008 | H006、H007 |
| H009 | H005 |
| H010 | 无 |
| H011 | 无 |
| H012 | H006、H007 |
| H013 | H003 |
| H014 | H008 |
| H015 | H005、H012 |

## 交付文件汇总

### 前端文件

| 文件 | 涉及任务 |
| --- | --- |
| `web/src/pages/dashboard/index.tsx` | H001~H005、H007~H011、H013~H015 |
| `web/src/pages/search/index.tsx` | H009 |
| `web/src/api/types.ts` | H006、H008 |
| `web/src/api/client.ts` | H006、H010 |
| `web/src/mocks/handlers.ts` | H006 |
| `web/src/mocks/data/dashboard.ts` | H006（新建） |

### 后端文件

| 文件 | 涉及任务 |
| --- | --- |
| `server/src/api/routes.ts` | H006 |
| `server/src/api/dashboardSummaryHandler.ts` | H006、H008、H012（新建） |
| `openapi/openapi.yaml` | H006 |
