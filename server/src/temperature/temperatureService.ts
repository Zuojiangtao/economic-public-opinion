import type { ContentItem, SourceType, SourceConfig, IndustryMapping, TemperatureSnapshot, TemperatureLevel, TemperatureBreakdown, TemperatureDetail, RiskDistribution, TopContentSummary, EventCluster } from '../types.js';
import { buildSourceConfigMap, buildSourceTypeCredibility } from '../storage/sourceConfigsStore.js';
import { getAllClusters } from '../dedup/eventClusterStore.js';

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
// 根据行业关键词过滤匹配内容
// ============================================================
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

// ============================================================
// 情绪得分 0-100（35%）
// 将 nlp.sentiment [-1, 1] 映射到 [0, 100]，取命中内容均值
// ============================================================
function calcSentimentScore(items: ContentItem[]): number {
  if (items.length === 0) return 50; // 无数据时取中性值
  const avg = items.reduce((sum, c) => sum + c.nlp.sentiment, 0) / items.length;
  // [-1, 1] -> [0, 100]
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
 * 根据行业命中内容 ID 集合，统计涉及的不同事件簇数量。
 * 若一条内容尚未聚类（dedup.clusterId 为空），则视为独立事件（簇数 +1）。
 */
function countClusters(items: ContentItem[], allClusters: Map<string, EventCluster>): number {
  const clusterIds = new Set<string>();
  for (const item of items) {
    const cid = item.dedup?.clusterId;
    if (cid && allClusters.has(cid)) {
      clusterIds.add(cid);
    } else {
      // 未聚类的内容视为独立事件
      clusterIds.add(`__solo__${item.id}`);
    }
  }
  return clusterIds.size;
}

// ============================================================
// 传播热度得分 0-100（20%）
// 基于点赞/评论/转发/阅读等互动指标加权求和后归一化
// ============================================================
function calcSpreadIntensityScore(items: ContentItem[], allMaxEngagement: number): number {
  if (items.length === 0) return 0;
  const totalEngagement = items.reduce((sum, c) => {
    const m = c.metrics;
    return sum + (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1;
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
  items: ContentItem[],
  sourceConfigMap?: Map<string, SourceConfig>,
  sourceTypeCredibility?: Map<string, number>,
): number {
  // 过滤掉被标记为不纳入温度计算的数据源内容
  const eligible = sourceConfigMap
    ? items.filter((c) => {
        const cfg = sourceConfigMap.get(c.sourceName);
        // 若找不到精确匹配配置，保留（按类型兜底）
        return !cfg || cfg.includeInTemperature;
      })
    : items;

  if (eligible.length === 0) return 60; // 无数据时取保守默认

  const avg =
    eligible.reduce((sum, c) => {
      if (sourceConfigMap) {
        const cfg = sourceConfigMap.get(c.sourceName);
        if (cfg) return sum + cfg.credibilityScore;
        // 按 sourceType 类型兜底
        const typeCred = sourceTypeCredibility?.get(c.sourceType) ?? DEFAULT_SOURCE_CREDIBILITY[c.sourceType] ?? 50;
        return sum + typeCred;
      }
      return sum + (DEFAULT_SOURCE_CREDIBILITY[c.sourceType] ?? 50);
    }, 0) / eligible.length;

  return Math.round(avg);
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
  const now = new Date().toISOString();

  // 构建来源查找索引（T006 动态权重）
  const sourceConfigMap = sourceConfigs ? buildSourceConfigMap(sourceConfigs) : undefined;
  const sourceTypeCredibility = sourceConfigs ? buildSourceTypeCredibility(sourceConfigs) : undefined;

  // T007：建立事件簇索引，用于声量去重
  const allClusters = new Map(getAllClusters().map((c) => [c.id, c]));

  // 预先为每个行业收集命中内容
  const industryItems: ContentItem[][] = industries.map((ind) => getMatchedItems(ind, allItems));

  // 声量: 每个行业的命中数量
  const counts = industryItems.map((items) => items.length);

  // T007 声量（事件簇级别，去重后）
  const clusterCounts = industryItems.map((items) => countClusters(items, allClusters));

  // 传播热度: 每个行业的总互动量，取全局最大值用于归一化
  const engagements = industryItems.map((items) =>
    items.reduce((sum, c) => {
      const m = c.metrics;
      return sum + (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1;
    }, 0),
  );
  const maxEngagement = Math.max(...engagements, 1);

  return industries.map((industry, i) => {
    const items = industryItems[i];
    const count = counts[i];

    const breakdown: TemperatureBreakdown = {
      sentimentScore: calcSentimentScore(items),
      volumeAnomalyScore: calcVolumeAnomalyScore(clusterCounts[i], clusterCounts),
      spreadIntensityScore: calcSpreadIntensityScore(items, maxEngagement),
      sourceCredibilityScore: calcSourceCredibilityScore(items, sourceConfigMap, sourceTypeCredibility),
    };

    const score = calcTemperature(breakdown);

    const dist = { positive: 0, neutral: 0, negative: 0 };
    for (const c of items) dist[c.nlp.sentimentLabel]++;

    return {
      id: `temp-${industry.id}-${granularity}`,
      industryId: industry.id,
      industryName: industry.name,
      score,
      level: getLevel(score),
      breakdown,
      contentCount: count,
      sentimentDistribution: dist,
      snapshotAt: now,
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
  const now = new Date().toISOString();
  const items = getMatchedItems(industry, allItems);

  // 构建来源查找索引（T006 动态权重）
  const sourceConfigMap = sourceConfigs ? buildSourceConfigMap(sourceConfigs) : undefined;
  const sourceTypeCredibility = sourceConfigs ? buildSourceTypeCredibility(sourceConfigs) : undefined;

  // T007：建立事件簇索引，用于声量去重
  const allClusters = new Map(getAllClusters().map((c) => [c.id, c]));

  // 需要全局信息以归一化（单行业场景退化为自身归一化）
  const count = items.length;
  const clusterCount = countClusters(items, allClusters);
  const engagements = items.map((c) => {
    const m = c.metrics;
    return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.views ?? 0) * 0.1;
  });
  const maxEngagement = Math.max(...engagements, 1);
  const totalEngagement = engagements.reduce((s, e) => s + e, 0);

  const breakdown: TemperatureBreakdown = {
    sentimentScore: calcSentimentScore(items),
    // T007：声量使用事件簇数，单行业场景以自身归一化，保留中位值语义
    volumeAnomalyScore: clusterCount > 0 ? Math.min(100, Math.round((clusterCount / Math.max(count, 1)) * 100 + 20)) : 0,
    spreadIntensityScore: Math.round(Math.min(100, (totalEngagement / maxEngagement) * 100)),
    sourceCredibilityScore: calcSourceCredibilityScore(items, sourceConfigMap, sourceTypeCredibility),
  };

  const score = calcTemperature(breakdown);

  const sentimentDistribution = { positive: 0, neutral: 0, negative: 0 };
  const riskDistribution: RiskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const c of items) {
    sentimentDistribution[c.nlp.sentimentLabel]++;
    riskDistribution[c.nlp.riskLevel]++;
  }

  // 关键驱动内容：高风险优先，互动量次之，取前 topN 条
  const sortedItems = [...items].sort((a, b) => {
    const riskOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const riskDiff = (riskOrder[b.nlp.riskLevel] ?? 0) - (riskOrder[a.nlp.riskLevel] ?? 0);
    if (riskDiff !== 0) return riskDiff;
    const aEng = (a.metrics.likes ?? 0) + (a.metrics.comments ?? 0) + (a.metrics.shares ?? 0);
    const bEng = (b.metrics.likes ?? 0) + (b.metrics.comments ?? 0) + (b.metrics.shares ?? 0);
    return bEng - aEng;
  });

  const topContents: TopContentSummary[] = sortedItems.slice(0, topN).map((c) => ({
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
    id: `temp-${industry.id}-${granularity}`,
    industryId: industry.id,
    industryName: industry.name,
    score,
    level: getLevel(score),
    breakdown,
    contentCount: count,
    sentimentDistribution,
    snapshotAt: now,
    granularity,
    riskDistribution,
    topContents,
  } satisfies TemperatureDetail;
}
