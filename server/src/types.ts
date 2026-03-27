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
