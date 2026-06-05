import type { TemperatureSnapshot } from '../types.js';

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
 * 将快照推入历史记录，按 snapshotAt 去重（同一时间桶更新而非追加）。
 */
export function pushToHistory(snapshots: TemperatureSnapshot[]): void {
  for (const snap of snapshots) {
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
 */
export function getHistory(
  industryId: string,
  granularity: 'hour' | 'day' = 'hour',
  limit = 24,
  startDate?: string,
  endDate?: string,
): TemperatureSnapshot[] {
  const key = `${industryId}-${granularity}`;
  let arr = historyMap.get(key) ?? [];
  if (startDate) arr = arr.filter((s) => s.snapshotAt >= startDate);
  if (endDate) arr = arr.filter((s) => s.snapshotAt <= endDate);
  // 返回最新 limit 条，保持时间升序
  return arr.slice(-limit);
}
