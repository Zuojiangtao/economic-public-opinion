export type SourceType = 'news' | 'forums' | 'social' | 'broker' | 'app';
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
