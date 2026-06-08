/**
 * T008/T009 采集日志持久化存储 — SQLite 实现
 */
import { getDb } from './db.js';
import type { CrawlLog } from '../types.js';

const MAX_LOGS = 1000;

interface CrawlLogRow {
  id: string;
  source: string;
  success: number;
  items_fetched: number;
  items_added: number;
  error: string | null;
  duration: number;
  crawled_at: string;
  is_incremental: number;
}

function rowToLog(row: CrawlLogRow): CrawlLog {
  return {
    id:             row.id,
    source:         row.source,
    success:        row.success === 1,
    itemsFetched:   row.items_fetched,
    itemsAdded:     row.items_added,
    error:          row.error ?? undefined,
    duration:       row.duration,
    crawledAt:      row.crawled_at,
    isIncremental:  row.is_incremental === 1,
  };
}

/** 追加一条日志；超出 MAX_LOGS 时删除最旧记录 */
export function appendCrawlLog(log: CrawlLog): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO crawl_logs
      (id, source, success, items_fetched, items_added, error, duration, crawled_at, is_incremental)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.id, log.source, log.success ? 1 : 0,
    log.itemsFetched, log.itemsAdded,
    log.error ?? null, log.duration,
    log.crawledAt, log.isIncremental ? 1 : 0,
  );

  // Trim to MAX_LOGS
  const count = (db.prepare('SELECT COUNT(*) as c FROM crawl_logs').get() as { c: number }).c;
  if (count > MAX_LOGS) {
    db.prepare(`
      DELETE FROM crawl_logs WHERE id IN (
        SELECT id FROM crawl_logs ORDER BY crawled_at ASC LIMIT ?
      )
    `).run(count - MAX_LOGS);
  }
}

export interface CrawlLogQuery {
  source?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

/** 查询采集日志，按 crawledAt 降序返回 */
export function queryCrawlLogs(query: CrawlLogQuery = {}): {
  items: CrawlLog[];
  total: number;
  page: number;
  pageSize: number;
} {
  const db = getDb();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.source) {
    conditions.push('source = ?');
    params.push(query.source);
  }
  if (query.success !== undefined) {
    conditions.push('success = ?');
    params.push(query.success ? 1 : 0);
  }
  if (query.startDate) {
    conditions.push('crawled_at >= ?');
    params.push(query.startDate);
  }
  if (query.endDate) {
    conditions.push('crawled_at <= ?');
    params.push(query.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) as c FROM crawl_logs ${where}`).get(...params as []) as { c: number }).c;

  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const offset = (page - 1) * pageSize;

  const rows = db.prepare(
    `SELECT * FROM crawl_logs ${where} ORDER BY crawled_at DESC LIMIT ? OFFSET ?`,
  ).all(...params as [], pageSize, offset) as CrawlLogRow[];

  return { items: rows.map(rowToLog), total, page, pageSize };
}
