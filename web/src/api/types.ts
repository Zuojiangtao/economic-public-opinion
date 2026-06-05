export type SourceType = 'news' | 'forums' | 'social' | 'broker' | 'app' | 'regulatory';
export type SentimentLabel = 'positive' | 'neutral' | 'negative';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MarketType = 'cn' | 'hk' | 'us';
export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';
export type AlertAction = 'start_processing' | 'resolve' | 'ignore' | 'reopen';
export type MonitoringStatus = 'active' | 'paused' | 'archived';
export type UserRole = 'admin' | 'analyst' | 'operator';
export type LexiconCategory = 'brand' | 'competitor' | 'risk' | 'synonym' | 'stop';
export type EntityType = 'company' | 'person' | 'product' | 'industry' | 'index';

// ==================== Source Configs (T006) ====================

export type AuthorizationStatus = 'authorized' | 'unauthorized' | 'restricted';
export type AntiCrawlRisk = 'low' | 'medium' | 'high';
export type AvailabilityStatus = 'available' | 'unavailable' | 'unstable';

export interface SourceConfig {
  id: string;
  name: string;
  sourceName: string;
  sourceType: SourceType;
  /** 可信度评分 0-100 */
  credibilityScore: number;
  /** 是否纳入温度计算 */
  includeInTemperature: boolean;
  authorizationStatus: AuthorizationStatus;
  antiCrawlRisk: AntiCrawlRisk;
  availabilityStatus: AvailabilityStatus;
  description?: string;
  updatedAt: string;
}

export interface SourceConfigUpdateInput {
  credibilityScore?: number;
  includeInTemperature?: boolean;
  authorizationStatus?: AuthorizationStatus;
  antiCrawlRisk?: AntiCrawlRisk;
  availabilityStatus?: AvailabilityStatus;
  description?: string;
}

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

export type MonitorTargetType = 'industry' | 'sector' | 'concept' | 'stock_pool' | 'index';
export type OutputCycle = 'realtime' | 'hourly' | 'daily';

export interface SourceWeightConfig {
  sourceType: SourceType;
  /** 0.0 ~ 1.0 */
  weight: number;
  enabled: boolean;
}

export interface MonitoringKeywords {
  /** 核心词 */
  core: string[];
  /** 扩展词 */
  extended: string[];
  /** 排除词 */
  exclude: string[];
  /** @deprecated backward compat */
  include?: string[];
}

export interface MonitoringProject {
  id: string;
  name: string;
  description: string;
  status: MonitoringStatus;
  /** 监测对象类型 */
  targetType: MonitorTargetType;
  /** 关联的行业/板块/概念/指数 ID 列表 */
  targetIds: string[];
  keywords: MonitoringKeywords;
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

export interface MonitoringProjectInput {
  name: string;
  description?: string;
  status?: 'active' | 'paused';
  targetType?: MonitorTargetType;
  targetIds?: string[];
  keywords?: {
    core?: string[];
    extended?: string[];
    exclude?: string[];
  };
  sourceTypes?: SourceType[];
  sourceWeights?: SourceWeightConfig[];
  temperatureThreshold?: number;
  alertThreshold?: number;
  outputCycle?: OutputCycle;
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
  ruleId?: string;
  triggeredAt: string;
  relatedContentIds: string[];
  relatedContents?: ContentItem[];
  handleRecords: AlertHandleRecord[];
  /** T010: 可追溯的触发详情 */
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
  /** T010: 行业温度过热阈值（0-100） */
  temperatureAbove?: number;
  /** T010: 行业温度快速升温阈值（绝对分值） */
  temperatureRiseAbove?: number;
  /** T010: 研报负面比例阈值（0-1） */
  brokerNegativeRatioAbove?: number;
  /** T010: 负面声量增长率阈值（%） */
  negativeVolumeRiseAbove?: number;
  /** T010: 限定触发范围的行业 ID 列表 */
  industryIds?: string[];
  /** T010: 检测时间窗口（分钟），默认 120 */
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
  /** 与上一快照的温度差，正为升温，负为降温 */
  scoreDelta?: number;
  level: TemperatureLevel;
  breakdown: TemperatureBreakdown;
  contentCount: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  snapshotAt: string;
  granularity: 'hour' | 'day';
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

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

export interface TemperatureDetail extends TemperatureSnapshot {
  riskDistribution: RiskDistribution;
  topContents: TopContentSummary[];
}

export interface TemperatureListResponse {
  items: TemperatureSnapshot[];
  total: number;
  granularity: 'hour' | 'day';
}

export interface TemperatureTrendResponse {
  industryId: string;
  industryName: string;
  granularity: 'hour' | 'day';
  items: TemperatureSnapshot[];
  total: number;
}

export interface TemperatureListParams {
  granularity?: 'hour' | 'day';
  type?: IndustryType;
  market?: MarketType;
  projectId?: string;
}
