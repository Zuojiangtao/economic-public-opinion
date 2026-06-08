/**
 * T008 SQLite 数据库初始化与 Schema
 *
 * 数据库文件存储在 data/sentiment.db（与现有 JSON 文件同目录）。
 * 使用 better-sqlite3（同步 API），适合单进程服务器场景。
 *
 * 表：
 *   contents              - 舆情内容条目
 *   source_configs        - 数据源配置
 *   monitoring_projects   - 监测方案
 *   industry_mappings     - 行业映射
 *   lexicons              - 词库
 *   crawl_logs            - 采集日志
 *   temperature_snapshots - 温度快照（历史）
 *   alerts                - 预警记录
 *   alert_rules           - 预警规则
 */

import Database from 'better-sqlite3';
import path from 'path';
import { DATA_DIR } from '../config.js';

const DB_FILE = path.join(DATA_DIR, 'sentiment.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_FILE);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- ============================================================
    -- contents
    -- ============================================================
    CREATE TABLE IF NOT EXISTS contents (
      id           TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      content      TEXT NOT NULL DEFAULT '',
      source_type  TEXT NOT NULL,
      source_name  TEXT NOT NULL,
      author       TEXT NOT NULL DEFAULT '',
      url          TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL,
      fetched_at   TEXT NOT NULL,
      market       TEXT NOT NULL DEFAULT 'cn',
      -- JSON columns
      metrics_json TEXT NOT NULL DEFAULT '{}',
      matches_json TEXT NOT NULL DEFAULT '[]',
      nlp_json     TEXT NOT NULL DEFAULT '{}',
      dedup_json   TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_contents_published_at ON contents(published_at);
    CREATE INDEX IF NOT EXISTS idx_contents_source_type  ON contents(source_type);
    CREATE INDEX IF NOT EXISTS idx_contents_market       ON contents(market);

    -- ============================================================
    -- source_configs
    -- ============================================================
    CREATE TABLE IF NOT EXISTS source_configs (
      id                    TEXT PRIMARY KEY,
      name                  TEXT NOT NULL,
      source_name           TEXT NOT NULL UNIQUE,
      source_type           TEXT NOT NULL,
      credibility_score     INTEGER NOT NULL DEFAULT 70,
      include_in_temperature INTEGER NOT NULL DEFAULT 1,
      authorization_status  TEXT NOT NULL DEFAULT 'unauthorized',
      anti_crawl_risk       TEXT NOT NULL DEFAULT 'medium',
      availability_status   TEXT NOT NULL DEFAULT 'available',
      description           TEXT,
      updated_at            TEXT NOT NULL
    );

    -- ============================================================
    -- monitoring_projects
    -- ============================================================
    CREATE TABLE IF NOT EXISTS monitoring_projects (
      id                    TEXT PRIMARY KEY,
      data_json             TEXT NOT NULL
    );

    -- ============================================================
    -- industry_mappings
    -- ============================================================
    CREATE TABLE IF NOT EXISTS industry_mappings (
      id        TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    -- ============================================================
    -- lexicons
    -- ============================================================
    CREATE TABLE IF NOT EXISTS lexicons (
      id        TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    -- ============================================================
    -- crawl_logs
    -- ============================================================
    CREATE TABLE IF NOT EXISTS crawl_logs (
      id           TEXT PRIMARY KEY,
      source       TEXT NOT NULL,
      success      INTEGER NOT NULL DEFAULT 1,
      items_fetched INTEGER NOT NULL DEFAULT 0,
      items_added   INTEGER NOT NULL DEFAULT 0,
      error        TEXT,
      duration     INTEGER NOT NULL DEFAULT 0,
      crawled_at   TEXT NOT NULL,
      is_incremental INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_crawl_logs_crawled_at ON crawl_logs(crawled_at DESC);
    CREATE INDEX IF NOT EXISTS idx_crawl_logs_source     ON crawl_logs(source);

    -- ============================================================
    -- temperature_snapshots
    -- ============================================================
    CREATE TABLE IF NOT EXISTS temperature_snapshots (
      id                 TEXT PRIMARY KEY,
      industry_id        TEXT NOT NULL,
      industry_name      TEXT NOT NULL,
      score              REAL NOT NULL,
      level              TEXT NOT NULL,
      content_count      INTEGER NOT NULL DEFAULT 0,
      granularity        TEXT NOT NULL,
      snapshot_at        TEXT NOT NULL,
      breakdown_json     TEXT NOT NULL DEFAULT '{}',
      sentiment_dist_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_temp_snap_industry_gran_time
      ON temperature_snapshots(industry_id, granularity, snapshot_at);
    CREATE INDEX IF NOT EXISTS idx_temp_snap_industry_id ON temperature_snapshots(industry_id);
    CREATE INDEX IF NOT EXISTS idx_temp_snap_snapshot_at ON temperature_snapshots(snapshot_at DESC);

    -- ============================================================
    -- alerts
    -- ============================================================
    CREATE TABLE IF NOT EXISTS alerts (
      id                  TEXT PRIMARY KEY,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL DEFAULT '',
      risk_level          TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'pending',
      rule_name           TEXT NOT NULL DEFAULT '',
      rule_id             TEXT,
      triggered_at        TEXT NOT NULL,
      related_content_ids_json TEXT NOT NULL DEFAULT '[]',
      handle_records_json TEXT NOT NULL DEFAULT '[]',
      trigger_meta_json   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_status      ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);

    -- ============================================================
    -- alert_rules
    -- ============================================================
    CREATE TABLE IF NOT EXISTS alert_rules (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled     INTEGER NOT NULL DEFAULT 1,
      conditions_json TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      updated_at  TEXT
    );
  `);

  console.log('[DB] Schema initialized:', DB_FILE);
}
