import type { TemperatureSnapshot } from '../types.js';

/**
 * 内存中的温度快照缓存。
 * 按 industryId 索引最新快照（小时级和日级各一份）。
 */
const hourlyCache = new Map<string, TemperatureSnapshot>();
const dailyCache = new Map<string, TemperatureSnapshot>();

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
