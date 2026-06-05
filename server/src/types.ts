export type SourceType = 'news' | 'forums' | 'social' | 'broker' | 'app' | 'regulatory';

// ==================== Source Configs (T006) ====================

export type AuthorizationStatus = 'authorized' | 'unauthorized' | 'restricted';
export type AntiCrawlRisk = 'low' | 'medium' | 'high';
export type AvailabilityStatus = 'available' | 'unavailable' | 'unstable';

export interface SourceConfig {
  /** 唯一标识，通常等同于爬虫类名 */
  id: string;
  /** 展示名称 */
  name: string;
  /** 与 ContentItem.sourceName 对应的精确匹配字段 */
  sourceName: string;
  /** 数据源类型 */
  sourceType: SourceType;
  /** 可信度评分 0-100 */
  credibilityScore: number;
  /** 是否纳入温度计算 */
  includeInTemperature: boolean;
  /** 授权状态 */
  authorizationStatus: AuthorizationStatus;
  /** 反爬风险等级 */
  antiCrawlRisk: AntiCrawlRisk;
  /** 可用状态 */
  availabilityStatus: AvailabilityStatus;
  /** 备注说明 */
  description?: string;
  updatedAt: string;
}
export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MarketType = 'cn' | 'hk' | 'us';  // A股/港股/美股

// ==================== T011 金融语义情绪模型 ====================

/** 精细金融情绪标签 */
export type FinancialSentimentLabel =
  | 'strong_positive'  // 强利好
  | 'weak_positive'    // 弱利好
  | 'neutral'          // 中性
  | 'weak_negative'    // 弱利空
  | 'strong_negative'  // 强利空
  | 'risk'             // 风险
  | 'rumor';           // 传闻

/** 分析来源 */
export type SentimentModelSource = 'dictionary' | 'llm';

/** 金融语义情绪增强分析结果 */
export interface EnhancedSentimentResult {
  /** 精细情绪标签 */
  label: FinancialSentimentLabel;
  /** 置信度 0-1 */
  confidence: number;
  /** 判断理由（关键词/规则驱动的解释） */
  reasoning: string;
  /** 是否经过二次深度分析（高影响内容） */
  secondaryAnalysis: boolean;
  /** 分析来源 */
  modelSource: SentimentModelSource;
  /** 命中的正面关键词 */
  positiveSignals: string[];
  /** 命中的负面关键词 */
  negativeSignals: string[];
  /** 命中的风险关键词 */
  riskSignals: string[];
  /** 命中的传闻关键词 */
  rumorSignals: string[];
}

export interface ContentMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
}

export interface ContentEntity {
  name: string;
  type: 'company' | 'person' | 'product' | 'industry' | 'index';
}

// ==================== T012 结构化事件识别 ====================

/**
 * 金融事件类型枚举
 */
export type FinancialEventType =
  | 'policy_change'          // 政策变化
  | 'earnings_forecast'      // 业绩预告
  | 'shareholding_change'    // 增减持
  | 'merger_acquisition'     // 并购重组
  | 'regulatory_penalty'     // 监管处罚
  | 'debt_default'           // 债务违约
  | 'industry_prosperity'    // 产业景气变化
  | 'rating_change';         // 研报评级变化

/** 事件影响方向 */
export type EventImpactDirection = 'positive' | 'negative' | 'neutral' | 'uncertain';

/** 结构化事件识别结果 */
export interface StructuredEvent {
  /** 事件类型 */
  type: FinancialEventType;
  /** 事件影响方向 */
  impactDirection: EventImpactDirection;
  /** 置信度 0-1 */
  confidence: number;
  /** 命中的关键词/触发词 */
  triggers: string[];
  /** 识别出的关联主体（公司/行业/人名等） */
  subjects: string[];
  /** 事件摘要（简短描述） */
  summary: string;
}

export interface ContentNlp {
  sentiment: number;
  sentimentLabel: SentimentLabel;
  riskLevel: RiskLevel;
  summary: string;
  entities: ContentEntity[];
  /** T011: 金融语义情绪增强分析 */
  enhanced?: EnhancedSentimentResult;
  /** T012: 结构化事件识别结果 */
  events?: StructuredEvent[];
}

export interface ContentItem {
  id: string;
  title: string;
  content: string;
  sourceType: SourceType;
  sourceName: string;
  author: string;
  url: string;
  publishedAt: string;
  fetchedAt: string;
  metrics: ContentMetrics;
  matches: { projectId: string; projectName: string; keywords: string[]; tags: string[] }[];
  nlp: ContentNlp;
  dedup: { clusterId: string; similarCount: number };
  market: MarketType;
}

export interface CrawlResult {
  source: string;
  items: ContentItem[];
  fetchedAt: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface CrawlerConfig {
  enabled: boolean;
  intervalMinutes: number;
  pageSize: number;
  maxPages: number;
  userAgent: string;
  timeout: number;
  retries: number;
  /** 连续失败几次后触发熔断，默认 3 */
  circuitBreakerThreshold: number;
  /** 熔断后退避时长（分钟），默认 10 */
  backoffMinutes: number;
}

export interface CrawlerStatus {
  name: string;
  sourceName: string;
  enabled: boolean;
  lastCrawlAt?: string;
  lastSuccess: boolean;
  lastError?: string;
  totalFetched: number;
  isRunning: boolean;
  /** 累计采集尝试次数（含失败） */
  totalAttempts: number;
  /** 连续失败次数，成功后归零 */
  consecutiveFailures: number;
  /** 熔断是否打开（过多连续失败时自动开启） */
  circuitOpen: boolean;
  /** 熔断截止时间（ISO 字符串），到期后自动重试 */
  circuitOpenUntil?: string;
  /** 健康度评分 0-100，基于连续失败和熔断状态 */
  healthScore: number;
  /** 上次成功采集的最新条目时间，用于增量采集参考 */
  lastItemAt?: string;
}

// ==================== Crawl Logs ====================

export interface CrawlLog {
  id: string;
  source: string;
  success: boolean;
  itemsFetched: number;
  itemsAdded: number;
  error?: string;
  duration: number;
  crawledAt: string;
  /** 是否为增量采集（有 sinceItemAt 参考时间时为 true） */
  isIncremental: boolean;
}

export type IndustryType = 'industry' | 'sector' | 'concept' | 'theme';
export type ChainPosition = 'upstream' | 'midstream' | 'downstream';

export interface StockMapping {
  code: string;
  name: string;
  shortName?: string;
  englishName?: string;
  aliases?: string[];
  market: MarketType;
  chainPosition?: ChainPosition;
}

export interface OverseasMapping {
  code: string;
  name: string;
  market: MarketType;
  mappedThemes: string[];
}

export interface IndustryMapping {
  id: string;
  name: string;
  type: IndustryType;
  description?: string;
  keywords: string[];
  synonyms: string[];
  relatedConcepts: string[];
  stocks: StockMapping[];
  indices: string[];
  overseasMappings: OverseasMapping[];
  parentId?: string;
  childIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IndustryQueryResult {
  industry: IndustryMapping;
  matchedTerms: string[];
  relevanceScore: number;
}

// ==================== Monitoring Projects ====================

export type MonitorTargetType = 'industry' | 'sector' | 'concept' | 'stock_pool' | 'index';
export type OutputCycle = 'realtime' | 'hourly' | 'daily';

export interface SourceWeightConfig {
  sourceType: SourceType;
  /** 0.0 ~ 1.0 */
  weight: number;
  enabled: boolean;
}

export interface MonitoringProjectKeywords {
  /** 核心词（主要匹配） */
  core: string[];
  /** 扩展词（辅助匹配） */
  extended: string[];
  /** 排除词 */
  exclude: string[];
  /** @deprecated backward compat, treated as core */
  include?: string[];
}

export interface MonitoringProject {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'archived';
  /** 监测对象类型 */
  targetType: MonitorTargetType;
  /** 关联的行业/板块/概念/指数 ID 列表 */
  targetIds: string[];
  keywords: MonitoringProjectKeywords;
  sourceTypes: SourceType[];
  sourceWeights: SourceWeightConfig[];
  /** 温度预警阈值 0-100 */
  temperatureThreshold: number;
  /** 紧急预警阈值 0-100 */
  alertThreshold: number;
  outputCycle: OutputCycle;
  /** @deprecated legacy */
  sentimentThreshold?: number;
  /** @deprecated legacy */
  riskThreshold?: RiskLevel;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Temperature ====================


/** 温度分层 */
export type TemperatureLevel = 'freezing' | 'cool' | 'neutral' | 'warm' | 'hot';

/** 各分项得分明细 */
export interface TemperatureBreakdown {
  /** 情绪得分 0-100，权重 35% */
  sentimentScore: number;
  /** 声量异动得分 0-100，权重 25% */
  volumeAnomalyScore: number;
  /** 传播热度得分 0-100，权重 20% */
  spreadIntensityScore: number;
  /** 来源可信度得分 0-100，权重 20% */
  sourceCredibilityScore: number;
}

/** 温度快照（某一时刻某行业的温度计算结果） */
export interface TemperatureSnapshot {
  id: string;
  industryId: string;
  industryName: string;
  /** 综合温度分 0-100 */
  score: number;
  /** 温度分层 */
  level: TemperatureLevel;
  /** 分项贡献 */
  breakdown: TemperatureBreakdown;
  /** 命中内容数量 */
  contentCount: number;
  /** 正/中/负内容分布 */
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  /** 快照时间（小时级或日级） */
  snapshotAt: string;
  /** 时间粒度 */
  granularity: 'hour' | 'day';
}

/** 风险内容分布 */
export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

/** 关键驱动内容摘要（用于温度详情） */
export interface TopContentSummary {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceName: string;
  publishedAt: string;
  sentiment: SentimentLabel;
  riskLevel: RiskLevel;
  url: string;
}

/** 行业温度详情（快照 + 风险分布 + 关键内容） */
export interface TemperatureDetail extends TemperatureSnapshot {
  riskDistribution: RiskDistribution;
  topContents: TopContentSummary[];
}

// ==================== Event Clusters (T007) ====================

/**
 * 事件簇：将跨平台、跨来源的相似内容归并为同一事件。
 * 温度计算以事件簇为单位聚合声量，避免同一事件多平台转载后
 * 重复放大影响力。
 */
export interface EventCluster {
  /** 唯一标识，格式 cluster-<hash> */
  id: string;
  /** 代表性内容 ID（最早或互动量最高） */
  representativeId: string;
  /** 簇内所有内容 ID */
  itemIds: string[];
  /** 涉及的不同来源名称列表 */
  sourceNames: string[];
  /** 不同来源数量 */
  sourceCount: number;
  /** 聚合总互动量（likes + comments + shares + views*0.1） */
  totalEngagement: number;
  /** 情绪均值 [-1, 1] */
  avgSentiment: number;
  /** 主要情绪标签（占比最大） */
  dominantSentiment: SentimentLabel;
  /** 最高风险等级 */
  maxRiskLevel: RiskLevel;
  /** 代表性标题（来自代表内容） */
  title: string;
  /** 首次出现时间 */
  firstSeenAt: string;
  /** 最后更新时间 */
  lastSeenAt: string;
}

// ==================== Alerts (T010) ====================

export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';
export type AlertAction = 'start_processing' | 'resolve' | 'ignore' | 'reopen';

export interface AlertHandleRecord {
  handler: string;
  action: string;
  note: string;
  timestamp: string;
}

/** 预警规则触发条件（T010 升级版） */
export interface AlertRuleConditions {
  /** 风险关键词命中，匹配内容标题或正文 */
  keywords?: string[];
  /** 平均情绪指数低于此值时触发（[-1, 1]） */
  sentimentBelow?: number;
  /** 出现此级别及以上风险内容时触发 */
  riskLevelAbove?: RiskLevel;
  /** 负面声量突增：负面内容数量在时间窗口内增长率（%）超过此值触发 */
  negativeVolumeRiseAbove?: number;
  /** 过滤来源类型，为空时不过滤 */
  sourceTypes?: SourceType[];
  /** 行业温度超过此值时触发（过热预警，0-100） */
  temperatureAbove?: number;
  /** 行业温度涨幅超过此值时触发（快速升温，绝对分值）*/
  temperatureRiseAbove?: number;
  /** 研报负面比例超过此值时触发（0-1，研报观点集中转向） */
  brokerNegativeRatioAbove?: number;
  /** 限定触发范围的行业 ID 列表，为空则对所有行业生效 */
  industryIds?: string[];
  /** 检测时间窗口（分钟），默认 120 */
  windowMinutes?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertRuleConditions;
  createdAt: string;
  updatedAt?: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  status: AlertStatus;
  ruleName: string;
  ruleId?: string;
  triggeredAt: string;
  relatedContentIds: string[];
  handleRecords: AlertHandleRecord[];
  /** 触发详情，供可追溯性使用 */
  triggerMeta?: {
    industryId?: string;
    industryName?: string;
    currentTemperature?: number;
    previousTemperature?: number;
    temperatureRise?: number;
    brokerNegativeRatio?: number;
    negativeVolumeCount?: number;
    avgSentiment?: number;
  };
}
