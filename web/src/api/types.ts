export type SourceType = 'news' | 'forums' | 'social' | 'broker' | 'app';
export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MarketType = 'cn' | 'hk' | 'us';
export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';
export type AlertAction = 'start_processing' | 'resolve' | 'ignore' | 'reopen';
export type MonitoringStatus = 'active' | 'paused' | 'archived';
export type UserRole = 'admin' | 'analyst' | 'operator';
export type LexiconCategory = 'brand' | 'competitor' | 'risk' | 'synonym' | 'stop';
export type EntityType = 'company' | 'person' | 'product' | 'industry' | 'index';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar?: string;
}

export interface ContentMetrics {
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
}

export interface ContentMatch {
  projectId: string;
  projectName: string;
  keywords: string[];
  tags: string[];
}

export interface ContentEntity {
  name: string;
  type: EntityType;
}

export interface ContentNlp {
  sentiment: number;
  sentimentLabel: SentimentLabel;
  riskLevel: RiskLevel;
  summary: string;
  entities: ContentEntity[];
}

export interface ContentDedup {
  clusterId: string;
  similarCount: number;
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
  market: MarketType;
  metrics: ContentMetrics;
  matches: ContentMatch[];
  nlp: ContentNlp;
  dedup: ContentDedup;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContentSearchParams {
  keyword?: string;
  sourceType?: SourceType;
  sentiment?: SentimentLabel;
  riskLevel?: RiskLevel;
  market?: MarketType;
  startDate?: string;
  endDate?: string;
  monitoringProjectId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'publishedAt' | 'sentiment' | 'riskLevel';
  sortOrder?: 'asc' | 'desc';
}

export interface TrendDataPoint {
  date: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

export interface ContentStats {
  totalCount: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  sourceDistribution: { sourceType: string; count: number }[];
  trendData: TrendDataPoint[];
  topKeywords: { keyword: string; count: number }[];
  topEntities: { name: string; type: string; count: number }[];
}

export interface MonitoringKeywords {
  include: string[];
  exclude: string[];
  synonyms?: { word: string; alternatives: string[] }[];
}

export interface MonitoringProject {
  id: string;
  name: string;
  description: string;
  status: MonitoringStatus;
  keywords: MonitoringKeywords;
  sourceTypes: SourceType[];
  sentimentThreshold?: number;
  riskThreshold?: RiskLevel;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoringProjectInput {
  name: string;
  description?: string;
  status?: 'active' | 'paused';
  keywords?: {
    include?: string[];
    exclude?: string[];
  };
  sourceTypes?: SourceType[];
  sentimentThreshold?: number;
  riskThreshold?: RiskLevel;
}

export interface AlertHandleRecord {
  handler: string;
  action: string;
  note: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  status: AlertStatus;
  ruleName: string;
  triggeredAt: string;
  relatedContentIds: string[];
  relatedContents?: ContentItem[];
  handleRecords: AlertHandleRecord[];
}

export interface AlertHandleInput {
  action: AlertAction;
  note?: string;
}

export interface AlertRuleConditions {
  keywords?: string[];
  sentimentBelow?: number;
  riskLevelAbove?: RiskLevel;
  volumeThreshold?: number;
  sourceTypes?: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertRuleConditions;
  createdAt: string;
}

export interface AlertRuleInput {
  name: string;
  description?: string;
  enabled: boolean;
  conditions: AlertRuleConditions;
}

export interface LexiconEntry {
  id: string;
  word: string;
  category: LexiconCategory;
  synonyms: string[];
  createdAt: string;
}

export interface LexiconEntryInput {
  word: string;
  category: LexiconCategory;
  synonyms?: string[];
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
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

export interface IndustryMappingInput {
  name: string;
  type: IndustryType;
  description?: string;
  keywords: string[];
  synonyms: string[];
  relatedConcepts?: string[];
  stocks?: StockMapping[];
  indices?: string[];
  overseasMappings?: OverseasMapping[];
}

// ==================== Temperature ====================

export type TemperatureLevel = 'freezing' | 'cool' | 'neutral' | 'warm' | 'hot';

export interface TemperatureBreakdown {
  sentimentScore: number;
  volumeAnomalyScore: number;
  spreadIntensityScore: number;
  sourceCredibilityScore: number;
}

export interface TemperatureSnapshot {
  id: string;
  industryId: string;
  industryName: string;
  score: number;
  level: TemperatureLevel;
  breakdown: TemperatureBreakdown;
  contentCount: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  snapshotAt: string;
  granularity: 'hour' | 'day';
}

export interface TemperatureListResponse {
  items: TemperatureSnapshot[];
  total: number;
  granularity: 'hour' | 'day';
}
