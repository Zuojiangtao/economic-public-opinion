/**
 * T008 内容存储 — SQLite 实现
 *
 * 保持与原 JsonStorage 完全相同的公共 API，方便无缝替换。
 * 内容的复杂 JSON 字段（metrics / matches / nlp / dedup）以 JSON 文本存储。
 */
import type {
  ContentItem,
  SourceType,
  SentimentLabel,
  RiskLevel,
  MarketType,
} from '../types.js';
import { getDb } from './db.js';
import { clusterItems } from '../dedup/dedupService.js';
import { replaceAll, upsertClusters } from '../dedup/eventClusterStore.js';

interface PaginatedResult {
  items: ContentItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 当内容未写入 matches 时，按监测方案规则做检索过滤 */
export interface MonitoringProjectSearchRules {
  sourceTypes: SourceType[];
  include: string[];
  exclude: string[];
}

interface SearchParams {
  keyword?: string;
  sourceType?: SourceType;
  sentiment?: SentimentLabel;
  riskLevel?: RiskLevel;
  market?: MarketType;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** 按监测方案筛选：优先 matches.projectId，否则用 monitoringProjectRules */
  monitoringProjectId?: string;
  monitoringProjectRules?: MonitoringProjectSearchRules;
}

interface StatsResult {
  totalCount: number;
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  sourceDistribution: { sourceType: string; count: number }[];
  trendData: { date: string; total: number; positive: number; neutral: number; negative: number }[];
  topKeywords: { keyword: string; count: number }[];
  topEntities: { name: string; type: string; count: number }[];
}

// ── Row ↔ ContentItem 转换 ──────────────────────────────────────────────────

interface ContentRow {
  id: string;
  title: string;
  content: string;
  source_type: string;
  source_name: string;
  author: string;
  url: string;
  published_at: string;
  fetched_at: string;
  market: string;
  metrics_json: string;
  matches_json: string;
  nlp_json: string;
  dedup_json: string;
}

function rowToItem(row: ContentRow): ContentItem {
  return {
    id:          row.id,
    title:       row.title,
    content:     row.content,
    sourceType:  row.source_type as SourceType,
    sourceName:  row.source_name,
    author:      row.author,
    url:         row.url,
    publishedAt: row.published_at,
    fetchedAt:   row.fetched_at,
    market:      row.market as MarketType,
    metrics:     JSON.parse(row.metrics_json),
    matches:     JSON.parse(row.matches_json),
    nlp:         JSON.parse(row.nlp_json),
    dedup:       JSON.parse(row.dedup_json),
  };
}

// ── Storage class ────────────────────────────────────────────────────────────

export class JsonStorage {
  constructor() {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM contents').get() as { c: number }).c;
    console.log(`[Storage] SQLite loaded ${count} items`);
    if (count > 0) this.runDedup();
  }

  /** 对全量内容重新聚类并更新事件簇缓存 */
  runDedup(): void {
    const all = this.getAll();
    const clusters = clusterItems(all);
    replaceAll(clusters);
    console.log(`[Dedup] Clustered ${all.length} items into ${clusters.length} event clusters`);
  }

  addItems(items: ContentItem[]): number {
    const db = getDb();
    const existingUrls = new Set<string>(
      (db.prepare("SELECT url FROM contents WHERE url != ''").all() as { url: string }[]).map((r) => r.url),
    );
    const existingIds = new Set<string>(
      (db.prepare('SELECT id FROM contents').all() as { id: string }[]).map((r) => r.id),
    );

    const stmt = db.prepare<ContentRow>(`
      INSERT OR IGNORE INTO contents
        (id, title, content, source_type, source_name, author, url,
         published_at, fetched_at, market, metrics_json, matches_json, nlp_json, dedup_json)
      VALUES
        (@id, @title, @content, @source_type, @source_name, @author, @url,
         @published_at, @fetched_at, @market, @metrics_json, @matches_json, @nlp_json, @dedup_json)
    `);

    const newItems: ContentItem[] = [];
    const insertMany = db.transaction((batch: ContentItem[]) => {
      let added = 0;
      for (const item of batch) {
        if (existingIds.has(item.id)) continue;
        if (item.url && existingUrls.has(item.url)) continue;
        stmt.run({
          id:           item.id,
          title:        item.title,
          content:      item.content ?? '',
          source_type:  item.sourceType,
          source_name:  item.sourceName,
          author:       item.author ?? '',
          url:          item.url ?? '',
          published_at: item.publishedAt,
          fetched_at:   item.fetchedAt,
          market:       item.market ?? 'cn',
          metrics_json: JSON.stringify(item.metrics ?? {}),
          matches_json: JSON.stringify(item.matches ?? []),
          nlp_json:     JSON.stringify(item.nlp ?? {}),
          dedup_json:   JSON.stringify(item.dedup ?? {}),
        });
        newItems.push(item);
        existingIds.add(item.id);
        if (item.url) existingUrls.add(item.url);
        added++;
      }
      return added;
    });

    const added = insertMany(items);
    if (added > 0) {
      const newClusters = clusterItems(newItems);
      upsertClusters(newClusters);
    }
    return added;
  }

  getById(id: string): ContentItem | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM contents WHERE id = ?').get(id) as ContentRow | undefined;
    return row ? rowToItem(row) : undefined;
  }

  /** T011: 更新已有条目（用于写回增强分析结果），ID 不存在时忽略 */
  upsert(item: ContentItem): void {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM contents WHERE id = ?').get(item.id);
    if (!existing) return;
    db.prepare(`
      UPDATE contents SET
        title        = @title,
        content      = @content,
        source_type  = @source_type,
        source_name  = @source_name,
        author       = @author,
        url          = @url,
        published_at = @published_at,
        fetched_at   = @fetched_at,
        market       = @market,
        metrics_json = @metrics_json,
        matches_json = @matches_json,
        nlp_json     = @nlp_json,
        dedup_json   = @dedup_json
      WHERE id = @id
    `).run({
      id:           item.id,
      title:        item.title,
      content:      item.content ?? '',
      source_type:  item.sourceType,
      source_name:  item.sourceName,
      author:       item.author ?? '',
      url:          item.url ?? '',
      published_at: item.publishedAt,
      fetched_at:   item.fetchedAt,
      market:       item.market ?? 'cn',
      metrics_json: JSON.stringify(item.metrics ?? {}),
      matches_json: JSON.stringify(item.matches ?? []),
      nlp_json:     JSON.stringify(item.nlp ?? {}),
      dedup_json:   JSON.stringify(item.dedup ?? {}),
    });
  }

  search(params: SearchParams): PaginatedResult {
    let results = this.getAll();

    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      results = results.filter(
        (c) => c.title.toLowerCase().includes(kw) || c.content.toLowerCase().includes(kw),
      );
    }
    if (params.sourceType) results = results.filter((c) => c.sourceType === params.sourceType);
    if (params.sentiment)  results = results.filter((c) => c.nlp.sentimentLabel === params.sentiment);
    if (params.riskLevel)  results = results.filter((c) => c.nlp.riskLevel === params.riskLevel);
    if (params.market)     results = results.filter((c) => c.market === params.market);
    if (params.startDate)  results = results.filter((c) => c.publishedAt >= params.startDate!);
    if (params.endDate)    results = results.filter((c) => c.publishedAt <= params.endDate! + 'T23:59:59Z');
    if (params.monitoringProjectId) {
      const pid = params.monitoringProjectId;
      const rules = params.monitoringProjectRules;
      results = results.filter((c) => this.itemMatchesMonitoringProject(c, pid, rules));
    }

    const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    const sortBy = params.sortBy || 'publishedAt';
    const sortOrder = params.sortOrder || 'desc';
    results.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'publishedAt') {
        cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      } else if (sortBy === 'sentiment') {
        cmp = a.nlp.sentiment - b.nlp.sentiment;
      } else if (sortBy === 'riskLevel') {
        cmp = riskOrder[a.nlp.riskLevel] - riskOrder[b.nlp.riskLevel];
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    const start = (page - 1) * pageSize;
    return { items: results.slice(start, start + pageSize), total: results.length, page, pageSize };
  }

  getStats(): StatsResult {
    const all = this.getAll();

    const sentimentDist = { positive: 0, neutral: 0, negative: 0 };
    const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
    const sourceMap = new Map<string, number>();
    const dateMap = new Map<string, { total: number; positive: number; neutral: number; negative: number }>();
    const entityMap = new Map<string, { type: string; count: number }>();

    for (const item of all) {
      sentimentDist[item.nlp.sentimentLabel]++;
      riskDist[item.nlp.riskLevel]++;
      sourceMap.set(item.sourceType, (sourceMap.get(item.sourceType) || 0) + 1);

      const d = item.publishedAt.substring(0, 10);
      if (!dateMap.has(d)) dateMap.set(d, { total: 0, positive: 0, neutral: 0, negative: 0 });
      const entry = dateMap.get(d)!;
      entry.total++;
      entry[item.nlp.sentimentLabel]++;

      for (const e of item.nlp.entities) {
        const existing = entityMap.get(e.name);
        entityMap.set(e.name, { type: e.type, count: (existing?.count || 0) + 1 });
      }
    }

    return {
      totalCount: all.length,
      sentimentDistribution: sentimentDist,
      riskDistribution: riskDist,
      sourceDistribution: Array.from(sourceMap.entries()).map(([sourceType, count]) => ({ sourceType, count })),
      trendData: Array.from(dateMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topKeywords: [],
      topEntities: Array.from(entityMap.entries())
        .map(([name, v]) => ({ name, type: v.type, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20),
    };
  }

  getAll(): ContentItem[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM contents').all() as ContentRow[];
    return rows.map(rowToItem);
  }

  /** 仅返回所有内容 ID（轻量查询，用于 LLM 前去重）*/
  getAllIds(): Set<string> {
    const db = getDb();
    const rows = db.prepare("SELECT id FROM contents").all() as { id: string }[];
    return new Set(rows.map(r => r.id));
  }

  getSize(): number {
    const db = getDb();
    return (db.prepare('SELECT COUNT(*) as c FROM contents').get() as { c: number }).c;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  destroy(): void {
    // SQLite connection is shared; no timer to clear
  }

  private itemMatchesMonitoringProject(
    item: ContentItem,
    projectId: string,
    rules?: MonitoringProjectSearchRules,
  ): boolean {
    if (item.matches?.some((m) => m.projectId === projectId)) return true;
    if (!rules) return false;
    if (!rules.sourceTypes.includes(item.sourceType)) return false;
    const text = `${item.title} ${item.content}`.toLowerCase();
    for (const ex of rules.exclude) {
      if (ex && text.includes(ex.toLowerCase())) return false;
    }
    if (rules.include.length === 0) return true;
    return rules.include.some((inc) => inc && text.includes(inc.toLowerCase()));
  }
}
