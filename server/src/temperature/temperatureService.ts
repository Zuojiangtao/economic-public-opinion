import type { ContentItem, SourceType, SourceConfig, IndustryMapping, TemperatureSnapshot, TemperatureLevel, TemperatureBreakdown, TemperatureDetail, RiskDistribution, TopContentSummary, EventCluster } from '../types.js';
import { buildSourceConfigMap, buildSourceTypeCredibility } from '../storage/sourceConfigsStore.js';
import { getAllClusters } from '../dedup/eventClusterStore.js';
import { scoreRelevance } from '../nlp/relevanceService.js';

/** T013：相关度过滤最低阈值（低于此分数视为偶发提及，不参与计算） */
const MIN_RELEVANCE = 15;

// ============================================================
// 来源可信度默认值（无配置时的兜底，0-100）
// ============================================================
const DEFAULT_SOURCE_CREDIBILITY: Record<SourceType, number> = {
  regulatory: 96, // 监管公告
  broker: 92,     // 券商研报
  news: 80,       // 主流新闻
  app: 70,        // 财经 APP
  forums: 45,     // 投资论坛
  social: 35,     // 社交媒体
};

// ============================================================
// 温度分层映射
// ============================================================
function getLevel(score: number): TemperatureLevel {
  if (score < 20) return 'freezing';
  if (score < 40) return 'cool';
  if (score < 60) return 'neutral';
  if (score < 80) return 'warm';
  return 'hot';
}

// ============================================================
// 根据行业关键词过滤匹配内容，并附带相关度权重（T013）
// ============================================================
interface WeightedItem {
  item: ContentItem;
  /** 相关度权重 0-1，由 T013 relevanceScore / 100 得出 */
  weight: number;
}

function getMatchedItems(industry: IndustryMapping, allItems: ContentItem[]): ContentItem[] {
  // 构建行业关键词集合（关键词 + 同义词 + 股票名称/简称 + 海外映射名称）
  const terms = new Set<string>();
  for (const kw of industry.keywords) terms.add(kw.toLowerCase());
  for (const syn of industry.synonyms) terms.add(syn.toLowerCase());
  for (const s of industry.stocks) {
    terms.add(s.name.toLowerCase());
    if (s.shortName) terms.add(s.shortName.toLowerCase());
    if (s.englishName) terms.add(s.englishName.toLowerCase());
    if (s.aliases) for (const a of s.aliases) terms.add(a.toLowerCase());
    terms.add(s.code.toLowerCase());
  }
  for (const om of industry.overseasMappings) {
    terms.add(om.name.toLowerCase());
    terms.add(om.code.toLowerCase());
  }
  for (const idx of industry.indices) terms.add(idx.toLowerCase());

  return allItems.filter((item) => {
    const text = `${item.title} ${item.content}`.toLowerCase();
    for (const term of terms) {
      if (term && text.includes(term)) return true;
    }
    return false;
  });
}

/**
 * T013：在 boolean 匹配基础上，为每条匹配内容计算相关度权重。
 * 低于 MIN_RELEVANCE 的内容被过滤（偶发提及）。
 */
function getWeightedItems(industry: IndustryMapping, allItems: ContentItem[]): WeightedItem[] {
  const matched = getMatchedItems(industry, allItems);
  return matched
    .map((item) => {
      const rel = scoreRelevance(item, industry);
      return { item, weight: rel.relevanceScore / 100 };
    })
    .filter((wi) => wi.weight * 100 >= MIN_RELEVANCE);
}

// ============================================================
// 情绪得分 0-100（35%）
// T013 升级：相关度加权均值，高相关内容贡献更大
// ============================================================
function calcSentimentScore(weighted: WeightedItem[]): number {
  if (weighted.length === 0) return 50;
  let wSum = 0;
  let totalW = 0;
  for (const { item, weight } of weighted) {
    wSum   += item.nlp.sentiment * weight;
    totalW += weight;
  }
  if (totalW === 0) return 50;
  const avg = wSum / totalW; // [-1, 1]
  return Math.round(((avg + 1) / 2) * 100);
}

// ============================================================
// 声量异动得分 0-100（25%）
// T007 升级：使用事件簇数量而非原始内容数量，避免同一事件跨平台
// 转载后重复放大声量。有事件簇数据时优先使用，否则退化为原始计数。
// ============================================================
function calcVolumeAnomalyScore(clusterCount: number, allClusterCounts: number[]): number {
  const max = Math.max(...allClusterCounts);
  if (max === 0) return 0;
  return Math.round((clusterCount / max) * 100);
}

/**
 * T013：统计涉及的不同事件簇数量（以相关度加权，高相关内容权重更大）。
 * 若一条内容尚未聚类（dedup.clusterId 为空），则视为独立事件。
 */
function countClusters(weighted: WeightedItem[], allClusters: Map<string, EventCluster>): number {
  // 使用加权有效计数：每个独立事件簇贡献 max(relevanceWeight) 而非固定 1
  const clusterWeights = new Map<string, number>();
  for (const { item, weight } of weighted) {
    const cid = item.dedup?.clusterId && allClusters.has(item.dedup.clusterId)
      ? item.dedup.clusterId
      : `__solo__${item.id}`;
    const prev = clusterWeights.get(cid) ?? 0;
    if (weight > prev) clusterWeights.set(cid, weight);
  }
  // 有效簇数 = 各簇最大权重之和（近似于去重后的相关事件数量）
  let effectiveCount = 0;
  for (const w of clusterWeights.values()) effectiveCount += w;
  return effectiveCount;
}

// ============================================================
// 传播热度得分 0-100（20%）
// T013 升级：用相关度权重加权互动量，偶发提及的低相关内容贡献较小
// ============================================================
function calcSpreadIntensityScore(weighted: WeightedItem[], allMaxEngagement: number): number {
  if (weighted.length === 0) return 0;
  const totalEngagement = weighted.reduce((sum, { item, weight }) => {
    const m = item.metrics;
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1;
    return sum + eng * weight;
  }, 0);
  if (allMaxEngagement === 0) return 0;
  return Math.round(Math.min(100, (totalEngagement / allMaxEngagement) * 100));
}

// ============================================================
// 来源可信度得分 0-100（20%）
// 优先使用动态 SourceConfig 查找，按 sourceName 精确匹配；
// 未命中则按 sourceType 使用类型级平均值；
// includeInTemperature=false 的内容不参与计算（忽略）。
// ============================================================
function calcSourceCredibilityScore(
  weighted: WeightedItem[],
  sourceConfigMap?: Map<string, SourceConfig>,
  sourceTypeCredibility?: Map<string, number>,
): number {
  // 过滤掉被标记为不纳入温度计算的数据源内容
  const eligible = sourceConfigMap
    ? weighted.filter(({ item }) => {
        const cfg = sourceConfigMap.get(item.sourceName);
        // 若找不到精确匹配配置，保留（按类型兜底）
        return !cfg || cfg.includeInTemperature;
      })
    : weighted;

  if (eligible.length === 0) return 60; // 无数据时取保守默认

  // T013：以相关度权重加权均值
  let wSum = 0;
  let totalW = 0;
  for (const { item, weight } of eligible) {
    let cred: number;
    if (sourceConfigMap) {
      const cfg = sourceConfigMap.get(item.sourceName);
      cred = cfg
        ? cfg.credibilityScore
        : (sourceTypeCredibility?.get(item.sourceType) ?? DEFAULT_SOURCE_CREDIBILITY[item.sourceType] ?? 50);
    } else {
      cred = DEFAULT_SOURCE_CREDIBILITY[item.sourceType] ?? 50;
    }
    wSum   += cred * weight;
    totalW += weight;
  }

  return totalW === 0 ? 60 : Math.round(wSum / totalW);
}

// ============================================================
// 综合温度公式
// 板块温度 = 情绪得分*35% + 声量异动*25% + 传播热度*20% + 来源可信度*20%
// ============================================================
function calcTemperature(bd: TemperatureBreakdown): number {
  const score =
    bd.sentimentScore * 0.35 +
    bd.volumeAnomalyScore * 0.25 +
    bd.spreadIntensityScore * 0.20 +
    bd.sourceCredibilityScore * 0.20;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================
// 主入口：为所有行业批量计算温度快照
// ============================================================
export function computeTemperatureSnapshots(
  industries: IndustryMapping[],
  allItems: ContentItem[],
  granularity: 'hour' | 'day' = 'hour',
  sourceConfigs?: SourceConfig[],
): TemperatureSnapshot[] {
  const now = new Date();
  const nowIso = now.toISOString();

  // 时间桶：小时级取整到小时，日级取整到天，保证同一时间桶内 ID 不变
  const bucket = granularity === 'hour'
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // 构建来源查找索引（T006 动态权重）
  const sourceConfigMap = sourceConfigs ? buildSourceConfigMap(sourceConfigs) : undefined;
  const sourceTypeCredibility = sourceConfigs ? buildSourceTypeCredibility(sourceConfigs) : undefined;

  // T007：建立事件簇索引，用于声量去重
  const allClusters = new Map(getAllClusters().map((c) => [c.id, c]));

  // T013：预先为每个行业收集加权内容（相关度过滤后）
  const industryWeighted: WeightedItem[][] = industries.map((ind) => getWeightedItems(ind, allItems));

  // 声量: 每个行业的有效加权事件簇数（T007+T013）
  const clusterCounts = industryWeighted.map((wi) => countClusters(wi, allClusters));

  // 传播热度: 每个行业的加权互动量总和，取全局最大值用于归一化
  const engagements = industryWeighted.map((wi) =>
    wi.reduce((sum, { item, weight }) => {
      const m = item.metrics;
      return sum + ((m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1) * weight;
    }, 0),
  );
  const maxEngagement = Math.max(...engagements, 1);

  return industries.map((industry, i) => {
    const wi = industryWeighted[i];
    const count = wi.length;

    const breakdown: TemperatureBreakdown = {
      sentimentScore: calcSentimentScore(wi),
      volumeAnomalyScore: calcVolumeAnomalyScore(clusterCounts[i], clusterCounts),
      spreadIntensityScore: calcSpreadIntensityScore(wi, maxEngagement),
      sourceCredibilityScore: calcSourceCredibilityScore(wi, sourceConfigMap, sourceTypeCredibility),
    };

    const score = calcTemperature(breakdown);

    const dist = { positive: 0, neutral: 0, negative: 0 };
    for (const { item } of wi) dist[item.nlp.sentimentLabel]++;

    return {
      id: `temp-${industry.id}-${granularity}-${bucket}`,
      industryId: industry.id,
      industryName: industry.name,
      score,
      level: getLevel(score),
      breakdown,
      contentCount: count,
      sentimentDistribution: dist,
      snapshotAt: nowIso,
      granularity,
    } satisfies TemperatureSnapshot;
  });
}

// ============================================================
// 计算单个行业的温度详情（含风险分布 + 关键驱动内容）
// ============================================================
export function computeTemperatureDetail(
  industry: IndustryMapping,
  allItems: ContentItem[],
  granularity: 'hour' | 'day' = 'hour',
  topN = 5,
  sourceConfigs?: SourceConfig[],
): TemperatureDetail {
  const now = new Date();
  const nowIso = now.toISOString();

  // 时间桶：与 computeTemperatureSnapshots 保持一致
  const bucket = granularity === 'hour'
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}`
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // T013：使用相关度加权的内容集
  const wi = getWeightedItems(industry, allItems);
  const items = wi.map((w) => w.item);

  // 构建来源查找索引（T006 动态权重）
  const sourceConfigMap = sourceConfigs ? buildSourceConfigMap(sourceConfigs) : undefined;
  const sourceTypeCredibility = sourceConfigs ? buildSourceTypeCredibility(sourceConfigs) : undefined;

  // T007：建立事件簇索引，用于声量去重
  const allClusters = new Map(getAllClusters().map((c) => [c.id, c]));

  const count = wi.length;
  const clusterCount = countClusters(wi, allClusters);

  // T013：加权互动量
  const weightedEngagements = wi.map(({ item, weight }) => {
    const m = item.metrics;
    return ((m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1) * weight;
  });
  const maxEngagement = Math.max(...weightedEngagements, 1);
  const totalEngagement = weightedEngagements.reduce((s, e) => s + e, 0);

  const breakdown: TemperatureBreakdown = {
    sentimentScore: calcSentimentScore(wi),
    // T007+T013：声量使用加权事件簇数，单行业场景以自身归一化
    volumeAnomalyScore: clusterCount > 0 ? Math.min(100, Math.round((clusterCount / Math.max(count, 1)) * 100 + 20)) : 0,
    spreadIntensityScore: Math.round(Math.min(100, (totalEngagement / maxEngagement) * 100)),
    sourceCredibilityScore: calcSourceCredibilityScore(wi, sourceConfigMap, sourceTypeCredibility),
  };

  const score = calcTemperature(breakdown);

  const sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
  const riskDistribution: RiskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const c of items) {
    sentimentDistribution[c.nlp.sentimentLabel]++;
    riskDistribution[c.nlp.riskLevel]++;
  }

  // 关键驱动内容：高风险 + 高相关度优先，互动量次之，取前 topN 条
  const sortedItems = [...wi].sort((a, b) => {
    const riskOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const riskDiff = (riskOrder[b.item.nlp.riskLevel] ?? 0) - (riskOrder[a.item.nlp.riskLevel] ?? 0);
    if (riskDiff !== 0) return riskDiff;
    // 同风险级别下，按相关度权重降序
    const relDiff = b.weight - a.weight;
    if (Math.abs(relDiff) > 0.1) return relDiff;
    const aEng = (a.item.metrics.likes ?? 0) + (a.item.metrics.comments ?? 0) + (a.item.metrics.shares ?? 0);
    const bEng = (b.item.metrics.likes ?? 0) + (b.item.metrics.comments ?? 0) + (b.item.metrics.shares ?? 0);
    return bEng - aEng;
  });

  const topContents: TopContentSummary[] = sortedItems.slice(0, topN).map(({ item: c }) => ({
    id: c.id,
    title: c.title,
    sourceType: c.sourceType,
    sourceName: c.sourceName,
    publishedAt: c.publishedAt,
    sentiment: c.nlp.sentimentLabel,
    riskLevel: c.nlp.riskLevel,
    url: c.url,
  }));

  return {
    id: `temp-${industry.id}-${granularity}-${bucket}`,
    industryId: industry.id,
    industryName: industry.name,
    score,
    level: getLevel(score),
    breakdown,
    contentCount: count,
    sentimentDistribution,
    snapshotAt: nowIso,
    granularity,
    riskDistribution,
    topContents,
  } satisfies TemperatureDetail;
}
