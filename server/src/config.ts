import type { CrawlerConfig } from './types.js';

export const DEFAULT_CRAWLER_CONFIG: CrawlerConfig = {
  enabled: true,
  intervalMinutes: 15,
  pageSize: 30,
  maxPages: 3,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  timeout: 15000,
  retries: 2,
};

export const SERVER_PORT = 3001;

export const DATA_DIR = new URL('../../data/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

export const CRAWL_DELAY_MS = 2000;
