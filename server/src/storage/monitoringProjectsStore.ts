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
    keywords: { include: ['A股', '沪深', '大盘', '指数'], exclude: ['广告'] },
    sourceTypes: ['news', 'forums', 'social'],
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
    keywords: {
      include: ['新能源', '比亚迪', '宁德时代', '光伏', '锂电池'],
      exclude: ['招聘'],
    },
    sourceTypes: ['news', 'broker', 'forums'],
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
    keywords: { include: ['央行', '货币政策', '降息', '降准', 'LPR'], exclude: [] },
    sourceTypes: ['news', 'broker'],
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
