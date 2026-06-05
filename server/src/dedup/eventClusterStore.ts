/**
 * T007 事件簇内存存储
 *
 * 提供全局事件簇缓存，支持按 ID 查询、分页列表和按行业过滤。
 * 每次全量重新聚类时调用 replaceAll 替换所有簇。
 */

import type { EventCluster } from '../types.js';

const clusterMap = new Map<string, EventCluster>();

/**
 * 用新的聚类结果全量替换缓存（在每次全量聚类后调用）。
 */
export function replaceAll(clusters: EventCluster[]): void {
  clusterMap.clear();
  for (const c of clusters) {
    clusterMap.set(c.id, c);
  }
}

/**
 * 增量合并更新（在新内容写入后调用）。
 * 若某簇已存在，则合并 itemIds 并更新聚合指标。
 */
export function upsertClusters(clusters: EventCluster[]): void {
  for (const c of clusters) {
    const existing = clusterMap.get(c.id);
    if (!existing) {
      clusterMap.set(c.id, c);
    } else {
      // 合并 itemIds（去重）
      const ids = new Set([...existing.itemIds, ...c.itemIds]);
      const sources = new Set([...existing.sourceNames, ...c.sourceNames]);
      const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
      clusterMap.set(c.id, {
        ...existing,
        itemIds: [...ids],
        sourceNames: [...sources],
        sourceCount: sources.size,
        totalEngagement: existing.totalEngagement + c.totalEngagement,
        avgSentiment: (existing.avgSentiment + c.avgSentiment) / 2,
        maxRiskLevel:
          (riskOrder[c.maxRiskLevel] ?? 0) > (riskOrder[existing.maxRiskLevel] ?? 0)
            ? c.maxRiskLevel
            : existing.maxRiskLevel,
        lastSeenAt: c.lastSeenAt > existing.lastSeenAt ? c.lastSeenAt : existing.lastSeenAt,
      });
    }
  }
}

/** 按 ID 查询单个事件簇 */
export function getClusterById(id: string): EventCluster | undefined {
  return clusterMap.get(id);
}

/** 获取所有事件簇，支持分页和排序 */
export interface ClusterListParams {
  page?: number;
  pageSize?: number;
  /** 过滤：至少涉及多少个来源（去重效果评估用） */
  minSourceCount?: number;
  /** 过滤：最高风险等级 */
  maxRiskLevel?: string;
  sortBy?: 'totalEngagement' | 'sourceCount' | 'firstSeenAt' | 'lastSeenAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ClusterListResult {
  items: EventCluster[];
  total: number;
  page: number;
  pageSize: number;
}

export function listClusters(params: ClusterListParams = {}): ClusterListResult {
  const {
    page = 1,
    pageSize = 20,
    minSourceCount,
    maxRiskLevel,
    sortBy = 'totalEngagement',
    sortOrder = 'desc',
  } = params;

  let items = Array.from(clusterMap.values());

  if (minSourceCount !== undefined) {
    items = items.filter((c) => c.sourceCount >= minSourceCount);
  }
  if (maxRiskLevel) {
    const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const minRisk = riskOrder[maxRiskLevel] ?? 0;
    items = items.filter((c) => (riskOrder[c.maxRiskLevel] ?? 0) >= minRisk);
  }

  items.sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'totalEngagement') cmp = a.totalEngagement - b.totalEngagement;
    else if (sortBy === 'sourceCount') cmp = a.sourceCount - b.sourceCount;
    else if (sortBy === 'firstSeenAt') cmp = a.firstSeenAt.localeCompare(b.firstSeenAt);
    else if (sortBy === 'lastSeenAt') cmp = a.lastSeenAt.localeCompare(b.lastSeenAt);
    return sortOrder === 'desc' ? -cmp : cmp;
  });

  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

/** 返回当前缓存中的所有事件簇（供温度计算使用） */
export function getAllClusters(): EventCluster[] {
  return Array.from(clusterMap.values());
}

/** 当前总簇数 */
export function clusterCount(): number {
  return clusterMap.size;
}
