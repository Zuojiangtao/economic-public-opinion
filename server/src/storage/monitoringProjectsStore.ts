// T008: migrated to SQLite
import { getDb } from './db.js';
import type { MonitoringProject } from '../types.js';

const DEFAULT_PROJECTS: unknown[] = [
  {
    id: 'project-1',
    name: 'A股市场情绪监测',
    description: '监测A股市场相关新闻、论坛讨论中的市场情绪变化',
    status: 'active',
    targetType: 'index',
    targetIds: [],
    keywords: { core: ['A股', '沪深', '大盘', '指数'], extended: ['沪深300', '上证', '深证', '两市'], exclude: ['广告'] },
    sourceTypes: ['news', 'forums', 'social'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: false },
      { sourceType: 'forums', weight: 0.5, enabled: true },
      { sourceType: 'social', weight: 0.4, enabled: true },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 70, alertThreshold: 80, outputCycle: 'hourly',
    sentimentThreshold: -0.5, riskThreshold: 'high', hitCount: 0,
    createdAt: '2026-01-15T08:00:00Z', updatedAt: '2026-03-19T10:00:00Z',
  },
  {
    id: 'project-2',
    name: '新能源产业链追踪',
    description: '跟踪新能源汽车、光伏、锂电池等产业链的舆情动态',
    status: 'active',
    targetType: 'sector',
    targetIds: ['industry-new-energy'],
    keywords: { core: ['新能源', '比亚迪', '宁德时代', '光伏', '锂电池'], extended: ['电动汽车', '储能', '风电', '碳中和', '双碳'], exclude: ['招聘'] },
    sourceTypes: ['news', 'broker', 'forums'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: true },
      { sourceType: 'forums', weight: 0.5, enabled: true },
      { sourceType: 'social', weight: 0.4, enabled: false },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 70, alertThreshold: 80, outputCycle: 'hourly',
    sentimentThreshold: -0.3, riskThreshold: 'medium', hitCount: 0,
    createdAt: '2026-02-01T08:00:00Z', updatedAt: '2026-03-18T14:30:00Z',
  },
  {
    id: 'project-3',
    name: '央行货币政策监测',
    description: '实时追踪央行政策动态、利率变化、流动性投放等',
    status: 'active',
    targetType: 'concept',
    targetIds: [],
    keywords: { core: ['央行', '货币政策', '降息', '降准', 'LPR'], extended: ['利率', '流动性', '再贷款', '存款准备金', '公开市场'], exclude: [] },
    sourceTypes: ['news', 'broker'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: true },
      { sourceType: 'forums', weight: 0.5, enabled: false },
      { sourceType: 'social', weight: 0.4, enabled: false },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 65, alertThreshold: 75, outputCycle: 'realtime',
    sentimentThreshold: -0.6, riskThreshold: 'high', hitCount: 0,
    createdAt: '2026-01-20T08:00:00Z', updatedAt: '2026-03-19T09:00:00Z',
  },
];

export function loadMonitoringProjectsMap(): Map<string, MonitoringProject> {
  const db = getDb();
  const rows = db.prepare('SELECT id, data_json FROM monitoring_projects').all() as { id: string; data_json: string }[];
  if (rows.length > 0) {
    const map = new Map<string, MonitoringProject>();
    for (const r of rows) map.set(r.id, JSON.parse(r.data_json) as MonitoringProject);
    console.log(`[MonitoringProjects] Loaded ${map.size} projects from SQLite`);
    return map;
  }
  // Seed defaults
  const map = new Map<string, MonitoringProject>();
  const stmt = db.prepare('INSERT OR IGNORE INTO monitoring_projects (id, data_json) VALUES (?, ?)');
  const seed = db.transaction(() => {
    for (const p of DEFAULT_PROJECTS as MonitoringProject[]) {
      stmt.run(p.id, JSON.stringify(p));
      map.set(p.id, p);
    }
  });
  seed();
  console.log(`[MonitoringProjects] Seeded ${map.size} defaults to SQLite`);
  return map;
}

export function saveMonitoringProjectsMap(map: Map<string, MonitoringProject>): void {
  const db = getDb();
  const upsert = db.prepare('INSERT OR REPLACE INTO monitoring_projects (id, data_json) VALUES (?, ?)');
  const save = db.transaction(() => {
    for (const [id, project] of map) {
      upsert.run(id, JSON.stringify(project));
    }
  });
  save();
}
