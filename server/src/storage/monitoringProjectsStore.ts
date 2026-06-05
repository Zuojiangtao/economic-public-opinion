import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../config.js';

const FILE = path.join(DATA_DIR, 'monitoring-projects.json');

const DEFAULT_PROJECTS: unknown[] = [
  {
    id: 'project-1',
    name: 'A股市场情绪监测',
    description: '监测A股市场相关新闻、论坛讨论中的市场情绪变化',
    status: 'active',
    targetType: 'index',
    targetIds: [],
    keywords: {
      core: ['A股', '沪深', '大盘', '指数'],
      extended: ['沪深300', '上证', '深证', '两市'],
      exclude: ['广告'],
    },
    sourceTypes: ['news', 'forums', 'social'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: false },
      { sourceType: 'forums', weight: 0.5, enabled: true },
      { sourceType: 'social', weight: 0.4, enabled: true },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 70,
    alertThreshold: 80,
    outputCycle: 'hourly',
    sentimentThreshold: -0.5,
    riskThreshold: 'high',
    hitCount: 0,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-19T10:00:00Z',
  },
  {
    id: 'project-2',
    name: '新能源产业链追踪',
    description: '跟踪新能源汽车、光伏、锂电池等产业链的舆情动态',
    status: 'active',
    targetType: 'sector',
    targetIds: ['industry-new-energy'],
    keywords: {
      core: ['新能源', '比亚迪', '宁德时代', '光伏', '锂电池'],
      extended: ['电动汽车', '储能', '风电', '碳中和', '双碳'],
      exclude: ['招聘'],
    },
    sourceTypes: ['news', 'broker', 'forums'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: true },
      { sourceType: 'forums', weight: 0.5, enabled: true },
      { sourceType: 'social', weight: 0.4, enabled: false },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 70,
    alertThreshold: 80,
    outputCycle: 'hourly',
    sentimentThreshold: -0.3,
    riskThreshold: 'medium',
    hitCount: 0,
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-03-18T14:30:00Z',
  },
  {
    id: 'project-3',
    name: '央行货币政策监测',
    description: '实时追踪央行政策动态、利率变化、流动性投放等',
    status: 'active',
    targetType: 'concept',
    targetIds: [],
    keywords: {
      core: ['央行', '货币政策', '降息', '降准', 'LPR'],
      extended: ['利率', '流动性', '再贷款', '存款准备金', '公开市场'],
      exclude: [],
    },
    sourceTypes: ['news', 'broker'],
    sourceWeights: [
      { sourceType: 'news', weight: 0.8, enabled: true },
      { sourceType: 'broker', weight: 1.0, enabled: true },
      { sourceType: 'forums', weight: 0.5, enabled: false },
      { sourceType: 'social', weight: 0.4, enabled: false },
      { sourceType: 'app', weight: 0.6, enabled: false },
    ],
    temperatureThreshold: 65,
    alertThreshold: 75,
    outputCycle: 'realtime',
    sentimentThreshold: -0.6,
    riskThreshold: 'high',
    hitCount: 0,
    createdAt: '2026-01-20T08:00:00Z',
    updatedAt: '2026-03-19T09:00:00Z',
  },
];

export function loadMonitoringProjectsMap(): Map<string, any> {
  const map = new Map<string, any>();
  try {
    if (fs.existsSync(FILE)) {
      const raw = fs.readFileSync(FILE, 'utf-8');
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) {
        for (const p of arr) {
          if (p && typeof p === 'object' && 'id' in p && typeof (p as { id: unknown }).id === 'string') {
            map.set((p as { id: string }).id, p);
          }
        }
        console.log(`[MonitoringProjects] Loaded ${map.size} projects from ${FILE}`);
        return map;
      }
    }
  } catch (err) {
    console.error('[MonitoringProjects] Load failed, using defaults:', err);
  }
  for (const p of DEFAULT_PROJECTS as { id: string }[]) {
    map.set(p.id, p);
  }
  saveMonitoringProjectsMap(map);
  console.log(`[MonitoringProjects] Seeded defaults to ${FILE}`);
  return map;
}

export function saveMonitoringProjectsMap(map: Map<string, any>): void {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const arr = Array.from(map.values());
  fs.writeFileSync(FILE, JSON.stringify(arr, null, 2), 'utf-8');
}
