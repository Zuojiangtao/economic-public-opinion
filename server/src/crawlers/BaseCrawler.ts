import axios, { type AxiosInstance } from 'axios';
import type { ContentItem, CrawlerConfig, CrawlerStatus, CrawlResult, SourceType, MarketType } from '../types.js';
import { DEFAULT_CRAWLER_CONFIG, CRAWL_DELAY_MS } from '../config.js';
import { analyzeSentiment } from '../nlp/sentiment.js';
import { v4 as uuid } from 'uuid';

export abstract class BaseCrawler {
  readonly name: string;
  readonly sourceName: string;
  readonly sourceType: SourceType;
  readonly market: MarketType;
  protected config: CrawlerConfig;
  protected http: AxiosInstance;
  protected status: CrawlerStatus;

  constructor(
    name: string,
    sourceName: string,
    sourceType: SourceType,
    market: MarketType = 'cn',
    configOverrides?: Partial<CrawlerConfig>,
  ) {
    this.name = name;
    this.sourceName = sourceName;
    this.sourceType = sourceType;
    this.market = market;
    this.config = { ...DEFAULT_CRAWLER_CONFIG, ...configOverrides };
    this.http = axios.create({
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    });
    this.status = {
      name: this.name,
      sourceName: this.sourceName,
      enabled: this.config.enabled,
      lastSuccess: true,
      totalFetched: 0,
      isRunning: false,
    };
  }

  getStatus(): CrawlerStatus {
    return { ...this.status };
  }

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    this.status.enabled = enabled;
  }

  async crawl(): Promise<CrawlResult> {
    if (!this.config.enabled) {
      return {
        source: this.name,
        items: [],
        fetchedAt: new Date().toISOString(),
        success: false,
        error: 'Crawler is disabled',
        duration: 0,
      };
    }

    this.status.isRunning = true;
    const start = Date.now();
    const fetchedAt = new Date().toISOString();

    try {
      const rawItems = await this.fetchWithRetry();
      const items = rawItems.map((item) => this.enrichItem(item, fetchedAt));

      this.status.lastCrawlAt = fetchedAt;
      this.status.lastSuccess = true;
      this.status.lastError = undefined;
      this.status.totalFetched += items.length;

      return {
        source: this.name,
        items,
        fetchedAt,
        success: true,
        duration: Date.now() - start,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.status.lastCrawlAt = fetchedAt;
      this.status.lastSuccess = false;
      this.status.lastError = errorMsg;

      console.error(`[${this.name}] Crawl failed:`, errorMsg);
      return {
        source: this.name,
        items: [],
        fetchedAt,
        success: false,
        error: errorMsg,
        duration: Date.now() - start,
      };
    } finally {
      this.status.isRunning = false;
    }
  }

  private async fetchWithRetry(): Promise<ContentItem[]> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        if (attempt > 0) {
          await this.delay(CRAWL_DELAY_MS * attempt);
          console.log(`[${this.name}] Retry attempt ${attempt}...`);
        }
        return await this.doFetch();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw lastError;
  }

  protected abstract doFetch(): Promise<ContentItem[]>;

  protected enrichItem(item: ContentItem, fetchedAt: string): ContentItem {
    if (!item.id) item.id = uuid();
    if (!item.fetchedAt) item.fetchedAt = fetchedAt;
    if (!item.sourceType) item.sourceType = this.sourceType;
    if (!item.sourceName) item.sourceName = this.sourceName;
    if (!item.market) item.market = this.market;

    const nlpResult = analyzeSentiment(item.title + ' ' + item.content);
    item.nlp = {
      sentiment: nlpResult.score,
      sentimentLabel: nlpResult.label,
      riskLevel: nlpResult.riskLevel,
      summary: item.title,
      entities: nlpResult.entities,
    };

    if (!item.matches) item.matches = [];
    if (!item.metrics) item.metrics = {};
    if (!item.dedup) item.dedup = { clusterId: '', similarCount: 0 };

    return item;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected generateId(prefix: string): string {
    return `${prefix}-${uuid().substring(0, 8)}`;
  }
}
