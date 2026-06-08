/**
 * T008 JSON → SQLite 迁移脚本
 *
 * 从 data/ 目录下的所有 JSON 文件读取数据，写入 SQLite。
 * 已存在的记录（按主键）以 INSERT OR IGNORE 跳过，不覆盖。
 *
 * 运行方式：
 *   pnpm tsx src/migrate.ts
 */

import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './config.js';
import { getDb, closeDb } from './storage/db.js';

interface ContentRow {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_name: string;
  author: string;
  url: string;
  published_at: string;
  fetched_at: string;
  market: string;
  metrics_json: string;
  matches_json: string;
  nlp_json: string;
  dedup_json: string;
}

function migrateContents(db: ReturnType<typeof getDb>): void {
  const file = path.join(DATA_DIR, 'contents.json');
  if (!fs.existsSync(file)) {
    console.log('[Migrate] contents.json not found, skipping');
    return;
  }
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>[];
  if (!Array.isArray(arr)) {
    console.log('[Migrate] contents.json is not an array, skipping');
    return;
  }
  const stmt = db.prepare<ContentRow>(`
    INSERT OR IGNORE INTO contents
      (id, title, content, source_type, source_name, author, url,
       published_at, fetched_at, market, metrics_json, matches_json, nlp_json, dedup_json)
    VALUES
      (@id, @title, @content, @source_type, @source_name, @author, @url,
       @published_at, @fetched_at, @market, @metrics_json, @matches_json, @nlp_json, @dedup_json)
  `);
  const insertMany = db.transaction((items: Record<string, unknown>[]) => {
    let inserted = 0;
    for (const item of items) {
      stmt.run({
        id:            String(item.id ?? ''),
        title:         String(item.title ?? ''),
        content:       String(item.content ?? ''),
        source_type:   String(item.sourceType ?? 'news'),
        source_name:   String(item.sourceName ?? ''),
        author:        String(item.author ?? ''),
        url:           String(item.url ?? ''),
        published_at:  String(item.publishedAt ?? ''),
        fetched_at:    String(item.fetchedAt ?? ''),
        market:        String(item.market ?? 'cn'),
        metrics_json:  JSON.stringify(item.metrics ?? {}),
        matches_json:  JSON.stringify(item.matches ?? []),
        nlp_json:      JSON.stringify(item.nlp ?? {}),
        dedup_json:    JSON.stringify(item.dedup ?? {}),
      });
      inserted++;
    }
    return inserted;
  });
  const n = insertMany(arr);
  console.log(`[Migrate] contents: ${n} rows processed (${arr.length} total)`);
}

function migrateSourceConfigs(db: ReturnType<typeof getDb>): void {
  const file = path.join(DATA_DIR, 'source-configs.json');
  if (!fs.existsSync(file)) {
    console.log('[Migrate] source-configs.json not found, skipping');
    return;
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as { configs?: Record<string, unknown>[] };
  const arr = Array.isArray(raw?.configs) ? raw.configs : [];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO source_configs
      (id, name, source_name, source_type, credibility_score, include_in_temperature,
       authorization_status, anti_crawl_risk, availability_status, description, updated_at)
    VALUES
      (@id, @name, @source_name, @source_type, @credibility_score, @include_in_temperature,
       @authorization_status, @anti_crawl_risk, @availability_status, @description, @updated_at)
  `);
  const insertMany = db.transaction((items: Record<string, unknown>[]) => {
    for (const c of items) {
      stmt.run({
        id:                     String(c.id ?? ''),
        name:                   String(c.name ?? ''),
        source_name:            String(c.sourceName ?? ''),
        source_type:            String(c.sourceType ?? 'news'),
        credibility_score:      Number(c.credibilityScore ?? 70),
        include_in_temperature: c.includeInTemperature ? 1 : 0,
        authorization_status:   String(c.authorizationStatus ?? 'unauthorized'),
        anti_crawl_risk:        String(c.antiCrawlRisk ?? 'medium'),
        availability_status:    String(c.availabilityStatus ?? 'available'),
        description:            c.description != null ? String(c.description) : null,
        updated_at:             String(c.updatedAt ?? new Date().toISOString()),
      });
    }
    return items.length;
  });
  const n = insertMany(arr);
  console.log(`[Migrate] source_configs: ${n} rows`);
}

function migrateJsonTable(
  db: ReturnType<typeof getDb>,
  file: string,
  table: string,
  extractArray: (raw: unknown) => Record<string, unknown>[],
): void {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`[Migrate] ${file} not found, skipping`);
    return;
  }
  const raw = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as unknown;
  const arr = extractArray(raw);
  const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (id, data_json) VALUES (@id, @data_json)`);
  const insertMany = db.transaction((items: Record<string, unknown>[]) => {
    for (const item of items) {
      stmt.run({ id: String(item.id ?? ''), data_json: JSON.stringify(item) });
    }
    return items.length;
  });
  const n = insertMany(arr);
  console.log(`[Migrate] ${table}: ${n} rows`);
}

function migrateCrawlLogs(db: ReturnType<typeof getDb>): void {
  const file = path.join(DATA_DIR, 'crawl-logs.json');
  if (!fs.existsSync(file)) {
    console.log('[Migrate] crawl-logs.json not found, skipping');
    return;
  }
  const arr = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>[];
  if (!Array.isArray(arr)) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO crawl_logs
      (id, source, success, items_fetched, items_added, error, duration, crawled_at, is_incremental)
    VALUES
      (@id, @source, @success, @items_fetched, @items_added, @error, @duration, @crawled_at, @is_incremental)
  `);
  const insertMany = db.transaction((items: Record<string, unknown>[]) => {
    for (const l of items) {
      stmt.run({
        id:             String(l.id ?? ''),
        source:         String(l.source ?? ''),
        success:        l.success ? 1 : 0,
        items_fetched:  Number(l.itemsFetched ?? 0),
        items_added:    Number(l.itemsAdded ?? 0),
        error:          l.error != null ? String(l.error) : null,
        duration:       Number(l.duration ?? 0),
        crawled_at:     String(l.crawledAt ?? ''),
        is_incremental: l.isIncremental ? 1 : 0,
      });
    }
    return items.length;
  });
  const n = insertMany(arr);
  console.log(`[Migrate] crawl_logs: ${n} rows`);
}

async function main(): Promise<void> {
  console.log('[Migrate] Starting JSON → SQLite migration...');
  const db = getDb();

  migrateContents(db);
  migrateSourceConfigs(db);
  migrateJsonTable(db, 'monitoring-projects.json', 'monitoring_projects', (raw) => {
    const r = raw as { projects?: Record<string, unknown>[] };
    return Array.isArray(r?.projects) ? r.projects : (Array.isArray(raw) ? raw as Record<string, unknown>[] : []);
  });
  migrateJsonTable(db, 'industry-mappings.json', 'industry_mappings', (raw) =>
    Array.isArray(raw) ? raw as Record<string, unknown>[] : [],
  );
  migrateJsonTable(db, 'lexicons.json', 'lexicons', (raw) =>
    Array.isArray(raw) ? raw as Record<string, unknown>[] : [],
  );
  migrateCrawlLogs(db);

  const stats = {
    contents:            (db.prepare('SELECT COUNT(*) as c FROM contents').get() as { c: number }).c,
    source_configs:      (db.prepare('SELECT COUNT(*) as c FROM source_configs').get() as { c: number }).c,
    monitoring_projects: (db.prepare('SELECT COUNT(*) as c FROM monitoring_projects').get() as { c: number }).c,
    industry_mappings:   (db.prepare('SELECT COUNT(*) as c FROM industry_mappings').get() as { c: number }).c,
    lexicons:            (db.prepare('SELECT COUNT(*) as c FROM lexicons').get() as { c: number }).c,
    crawl_logs:          (db.prepare('SELECT COUNT(*) as c FROM crawl_logs').get() as { c: number }).c,
  };

  console.log('[Migrate] Done. DB stats:', stats);
  closeDb();
}

main().catch((err) => {
  console.error('[Migrate] Error:', err);
  process.exit(1);
});
