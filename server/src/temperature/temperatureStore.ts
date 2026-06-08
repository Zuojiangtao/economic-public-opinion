import type { TemperatureSnapshot } from '../types.js';
import { getDb } from '../storage/db.js';

/**
 * 内存中的温度快照缓存。
 * 按 industryId 索引最新快照（小时级和日级各一份）。
 */
const hourlyCache = new Map<string, TemperatureSnapshot>();
const dailyCache = new Map<string, TemperatureSnapshot>();

/**
 * 历史快照存储。Key = `${industryId}-${granularity}`
 * 小时级最多保留 168 条（7天），日级最多保留 30 条。
 */
const HISTORY_LIMIT: Record<'hour' | 'day', number> = { hour: 168, day: 30 };
const historyMap = new Map<string, TemperatureSnapshot[]>();

// ── SQLite helpers ───────────────────────────────────────────────────────────

interface SnapRow {
  id: string;
  industry_id: string;
  industry_name: string;
  score: number;
  level: string;
  content_count: number;
  granularity: string;
  snapshot_at: string;
  breakdown_json: string;
  sentiment_dist_json: string;
}

function rowToSnapshot(row: SnapRow): TemperatureSnapshot {
  return {
    id:                    row.id,
    industryId:            row.industry_id,
    industryName:          row.industry_name,
    score:                 row.score,
    level:                 row.level as TemperatureSnapshot['level'],
    contentCount:          row.content_count,
    granularity:           row.granularity as 'hour' | 'day',
    snapshotAt:            row.snapshot_at,
    breakdown:             JSON.parse(row.breakdown_json),
    sentimentDistribution: JSON.parse(row.sentiment_dist_json),
  };
}

function persistSnapshot(snap: TemperatureSnapshot): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO temperature_snapshots
      (id, industry_id, industry_name, score, level, content_count,
       granularity, snapshot_at, breakdown_json, sentiment_dist_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    snap.id, snap.industryId, snap.industryName, snap.score, snap.level,
    snap.contentCount, snap.granularity, snap.snapshotAt,
    JSON.stringify(snap.breakdown), JSON.stringify(snap.sentimentDistribution),
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

export function updateSnapshots(snapshots: TemperatureSnapshot[]): void {
  for (const snap of snapshots) {
    if (snap.granularity === 'hour') {
      hourlyCache.set(snap.industryId, snap);
    } else {
      dailyCache.set(snap.industryId, snap);
    }
  }
}

export function getSnapshotsByGranularity(granularity: 'hour' | 'day'): TemperatureSnapshot[] {
  const cache = granularity === 'hour' ? hourlyCache : dailyCache;
  return Array.from(cache.values()).sort((a, b) => b.score - a.score);
}

export function getSnapshotByIndustry(
  industryId: string,
  granularity: 'hour' | 'day' = 'hour',
): TemperatureSnapshot | undefined {
  const cache = granularity === 'hour' ? hourlyCache : dailyCache;
  return cache.get(industryId);
}

/**
 * 将快照推入历史记录，按 snapshotAt 去重（同一时间桶更新而非追加），并持久化到 SQLite。
 */
export function pushToHistory(snapshots: TemperatureSnapshot[]): void {
  for (const snap of snapshots) {
    persistSnapshot(snap);

    const key = `${snap.industryId}-${snap.granularity}`;
    const arr = historyMap.get(key) ?? [];
    const existingIdx = arr.findIndex((s) => s.snapshotAt === snap.snapshotAt);
    if (existingIdx !== -1) {
      arr[existingIdx] = snap;
    } else {
      arr.push(snap);
      const limit = HISTORY_LIMIT[snap.granularity];
      if (arr.length > limit) arr.splice(0, arr.length - limit);
    }
    historyMap.set(key, arr);
  }
}

/**
 * 获取指定行业的历史温度列表，按时间升序排列。
 * 优先从内存缓存读取；若内存为空则从 SQLite 加载。
 */
export function getHistory(
  industryId: string,
  granularity: 'hour' | 'day' = 'hour',
  limit = 24,
  startDate?: string,
  endDate?: string,
): TemperatureSnapshot[] {
  const key = `${industryId}-${granularity}`;
  let arr = historyMap.get(key);

  if (!arr || arr.length === 0) {
    // Load from SQLite
    const db = getDb();
    const conditions = ['industry_id = ?', 'granularity = ?'];
    const params: unknown[] = [industryId, granularity];
    if (startDate) { conditions.push('snapshot_at >= ?'); params.push(startDate); }
    if (endDate)   { conditions.push('snapshot_at <= ?'); params.push(endDate); }
    const rows = db.prepare(
      `SELECT * FROM temperature_snapshots WHERE ${conditions.join(' AND ')} ORDER BY snapshot_at ASC LIMIT ?`,
    ).all(...params as [], limit) as SnapRow[];
    arr = rows.map(rowToSnapshot);
    historyMap.set(key, arr);
    return arr;
  }

  if (startDate) arr = arr.filter((s) => s.snapshotAt >= startDate);
  if (endDate)   arr = arr.filter((s) => s.snapshotAt <= endDate);
  return arr.slice(-limit);
}
