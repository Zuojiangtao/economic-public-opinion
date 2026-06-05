import fs from 'fs';
import path from 'path';
import type {
  ContentItem,
  SourceType,
  SentimentLabel,
  RiskLevel,
  MarketType,
} from '../types.js';
import { DATA_DIR } from '../config.js';

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

export class JsonStorage {
  private items: Map<string, ContentItem> = new Map();
  private dataFile: string;
  private dirty = false;
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const dataDir = DATA_DIR;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dataFile = path.join(dataDir, 'contents.json');
    this.load();

    this.saveTimer = setInterval(() => {
      if (this.dirty) this.save();
    }, 30000);
  }

  private load() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        const arr: ContentItem[] = JSON.parse(raw);
        for (const item of arr) {
          this.items.set(item.id, item);
        }
        console.log(`[Storage] Loaded ${this.items.size} items from disk`);
      }
    } catch (err) {
      console.error('[Storage] Failed to load data:', err);
    }
  }

  save() {
    try {
      const arr = Array.from(this.items.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(arr, null, 2), 'utf-8');
      this.dirty = false;
      console.log(`[Storage] Saved ${arr.length} items to disk`);
    } catch (err) {
      console.error('[Storage] Failed to save data:', err);
    }
  }

  addItems(items: ContentItem[]): number {
    let added = 0;
    for (const item of items) {
      if (!this.items.has(item.id)) {
        const existing = this.findByUrl(item.url);
        if (!existing) {
          this.items.set(item.id, item);
          added++;
        }
      }
    }
    if (added > 0) this.dirty = true;
    return added;
  }

  private findByUrl(url: string): ContentItem | undefined {
    if (!url) return undefined;
    for (const item of this.items.values()) {
      if (item.url === url) return item;
    }
    return undefined;
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

  getById(id: string): ContentItem | undefined {
    return this.items.get(id);
  }

  search(params: SearchParams): PaginatedResult {
    let results = Array.from(this.items.values());

    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      results = results.filter(
        (c) =>
          c.title.toLowerCase().includes(kw) ||
          c.content.toLowerCase().includes(kw),
      );
    }
    if (params.sourceType) {
      results = results.filter((c) => c.sourceType === params.sourceType);
    }
    if (params.sentiment) {
      results = results.filter((c) => c.nlp.sentimentLabel === params.sentiment);
    }
    if (params.riskLevel) {
      results = results.filter((c) => c.nlp.riskLevel === params.riskLevel);
    }
    if (params.market) {
      results = results.filter((c) => c.market === params.market);
    }
    if (params.startDate) {
      results = results.filter((c) => c.publishedAt >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter((c) => c.publishedAt <= params.endDate! + 'T23:59:59Z');
    }
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

    return {
      items: results.slice(start, start + pageSize),
      total: results.length,
      page,
      pageSize,
    };
  }

  getStats(): StatsResult {
    const all = Array.from(this.items.values());

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
      sourceDistribution: Array.from(sourceMap.entries()).map(([sourceType, count]) => ({
        sourceType,
        count,
      })),
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
    return Array.from(this.items.values());
  }

  getSize(): number {
    return this.items.size;
  }

  destroy() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    if (this.dirty) this.save();
  }
}
