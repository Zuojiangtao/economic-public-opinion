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

export interface ContentNlp {
  sentiment: number;
  sentimentLabel: SentimentLabel;
  riskLevel: RiskLevel;
  summary: string;
  entities: ContentEntity[];
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
