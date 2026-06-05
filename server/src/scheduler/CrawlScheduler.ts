import type { BaseCrawler } from '../crawlers/BaseCrawler.js';
import type { JsonStorage } from '../storage/JsonStorage.js';
import type { CrawlLog } from '../types.js';
import { appendCrawlLog } from '../storage/crawlLogsStore.js';
import { CRAWL_DELAY_MS } from '../config.js';
import { v4 as uuid } from 'uuid';

/** 失败告警回调，供 routes.ts 注入，用于向预警列表插入记录 */
export type AlertCallback = (alert: {
  id: string;
  title: string;
  description: string;
  riskLevel: 'high' | 'critical';
  source: string;
  triggeredAt: string;
}) => void;

export class CrawlScheduler {
  private crawlers: BaseCrawler[];
  private storage: JsonStorage;
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isRunning = false;
  /** 每个爬虫上次成功采集时最新条目的发布时间，供增量采集参考 */
  private crawlerLastItemAt: Map<string, string> = new Map();
  private onAlert: AlertCallback | undefined;

  constructor(crawlers: BaseCrawler[], storage: JsonStorage, onAlert?: AlertCallback) {
    this.crawlers = crawlers;
    this.storage = storage;
    this.onAlert = onAlert;
  }

  /** 注入/更新失败告警回调（routes.ts 初始化完成后调用） */
  setAlertCallback(cb: AlertCallback) {
    this.onAlert = cb;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Scheduler] Starting crawl scheduler...');
    console.log(`[Scheduler] Registered ${this.crawlers.length} crawlers:`);

    for (const crawler of this.crawlers) {
      const status = crawler.getStatus();
      console.log(`  - ${status.name} (${status.sourceName}): ${status.enabled ? 'ENABLED' : 'DISABLED'}`);

      if (status.enabled) {
        const intervalMs = (crawler as any).config.intervalMinutes * 60 * 1000;

        const timer = setInterval(async () => {
          await this.runCrawler(crawler);
        }, intervalMs);

        this.timers.set(status.name, timer);
      }
    }

    this.runAllEnabled();
  }

  stop() {
    this.isRunning = false;
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      console.log(`[Scheduler] Stopped timer for ${name}`);
    }
    this.timers.clear();
  }

  async runAllEnabled(): Promise<{ source: string; count: number; success: boolean }[]> {
    const results: { source: string; count: number; success: boolean }[] = [];

    for (const crawler of this.crawlers) {
      if (!crawler.getStatus().enabled) continue;

      const result = await this.runCrawler(crawler);
      results.push(result);

      await new Promise((resolve) => setTimeout(resolve, CRAWL_DELAY_MS));
    }

    return results;
  }

  async runSingle(crawlerName: string): Promise<{ source: string; count: number; success: boolean }> {
    const crawler = this.crawlers.find((c) => c.name === crawlerName);
    if (!crawler) {
      return { source: crawlerName, count: 0, success: false };
    }
    return this.runCrawler(crawler);
  }

  private async runCrawler(crawler: BaseCrawler): Promise<{ source: string; count: number; success: boolean }> {
    const name = crawler.name;
    const sinceItemAt = this.crawlerLastItemAt.get(name);
    const isIncremental = !!sinceItemAt;
    console.log(`[Scheduler] Running crawler: ${name}${isIncremental ? ` (incremental since ${sinceItemAt})` : ''}...`);

    try {
      const result = await crawler.crawl();

      if (result.success && result.items.length > 0) {
        // 增量过滤：仅添加发布时间晚于上次记录的条目
        const itemsToStore = isIncremental
          ? result.items.filter((item) => {
              const t = item.publishedAt || item.fetchedAt || '';
              return !sinceItemAt || t > sinceItemAt;
            })
          : result.items;

        const added = this.storage.addItems(itemsToStore.length > 0 ? itemsToStore : result.items);

        // 更新调度器侧的 lastItemAt 快照
        const newestAt = result.items.reduce((latest, item) => {
          const t = item.publishedAt || item.fetchedAt || '';
          return t > latest ? t : latest;
        }, sinceItemAt ?? '');
        if (newestAt) this.crawlerLastItemAt.set(name, newestAt);

        const log: CrawlLog = {
          id: uuid(),
          source: name,
          success: true,
          itemsFetched: result.items.length,
          itemsAdded: added,
          duration: result.duration,
          crawledAt: result.fetchedAt,
          isIncremental,
        };
        appendCrawlLog(log);

        console.log(
          `[Scheduler] ${name}: fetched ${result.items.length}, added ${added} new (${result.duration}ms)${isIncremental ? ' [incremental]' : ''}`,
        );
        return { source: name, count: added, success: true };
      } else if (!result.success) {
        console.error(`[Scheduler] ${name}: failed - ${result.error}`);

        const log: CrawlLog = {
          id: uuid(),
          source: name,
          success: false,
          itemsFetched: 0,
          itemsAdded: 0,
          error: result.error,
          duration: result.duration,
          crawledAt: result.fetchedAt,
          isIncremental,
        };
        appendCrawlLog(log);

        // 失败告警：熔断刚打开时触发一次告警
        const status = crawler.getStatus();
        if (status.circuitOpen && this.onAlert) {
          this.onAlert({
            id: `alert-crawler-${name}-${Date.now()}`,
            title: `爬虫熔断：${status.sourceName}`,
            description:
              `数据源 ${status.sourceName} 连续失败 ${status.consecutiveFailures} 次，` +
              `已触发熔断，将于 ${status.circuitOpenUntil} 后重试。最后错误：${result.error ?? '未知'}`,
            riskLevel: 'high',
            source: name,
            triggeredAt: result.fetchedAt,
          });
        }

        return { source: name, count: 0, success: false };
      }

      // success 但 0 条
      appendCrawlLog({
        id: uuid(),
        source: name,
        success: true,
        itemsFetched: 0,
        itemsAdded: 0,
        duration: result.duration,
        crawledAt: result.fetchedAt,
        isIncremental,
      });

      return { source: name, count: 0, success: true };
    } catch (err) {
      console.error(`[Scheduler] ${name}: unexpected error:`, err);
      return { source: name, count: 0, success: false };
    }
  }

  getStatuses() {
    return this.crawlers.map((c) => c.getStatus());
  }

  getCrawler(name: string): BaseCrawler | undefined {
    return this.crawlers.find((c) => c.name === name);
  }
}
