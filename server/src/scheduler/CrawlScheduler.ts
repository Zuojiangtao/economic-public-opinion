import type { BaseCrawler } from '../crawlers/BaseCrawler.js';
import type { JsonStorage } from '../storage/JsonStorage.js';
import { CRAWL_DELAY_MS } from '../config.js';

export class CrawlScheduler {
  private crawlers: BaseCrawler[];
  private storage: JsonStorage;
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private isRunning = false;

  constructor(crawlers: BaseCrawler[], storage: JsonStorage) {
    this.crawlers = crawlers;
    this.storage = storage;
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
    console.log(`[Scheduler] Running crawler: ${name}...`);

    try {
      const result = await crawler.crawl();

      if (result.success && result.items.length > 0) {
        const added = this.storage.addItems(result.items);
        console.log(
          `[Scheduler] ${name}: fetched ${result.items.length}, added ${added} new (${result.duration}ms)`,
        );
        return { source: name, count: added, success: true };
      } else if (!result.success) {
        console.error(`[Scheduler] ${name}: failed - ${result.error}`);
        return { source: name, count: 0, success: false };
      }

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
