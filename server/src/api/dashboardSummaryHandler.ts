/**
 * H006 首页聚合接口处理器
 * 聚合预警、温度、内容、事件分布、采集健康、监测方案命中等首页所需数据。
 */
import type { JsonStorage } from '../storage/JsonStorage.js';
import type { Alert, SourceConfig, IndustryMapping, ContentItem } from '../types.js';
import { computeTemperatureSnapshots } from '../temperature/temperatureService.js';
import type { CrawlScheduler } from '../scheduler/CrawlScheduler.js';

export interface DashboardParams {
  startDate?: string;
  endDate?: string;
  market?: string;
  projectId?: string;
}

type MonitoringProjectLike = {
  name?: string;
  targetIds?: string[];
  keywords?: {
    core?: string[];
    extended?: string[];
    exclude?: string[];
    include?: string[];
  };
};

export function buildDashboardSummary(
  storage: JsonStorage,
  alerts: Map<string, Alert>,
  industryMappings: Map<string, IndustryMapping>,
  projects: Map<string, MonitoringProjectLike>,
  sourceConfigs: SourceConfig[],
  scheduler: CrawlScheduler,
  params: DashboardParams,
) {
  const { startDate, endDate, market, projectId } = params;

  // ============================================================
  // 内容过滤
  // ============================================================
  let allItems: ContentItem[] = storage.getAll();
  // 默认时间窗口：最近 7 天（与小时级温度计算窗口一致）
  const defaultCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  if (!startDate || startDate < defaultCutoff) {
    allItems = allItems.filter((i) => i.publishedAt >= defaultCutoff);
  } else {
    allItems = allItems.filter((i) => i.publishedAt >= startDate);
  }
  if (endDate)   allItems = allItems.filter((i) => i.publishedAt <= endDate);
  if (market)    allItems = allItems.filter((i) => i.market === market);
  if (projectId) {
    const p = projects.get(projectId);
    if (p) {
      const include = [
        ...(p.keywords?.core ?? p.keywords?.include ?? []),
        ...(p.keywords?.extended ?? []),
      ].map((k: string) => k.toLowerCase());
      const exclude = (p.keywords?.exclude ?? []).map((k: string) => k.toLowerCase());
      allItems = allItems.filter((i) => {
        if (i.matches?.some((m) => m.projectId === projectId)) return true;
        const text = (i.title + ' ' + (i.content ?? '')).toLowerCase();
        return (
          include.some((k) => text.includes(k)) &&
          !exclude.some((k) => text.includes(k))
        );
      });
    }
  }

  // ============================================================
  // 预警统计
  // ============================================================
  const allAlerts = Array.from(alerts.values());
  const pendingAlertCount = allAlerts.filter((a) => a.status === 'pending').length;
  const highRiskAlertCount = allAlerts.filter(
    (a) => a.riskLevel === 'high' || a.riskLevel === 'critical',
  ).length;

  // 高优先级预警列表（pending + high/critical，最多 8 条）
  const topAlerts = allAlerts
    .filter(
      (a) =>
        a.status === 'pending' &&
        (a.riskLevel === 'high' || a.riskLevel === 'critical'),
    )
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt))
    .slice(0, 8);

  // ============================================================
  // 行业温度
  // 温度计算使用与 /temperatures 接口相同的时间窗口逻辑，
  // 同时受 startDate/endDate 和 market/projectId 过滤影响，
  // 确保两页数据完全一致。
  // ============================================================
  let industries = Array.from(industryMappings.values());
  if (market) {
    industries = industries.filter((m) =>
      m.stocks.some((s) => s.market === market),
    );
  }
  if (projectId) {
    const p = projects.get(projectId);
    if (p?.targetIds?.length) {
      const targetIds = new Set(p.targetIds);
      industries = industries.filter((m) => targetIds.has(m.id));
    }
  }

  // 温度计算：与 /temperatures?granularity=hour 使用相同的时间窗口逻辑
  // 默认 7 天；若有 startDate 则取 max(startDate, 7天前)
  const tempWindowDays = 7;
  const tempNow = Date.now();
  const tempDefaultCutoff = new Date(tempNow - tempWindowDays * 86_400_000).toISOString();
  const tempCutoff = (!startDate || startDate < tempDefaultCutoff) ? tempDefaultCutoff : startDate;

  let tempItems = storage.getAll().filter((item) => item.publishedAt >= tempCutoff);
  if (endDate) tempItems = tempItems.filter((item) => item.publishedAt <= endDate);

  const snapshots = computeTemperatureSnapshots(
    industries,
    tempItems,
    'hour',
    sourceConfigs,
  );

  // 填充 scoreDelta：对比前一窗口的内容
  // 前一窗口时长 = 当前窗口时长，紧邻当前窗口之前
  const currentWindowMs = endDate && startDate
    ? new Date(endDate).getTime() - new Date(startDate).getTime()
    : tempWindowDays * 86_400_000;
  const prevCutoffEnd = tempCutoff;
  const prevCutoffStart = new Date(new Date(prevCutoffEnd).getTime() - currentWindowMs).toISOString();
  const prevItems = storage.getAll().filter(
    (item) => item.publishedAt >= prevCutoffStart && item.publishedAt < prevCutoffEnd,
  );

  if (prevItems.length > 0) {
    const prevSnapshots = computeTemperatureSnapshots(industries, prevItems, 'hour', sourceConfigs);
    const prevScoreMap = new Map(prevSnapshots.map((s) => [s.industryId, s.score]));
    for (const snap of snapshots) {
      const prevScore = prevScoreMap.get(snap.industryId);
      snap.scoreDelta = prevScore !== undefined ? snap.score - prevScore : 0;
    }
  } else {
    for (const snap of snapshots) {
      snap.scoreDelta = 0;
    }
  }

  const sortedByScore = [...snapshots].sort((a, b) => b.score - a.score);
  const temperatureTopList = sortedByScore.slice(0, 5);
  const risingList = [...snapshots]
    .filter((t) => (t.scoreDelta ?? 0) > 0)
    .sort((a, b) => (b.scoreDelta ?? 0) - (a.scoreDelta ?? 0))
    .slice(0, 3);
  const fallingList = [...snapshots]
    .filter((t) => (t.scoreDelta ?? 0) < 0)
    .sort((a, b) => (a.scoreDelta ?? 0) - (b.scoreDelta ?? 0))
    .slice(0, 3);

  const hotIndustry = sortedByScore[0];
  const risingIndustry = snapshots.reduce<(typeof snapshots)[0] | undefined>(
    (max, t) =>
      (t.scoreDelta ?? -Infinity) > (max?.scoreDelta ?? -Infinity) ? t : max,
    undefined,
  );

  const mostNegativeIndustry = snapshots.reduce<
    { industryId: string; industryName: string; negativeRatio: number } | undefined
  >((max, t) => {
    const total =
      t.sentimentDistribution.positive +
      t.sentimentDistribution.neutral +
      t.sentimentDistribution.negative;
    const ratio = total > 0 ? t.sentimentDistribution.negative / total : 0;
    return ratio > (max?.negativeRatio ?? 0)
      ? { industryId: t.industryId, industryName: t.industryName, negativeRatio: ratio }
      : max;
  }, undefined);

  // ============================================================
  // 近期高风险事件数
  // ============================================================
  const recentHighRiskEventCount = allItems.filter(
    (i) => i.nlp.riskLevel === 'high' || i.nlp.riskLevel === 'critical',
  ).length;

  // ============================================================
  // H008 关键驱动内容（按风险等级降序 + 发布时间降序，取前 5 条）
  // ============================================================
  const riskOrder: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  const keyContents: ContentItem[] = [...allItems]
    .sort((a, b) => {
      const rDiff = riskOrder[b.nlp.riskLevel] - riskOrder[a.nlp.riskLevel];
      if (rDiff !== 0) return rDiff;
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, 5);

  // ============================================================
  // H009 事件类型分布
  // ============================================================
  const typeCounts: Record<
    string,
    {
      count: number;
      positiveCount: number;
      negativeCount: number;
      neutralCount: number;
      uncertainCount: number;
    }
  > = {};
  for (const item of allItems) {
    const events = item.nlp?.events ?? [];
    for (const evt of events) {
      if (!typeCounts[evt.type]) {
        typeCounts[evt.type] = {
          count: 0,
          positiveCount: 0,
          negativeCount: 0,
          neutralCount: 0,
          uncertainCount: 0,
        };
      }
      typeCounts[evt.type].count += 1;
      const dir = evt.impactDirection;
      if (dir === 'positive')  typeCounts[evt.type].positiveCount  += 1;
      if (dir === 'negative')  typeCounts[evt.type].negativeCount  += 1;
      if (dir === 'neutral')   typeCounts[evt.type].neutralCount   += 1;
      if (dir === 'uncertain') typeCounts[evt.type].uncertainCount += 1;
    }
  }
  const eventDistribution = {
    total: allItems.length,
    distribution: Object.entries(typeCounts)
      .map(([type, counts]) => ({ type, ...counts }))
      .sort((a, b) => b.count - a.count),
  };

  // ============================================================
  // H010 采集健康摘要
  // ============================================================
  const crawlerStatuses = scheduler.getStatuses();
  const totalCrawlerCount = crawlerStatuses.length;
  const availableCrawlerCount = crawlerStatuses.filter(
    (s) => !s.circuitOpen && s.consecutiveFailures === 0,
  ).length;
  const recentFailures = crawlerStatuses
    .filter((s) => s.consecutiveFailures > 0 || s.circuitOpen)
    .map((s) => ({
      name: s.name,
      sourceName: s.sourceName,
      lastFailedAt: s.lastCrawlAt ?? '',
    }))
    .slice(0, 3);

  // ============================================================
  // H011 监测方案命中排行
  // ============================================================
  const projectHitMap = new Map<
    string,
    { name: string; hitCount: number; hasHighRisk: boolean }
  >();

  /** 判断内容是否匹配某监测方案的关键词规则 */
  function itemMatchesProject(item: ContentItem, p: MonitoringProjectLike): boolean {
    const include = [
      ...(p.keywords?.core ?? p.keywords?.include ?? []),
      ...(p.keywords?.extended ?? []),
    ].map((k: string) => k.toLowerCase());
    const exclude = (p.keywords?.exclude ?? []).map((k: string) => k.toLowerCase());
    // 优先使用预填充的 matches
    if (item.matches?.some((m) => m.projectId !== undefined)) return true;
    if (include.length === 0) return false;
    const text = (item.title + ' ' + (item.content ?? '')).toLowerCase();
    return include.some((k) => text.includes(k)) && !exclude.some((k) => text.includes(k));
  }

  for (const [pid, p] of projects) {
    const matchedItems = allItems.filter((item) => {
      // 优先检查预填充 matches
      if (item.matches?.some((m) => m.projectId === pid)) return true;
      return itemMatchesProject(item, p);
    });
    if (matchedItems.length === 0) continue;
    projectHitMap.set(pid, {
      name: (p as { name?: string }).name ?? pid,
      hitCount: matchedItems.length,
      hasHighRisk: matchedItems.some(
        (i) => i.nlp.riskLevel === 'high' || i.nlp.riskLevel === 'critical',
      ),
    });
  }
  const monitoringProjectHits = Array.from(projectHitMap.entries())
    .map(([pid, data]) => ({
      projectId: pid,
      projectName: data.name,
      hitCount: data.hitCount,
      hasHighRisk: data.hasHighRisk,
    }))
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 5);

  // ============================================================
  // 返回聚合结果
  // ============================================================
  return {
    pendingAlertCount,
    highRiskAlertCount,
    hotIndustry: hotIndustry
      ? {
          industryId: hotIndustry.industryId,
          industryName: hotIndustry.industryName,
          score: hotIndustry.score,
          level: hotIndustry.level,
        }
      : undefined,
    fastestRisingIndustry:
      risingIndustry && (risingIndustry.scoreDelta ?? 0) > 0
        ? {
            industryId: risingIndustry.industryId,
            industryName: risingIndustry.industryName,
            scoreDelta: risingIndustry.scoreDelta!,
          }
        : undefined,
    mostNegativeIndustry,
    recentHighRiskEventCount,
    temperatureTopList,
    risingList,
    fallingList,
    topAlerts,
    keyContents,
    eventDistribution,
    crawlerHealth: {
      totalCount: totalCrawlerCount,
      availableCount: availableCrawlerCount,
      failedCount: totalCrawlerCount - availableCrawlerCount,
      recentFailures,
    },
    monitoringProjectHits,
  };
}
