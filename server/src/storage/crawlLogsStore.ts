/**
 * 采集日志持久化存储（T009）
 * 将每次采集的结果追加写入 data/crawl-logs.json。
 * 采用循环缓冲策略：超过 MAX_LOGS 条时保留最新记录。
 */
import fs from 'fs';
import { DATA_DIR } from '../config.js';
import type { CrawlLog } from '../types.js';

const LOGS_FILE = `${DATA_DIR}crawl-logs.json`;
const MAX_LOGS = 1000;

function loadRaw(): CrawlLog[] {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(raw) as CrawlLog[];
  } catch {
    return [];
  }
}

function saveRaw(logs: CrawlLog[]): void {
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('[CrawlLogsStore] Failed to write crawl-logs.json:', err);
  }
}

/** 追加一条日志；超出 MAX_LOGS 时删除最旧记录 */
export function appendCrawlLog(log: CrawlLog): void {
  const logs = loadRaw();
  logs.push(log);
  if (logs.length > MAX_LOGS) {
    logs.splice(0, logs.length - MAX_LOGS);
  }
  saveRaw(logs);
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
  let logs = loadRaw().reverse(); // newest first

  if (query.source) {
    logs = logs.filter((l) => l.source === query.source);
  }
  if (query.success !== undefined) {
    logs = logs.filter((l) => l.success === query.success);
  }
  if (query.startDate) {
    logs = logs.filter((l) => l.crawledAt >= query.startDate!);
  }
  if (query.endDate) {
    logs = logs.filter((l) => l.crawledAt <= query.endDate!);
  }

  const total = logs.length;
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
  const items = logs.slice((page - 1) * pageSize, page * pageSize);

  return { items, total, page, pageSize };
}
