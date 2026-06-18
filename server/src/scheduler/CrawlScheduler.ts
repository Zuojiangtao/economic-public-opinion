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

// ─── A股开市时间判断 ─────────────────────────────────────────────
const MARKET_TZ = 'Asia/Shanghai';

function getMarketTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MARKET_TZ }));
}

function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * 集中爬取时间窗口：
 *
 * 【工作日】盘前/盘中集中采集
 *   08:15  早盘前1小时
 *   08:45  早盘前30分钟
 *   11:55  午盘前1小时
 *   12:25  午盘前30分钟
 *   15:10  收盘后10分钟
 *
 * 【非开市日】凌晨低峰采集，仅分析持仓行业
 *   02:00  全天内容第一次采集
 *   04:00  全天内容第二次采集
 */
const CRAWL_WINDOWS_WEEKDAY = [
  { hour: 8,  min: 15 },
  { hour: 8,  min: 45 },
  { hour: 11, min: 55 },
  { hour: 12, min: 25 },
  { hour: 15, min: 10 },
];

const CRAWL_WINDOWS_WEEKEND = [
  { hour: 2, min: 0 },
  { hour: 4, min: 0 },
];

function getDelayToNextCrawl(): number {
  const now = getMarketTime();
  const today = new Date(now);
  today.setSeconds(0, 0);

  const isWd = isWeekday(today);
  const windows = isWd ? CRAWL_WINDOWS_WEEKDAY : CRAWL_WINDOWS_WEEKEND;

  // 构建候选时间列表：今天剩余窗口 + 下一个采集日的全部窗口
  const candidates: Date[] = [];

  for (const w of windows) {
    const t = new Date(today);
    t.setHours(w.hour, w.min, 0, 0);
    if (t.getTime() > now.getTime()) {
      candidates.push(t);
    }
  }

  // 如果今天没有更多窗口，找下一个采集日
  if (candidates.length === 0) {
    const nextDay = new Date(today);
    for (let i = 0; i < 7 && candidates.length === 0; i++) {
      nextDay.setDate(nextDay.getDate() + 1);
      const nextIsWd = isWeekday(nextDay);
      const nextWindows = nextIsWd ? CRAWL_WINDOWS_WEEKDAY : CRAWL_WINDOWS_WEEKEND;
      for (const w of nextWindows) {
        const t = new Date(nextDay);
        t.setHours(w.hour, w.min, 0, 0);
        candidates.push(t);
      }
    }
  }

  if (candidates.length === 0) {
    return 60 * 60 * 1000;
  }

  const next = candidates.reduce((min, t) => t.getTime() < min.getTime() ? t : min);
  const delay = next.getTime() - now.getTime();

  console.log(`[Scheduler] 下次采集: ${next.toLocaleString('zh-CN', { timeZone: MARKET_TZ })} (${Math.round(delay / 60000)}分钟后)`);
  return delay;
}

export class CrawlScheduler {
  private crawlers: BaseCrawler[];
  private storage: JsonStorage;
  private globalTimer: ReturnType<typeof setTimeout> | undefined;
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
    }

    // 立即跑一轮
    this.runAllEnabled();

    // 动态调度下一轮
    this.scheduleNext();
  }

  private scheduleNext() {
    if (!this.isRunning) return;

    const delay = getDelayToNextCrawl();
    const now = getMarketTime();
    const nextRun = new Date(now.getTime() + delay);
    const hhmm = now.getHours() * 100 + now.getMinutes();
    const isWd = isWeekday(now);
    const isTrading = isWd && ((hhmm >= 915 && hhmm <= 1135) || (hhmm >= 1255 && hhmm <= 1505));
    const mode = isTrading ? '开市' : '非开市';

    console.log(`[Scheduler] 当前模式: ${mode}, 下次采集: ${nextRun.toLocaleString('zh-CN', { timeZone: MARKET_TZ })} (${Math.round(delay / 60000)}分钟后)`);

    this.globalTimer = setTimeout(async () => {
      await this.runAllEnabled();
      this.scheduleNext(); // 递归调度下一轮
    }, delay);
  }

  stop() {
    this.isRunning = false;
    if (this.globalTimer) {
      clearTimeout(this.globalTimer);
      this.globalTimer = undefined;
    }
    console.log('[Scheduler] Stopped');
  }

  async runAllEnabled(): Promise<{ source: string; count: number; success: boolean }[]> {
    const results: { source: string; count: number; success: boolean }[] = [];

    for (const crawler of this.crawlers) {
      if (!crawler.getStatus().enabled) continue;

      const result = await this.runCrawler(crawler);
      results.push(result);

      // 爬虫之间加间隔，避免同时请求
      if (this.crawlers.indexOf(crawler) < this.crawlers.length - 1) {
        await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
      }
    }

    return results;
  }

  async runSingle(name: string): Promise<{ source: string; count: number; success: boolean }> {
    const crawler = this.crawlers.find((c) => c.getStatus().name === name);
    if (!crawler) throw new Error(`Crawler not found: ${name}`);
    return this.runCrawler(crawler);
  }

  getCrawler(name: string): BaseCrawler | undefined {
    return this.crawlers.find((c) => c.getStatus().name === name);
  }

  getStatuses() {
    return this.crawlers.map((c) => c.getStatus());
  }

  private async runCrawler(crawler: BaseCrawler): Promise<{ source: string; count: number; success: boolean }> {
    const name = crawler.getStatus().name;
    const isIncremental = this.crawlerLastItemAt.has(name);
    const sinceItemAt = this.crawlerLastItemAt.get(name);

    try {
      // 注入已知 ID，LLM 前去重
      const knownIds = this.storage.getAllIds();
      crawler.setKnownIds(knownIds);

      let result;
      if (isIncremental && sinceItemAt) {
        result = await (crawler as any).crawlIncremental?.(sinceItemAt) ?? await crawler.crawl();
      } else {
        result = await crawler.crawl();
      }

      const added = result.items.filter((item: any) => !this.storage.getById(item.id)).length;

      // 存入 storage
      for (const item of result.items) {
        this.storage.upsert(item);
      }

      // 更新增量基准
      if (result.items.length > 0) {
        const newest = result.items.reduce((latest: string, item: any) => {
          const t = item.publishedAt || item.fetchedAt || '';
          return t > latest ? t : latest;
        }, '');
        if (newest) this.crawlerLastItemAt.set(name, newest);
      }

      console.log(
        `[Scheduler] ${name}: fetched ${result.items.length}, added ${added} new (${result.duration}ms)${isIncremental ? ' [incremental]' : ''}`,
      );

      // 写入爬取日志
      appendCrawlLog({
        id: uuid(),
        source: name,
        crawledAt: new Date().toISOString(),
        itemsFetched: result.items.length,
        itemsAdded: added,
        success: true,
        duration: result.duration,
        isIncremental,
      });

      return { source: name, count: result.items.length, success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Scheduler] ${name}: failed - ${errorMsg}`);

      appendCrawlLog({
        id: uuid(),
        source: name,
        crawledAt: new Date().toISOString(),
        itemsFetched: 0,
        itemsAdded: 0,
        success: false,
        duration: 0,
        error: errorMsg,
        isIncremental: false,
      });

      // 连续失败告警
      const status = crawler.getStatus();
      if (status.consecutiveFailures >= 3 && this.onAlert) {
        this.onAlert({
          id: `crawl-fail-${name}-${Date.now()}`,
          title: `${status.sourceName} 爬虫连续失败`,
          description: `爬虫 ${name} 已连续失败 ${status.consecutiveFailures} 次，最近错误: ${errorMsg}`,
          riskLevel: 'high',
          source: name,
          triggeredAt: new Date().toISOString(),
        });
      }

      return { source: name, count: 0, success: false };
    }
  }
}