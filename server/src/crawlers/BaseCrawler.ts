import axios, { type AxiosInstance } from 'axios';
import type { ContentItem, CrawlerConfig, CrawlerStatus, CrawlResult, SourceType, MarketType } from '../types.js';
import { DEFAULT_CRAWLER_CONFIG, CRAWL_DELAY_MS } from '../config.js';
import { analyzeSentiment } from '../nlp/sentiment.js';
import { analyzeFinancialSentiment, toBaseSentimentLabel } from '../nlp/financialSentimentModel.js';
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
      totalAttempts: 0,
      consecutiveFailures: 0,
      circuitOpen: false,
      healthScore: 100,
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

    // Circuit breaker check
    if (this.status.circuitOpen) {
      const until = this.status.circuitOpenUntil;
      if (until && new Date(until) > new Date()) {
        return {
          source: this.name,
          items: [],
          fetchedAt: new Date().toISOString(),
          success: false,
          error: `Circuit open until ${until}`,
          duration: 0,
        };
      }
      // Backoff expired — reset circuit and retry
      this.status.circuitOpen = false;
      this.status.circuitOpenUntil = undefined;
      console.log(`[${this.name}] Circuit closed after backoff, retrying...`);
    }

    this.status.isRunning = true;
    this.status.totalAttempts += 1;
    const start = Date.now();
    const fetchedAt = new Date().toISOString();

    try {
      const rawItems = await this.fetchWithRetry();
      const basicItems = rawItems.map((item) => this.enrichItem(item, fetchedAt));
      // T011: 批量执行增强情绪分析（词典模型为同步逻辑，Promise.all 无阻塞风险）
      const items = await Promise.all(basicItems.map((item) => this.enrichItemEnhanced(item)));

      this.status.lastCrawlAt = fetchedAt;
      this.status.lastSuccess = true;
      this.status.lastError = undefined;
      this.status.consecutiveFailures = 0;
      this.status.totalFetched += items.length;

      // Track newest published item timestamp for incremental crawl reference
      if (items.length > 0) {
        const newestAt = items.reduce((latest, item) => {
          const t = item.publishedAt || item.fetchedAt || '';
          return t > latest ? t : latest;
        }, '');
        if (newestAt) this.status.lastItemAt = newestAt;
      }

      this.status.healthScore = this.calculateHealthScore();

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
      this.status.consecutiveFailures += 1;

      // Open circuit if consecutive failures exceed threshold
      const threshold = this.config.circuitBreakerThreshold;
      if (this.status.consecutiveFailures >= threshold) {
        const backoffMs = this.config.backoffMinutes * 60 * 1000;
        this.status.circuitOpen = true;
        this.status.circuitOpenUntil = new Date(Date.now() + backoffMs).toISOString();
        console.warn(
          `[${this.name}] Circuit opened after ${this.status.consecutiveFailures} consecutive failures. ` +
            `Will retry after ${this.config.backoffMinutes} min (until ${this.status.circuitOpenUntil}).`,
        );
      }

      this.status.healthScore = this.calculateHealthScore();

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

  /**
   * 健康度评分 0-100：
   * - 无连续失败 → 100
   * - 每次连续失败扣 25 分
   * - 熔断打开 → 0
   */
  private calculateHealthScore(): number {
    if (this.status.circuitOpen) return 0;
    const penalty = Math.min(100, this.status.consecutiveFailures * 25);
    return Math.max(0, 100 - penalty);
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

  /**
   * 异步完成 T011 增强情绪分析，将结果写入 item.nlp.enhanced。
   * 调用方可在 doFetch 中 await 此方法，或在爬虫结果入库前批量调用。
   */
  protected async enrichItemEnhanced(item: ContentItem): Promise<ContentItem> {
    const enhanced = await analyzeFinancialSentiment(
      item.title + ' ' + (item.content ?? ''),
      item.sourceType,
    );
    // 用增强模型的三分类覆盖基础标签，保持一致性
    const baseSentiment = toBaseSentimentLabel(enhanced.label);
    item.nlp = {
      ...item.nlp,
      sentimentLabel: baseSentiment,
      enhanced,
    };
    return item;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected generateId(prefix: string): string {
    return `${prefix}-${uuid().substring(0, 8)}`;
  }
}
