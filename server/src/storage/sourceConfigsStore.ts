// T008: migrated to SQLite
import { getDb } from './db.js';
import type { SourceConfig } from '../types.js';

interface SourceConfigRow {
  id: string;
  name: string;
  source_name: string;
  source_type: string;
  credibility_score: number;
  include_in_temperature: number;
  authorization_status: string;
  anti_crawl_risk: string;
  availability_status: string;
  description: string | null;
  updated_at: string;
}

function rowToConfig(row: SourceConfigRow): SourceConfig {
  return {
    id:                    row.id,
    name:                  row.name,
    sourceName:            row.source_name,
    sourceType:            row.source_type as SourceConfig['sourceType'],
    credibilityScore:      row.credibility_score,
    includeInTemperature:  row.include_in_temperature === 1,
    authorizationStatus:   row.authorization_status as SourceConfig['authorizationStatus'],
    antiCrawlRisk:         row.anti_crawl_risk as SourceConfig['antiCrawlRisk'],
    availabilityStatus:    row.availability_status as SourceConfig['availabilityStatus'],
    description:           row.description ?? undefined,
    updatedAt:             row.updated_at,
  };
}

export function loadSourceConfigs(): SourceConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM source_configs').all() as SourceConfigRow[];
  console.log(`[SourceConfigs] Loaded ${rows.length} configs from SQLite`);
  return rows.map(rowToConfig);
}

export function saveSourceConfigs(configs: SourceConfig[]): void {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO source_configs
      (id, name, source_name, source_type, credibility_score, include_in_temperature,
       authorization_status, anti_crawl_risk, availability_status, description, updated_at)
    VALUES
      (@id, @name, @source_name, @source_type, @credibility_score, @include_in_temperature,
       @authorization_status, @anti_crawl_risk, @availability_status, @description, @updated_at)
  `);
  const save = db.transaction(() => {
    for (const c of configs) {
      upsert.run({
        id:                     c.id,
        name:                   c.name,
        source_name:            c.sourceName,
        source_type:            c.sourceType,
        credibility_score:      c.credibilityScore,
        include_in_temperature: c.includeInTemperature ? 1 : 0,
        authorization_status:   c.authorizationStatus,
        anti_crawl_risk:        c.antiCrawlRisk,
        availability_status:    c.availabilityStatus,
        description:            c.description ?? null,
        updated_at:             c.updatedAt,
      });
    }
  });
  save();
}

/** 按 sourceName 构建查找 Map（用于温度计算快速匹配） */
export function buildSourceConfigMap(configs: SourceConfig[]): Map<string, SourceConfig> {
  const m = new Map<string, SourceConfig>();
  for (const c of configs) m.set(c.sourceName, c);
  return m;
}

/** 按 sourceType 构建可信度默认分（取同类型所有已启用配置的平均值） */
export function buildSourceTypeCredibility(configs: SourceConfig[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const c of configs) {
    if (!c.includeInTemperature) continue;
    const arr = groups.get(c.sourceType) ?? [];
    arr.push(c.credibilityScore);
    groups.set(c.sourceType, arr);
  }
  const result = new Map<string, number>();
  for (const [type, scores] of groups) {
    result.set(type, Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
  }
  return result;
}
