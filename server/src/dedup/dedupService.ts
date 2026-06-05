/**
 * T007 内容去重和事件聚类服务
 *
 * 算法流程：
 * 1. URL 精确去重（已由 JsonStorage 在写入时处理）
 * 2. 标题归一化 → 字符 trigram Jaccard 相似度 >= TITLE_THRESHOLD 判定为相似
 * 3. 对标题相似的内容，再比较正文词级 bigram Jaccard >= BODY_THRESHOLD 确认
 * 4. 将相似内容归并为事件簇，以最早/互动量最高的内容为代表
 * 5. 回写 item.dedup.clusterId 和 item.dedup.similarCount
 */

import type { ContentItem, EventCluster, SentimentLabel, RiskLevel } from '../types.js';

// ── 相似度阈值 ──────────────────────────────────────────────
const TITLE_THRESHOLD = 0.35;   // 标题 trigram Jaccard
const BODY_THRESHOLD  = 0.25;   // 正文 bigram Jaccard（仅在标题相似时才检查）

// ── 工具函数 ────────────────────────────────────────────────

/**
 * 标题归一化：小写、去除 HTML 标签、标点/特殊字符转空格、合并空白。
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')                  // 去 HTML 标签
    .replace(/[^\u4e00-\u9fa5\w\s]/g, ' ')    // 保留汉字、英文数字，其余转空格
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 生成字符串的字符 n-gram 集合。
 */
function charNgrams(text: string, n: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= text.length - n; i++) {
    set.add(text.slice(i, i + n));
  }
  return set;
}

/**
 * 生成词级 bigram 集合（用于正文相似度）。
 */
function wordBigrams(text: string): Set<string> {
  const words = text.split(/\s+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    set.add(`${words[i]}|${words[i + 1]}`);
  }
  return set;
}

/**
 * Jaccard 相似度：|A ∩ B| / |A ∪ B|
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 计算内容互动量（用于选择代表内容）。
 */
function engagement(item: ContentItem): number {
  const m = item.metrics;
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1;
}

// ── 缓存预计算索引 ──────────────────────────────────────────

interface ItemIndex {
  id: string;
  titleNgrams: Set<string>;
  bodyBigrams: Set<string> | null; // 懒加载
  normalizedTitle: string;
  item: ContentItem;
}

function buildIndex(item: ContentItem): ItemIndex {
  const norm = normalizeTitle(item.title);
  return {
    id: item.id,
    normalizedTitle: norm,
    titleNgrams: charNgrams(norm, 3),
    bodyBigrams: null, // 按需计算
    item,
  };
}

function getBodyBigrams(idx: ItemIndex): Set<string> {
  if (!idx.bodyBigrams) {
    const norm = normalizeTitle(idx.item.content.slice(0, 500)); // 只取前500字
    idx.bodyBigrams = wordBigrams(norm);
  }
  return idx.bodyBigrams;
}

// ── 简单哈希用于生成稳定的 cluster ID ─────────────────────

function simpleHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── 核心聚类算法 ────────────────────────────────────────────

/**
 * 对给定的内容列表进行去重和聚类，返回事件簇列表，并原地更新 item.dedup。
 *
 * 算法：单遍扫描 Union-Find 风格分组
 * - 时间复杂度 O(n²) 在最坏情况下，但正常数据量（<10k条）可接受
 * - 对超大数据集可改为 LSH，此处 MVP 版本保持简单
 */
export function clusterItems(items: ContentItem[]): EventCluster[] {
  if (items.length === 0) return [];

  const indices: ItemIndex[] = items.map(buildIndex);
  // parent[i] = i 表示 i 是自己的根
  const parent: number[] = indices.map((_, i) => i);

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // 路径压缩
      i = parent[i];
    }
    return i;
  }

  function union(i: number, j: number): void {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) parent[pi] = pj;
  }

  // 两两比较（O(n²)）
  for (let i = 0; i < indices.length; i++) {
    for (let j = i + 1; j < indices.length; j++) {
      // 快速过滤：标题长度差超过 50% 直接跳过
      const li = indices[i].normalizedTitle.length;
      const lj = indices[j].normalizedTitle.length;
      if (li === 0 || lj === 0) continue;
      if (Math.abs(li - lj) / Math.max(li, lj) > 0.7) continue;

      const titleSim = jaccardSimilarity(indices[i].titleNgrams, indices[j].titleNgrams);
      if (titleSim < TITLE_THRESHOLD) continue;

      // 标题相似，再检查正文
      const bi = getBodyBigrams(indices[i]);
      const bj = getBodyBigrams(indices[j]);
      const bodySim = jaccardSimilarity(bi, bj);
      if (bodySim >= BODY_THRESHOLD) {
        union(i, j);
      } else if (titleSim >= 0.6) {
        // 标题非常相似（≥0.6）即使正文不同也合并（转载摘要常见情况）
        union(i, j);
      }
    }
  }

  // 按根分组
  const groups = new Map<number, number[]>();
  for (let i = 0; i < indices.length; i++) {
    const root = find(i);
    const g = groups.get(root) ?? [];
    g.push(i);
    groups.set(root, g);
  }

  const riskOrder: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 };

  const clusters: EventCluster[] = [];

  for (const memberIndices of groups.values()) {
    const memberItems = memberIndices.map((i) => indices[i].item);

    // 选代表：互动量最高，同等情况取发布时间最早
    const representative = memberItems.reduce((best, cur) => {
      const engBest = engagement(best);
      const engCur = engagement(cur);
      if (engCur > engBest) return cur;
      if (engCur === engBest && cur.publishedAt < best.publishedAt) return cur;
      return best;
    });

    // 聚合指标
    const sourceNames = [...new Set(memberItems.map((c) => c.sourceName))];
    const totalEng = memberItems.reduce((s, c) => s + engagement(c), 0);
    const avgSentiment =
      memberItems.reduce((s, c) => s + c.nlp.sentiment, 0) / memberItems.length;

    // 情绪分布
    const sentimentCount: Record<SentimentLabel, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const c of memberItems) sentimentCount[c.nlp.sentimentLabel]++;
    const dominantSentiment = (Object.keys(sentimentCount) as SentimentLabel[]).reduce(
      (a, b) => (sentimentCount[a] >= sentimentCount[b] ? a : b),
    );

    // 最高风险
    const maxRiskLevel = memberItems.reduce<RiskLevel>((max, c) => {
      return riskOrder[c.nlp.riskLevel] > riskOrder[max] ? c.nlp.riskLevel : max;
    }, 'low');

    const firstSeenAt = memberItems.reduce((min, c) => (c.publishedAt < min ? c.publishedAt : min), memberItems[0].publishedAt);
    const lastSeenAt = memberItems.reduce((max, c) => (c.publishedAt > max ? c.publishedAt : max), memberItems[0].publishedAt);

    // 生成稳定的 cluster ID（基于代表内容 ID）
    const clusterId = `cluster-${simpleHash(representative.id)}`;

    const cluster: EventCluster = {
      id: clusterId,
      representativeId: representative.id,
      itemIds: memberItems.map((c) => c.id),
      sourceNames,
      sourceCount: sourceNames.length,
      totalEngagement: Math.round(totalEng),
      avgSentiment: Math.round(avgSentiment * 1000) / 1000,
      dominantSentiment,
      maxRiskLevel,
      title: representative.title,
      firstSeenAt,
      lastSeenAt,
    };

    clusters.push(cluster);

    // 回写 dedup 字段到每条内容
    for (const c of memberItems) {
      c.dedup = { clusterId, similarCount: memberItems.length - 1 };
    }
  }

  return clusters;
}
