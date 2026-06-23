import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';

interface BrokerProfile {
  displayName: string;
  aliases: string[];
}

const TARGET_BROKERS: BrokerProfile[] = [
  { displayName: '中信证券', aliases: ['中信证券', '中信证券股份有限公司'] },
  { displayName: '广发证券', aliases: ['广发证券', '广发证券股份有限公司'] },
  {
    displayName: '中金公司',
    aliases: ['中金公司', '中国国际金融', '中国国际金融股份有限公司', '中金财富'],
  },
  { displayName: '中信建投', aliases: ['中信建投', '中信建投证券', '中信建投证券股份有限公司'] },
  { displayName: '招商证券', aliases: ['招商证券', '招商证券股份有限公司'] },
  { displayName: '国信证券', aliases: ['国信证券', '国信证券股份有限公司'] },
  { displayName: '华泰证券', aliases: ['华泰证券', '华泰证券股份有限公司'] },
  { displayName: '申万宏源', aliases: ['申万宏源', '申万宏源证券', '申万宏源证券有限公司'] },
  { displayName: '中国银河', aliases: ['中国银河', '银河证券', '中国银河证券', '中国银河证券股份有限公司'] },
];

/**
 * 券商研报爬虫
 * 数据源：东方财富研报接口（按目标券商过滤）
 */
export class BrokerResearchCrawler extends BaseCrawler {
  constructor() {
    super('broker_research', '券商机构研报', 'broker', 'cn', { intervalMinutes: 20, pageSize: 50, maxPages: 6 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const items: ContentItem[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      if (page > 1) await this.delay(CRAWL_DELAY_MS);

      try {
        const resp = await this.http.get('https://reportapi.eastmoney.com/report/list', {
          params: {
            pageNo: page,
            pageSize: this.config.pageSize,
            industryCode: '*',
            orgCode: '',
            rating: '',
            ratingChange: '',
            beginTime: '',
            endTime: '',
            fields: '',
            qType: 0,
          },
          headers: {
            Referer: 'https://data.eastmoney.com/report/',
          },
          // 接口已支持纯 JSON；不再使用 JSONP 的 cb，否则易返回 "Wrong callback Function"
          responseType: 'json',
        });

        const payload = this.normalizeListResponse(resp.data);
        const data = payload?.data;
        if (!Array.isArray(data) || data.length === 0) break;

        const mapped = data
          .filter((row) => this.matchBroker(String(row.orgSName || row.orgName || '').trim()) !== undefined)
          .map((row) => this.mapItem(row));

        items.push(...mapped);
        console.log(`[broker_research] Page ${page}: fetched ${mapped.length} items`);
      } catch (err) {
        console.warn(`[broker_research] Page ${page} failed: ${(err as Error).message}`);
        if (page === 1) return [];
        break;
      }
    }

    return items;
  }

  private normalizeListResponse(raw: unknown): { data?: Record<string, unknown>[] } {
    if (raw && typeof raw === 'object' && 'data' in (raw as object)) {
      return raw as { data?: Record<string, unknown>[] };
    }
    return this.parsePayload(String(raw ?? ''));
  }

  private parsePayload(raw: string): { data?: Record<string, unknown>[] } {
    const jsonText = this.extractJson(raw);
    if (!jsonText) return {};

    try {
      const parsed = JSON.parse(jsonText) as { data?: Record<string, unknown>[] };
      return parsed;
    } catch {
      return {};
    }
  }

  private extractJson(raw: string): string {
    const jsonMatch = raw.match(/\((\{[\s\S]*\})\)\s*;?\s*$/);
    if (jsonMatch?.[1]) return jsonMatch[1];

    const objectMatch = raw.match(/\{[\s\S]*\}/);
    return objectMatch?.[0] || '';
  }

  private mapItem(item: Record<string, unknown>): ContentItem {
    const orgRaw = String(item.orgSName || item.orgName || '券商机构').trim();
    const matchedBroker = this.matchBroker(orgRaw);
    const org = matchedBroker?.displayName || orgRaw;
    const title = String(item.title || item.reportTitle || item.stockName || '券商研报').trim();
    const ratingLine = String(item.emRatingName || item.sRatingName || item.ratingName || '').trim();
    const summary = String(item.summary || item.digest || ratingLine || title).trim();
    const infoCode = String(item.infoCode || '').trim();
    const url = infoCode
      ? `https://data.eastmoney.com/report/info/${infoCode}.html`
      : String(item.pdfUrl || item.url || 'https://data.eastmoney.com/report/').trim();

    return {
      id: this.generateId('br'),
      title,
      content: summary,
      sourceType: 'broker',
      sourceName: `${org}研报`,
      author: org,
      url,
      publishedAt: this.parseDate(item.publishDate || item.publishTime || item.date),
      fetchedAt: '',
      market: 'cn',
      metrics: {},
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    } as ContentItem;
  }

  private parseDate(input: unknown): string {
    if (!input) return '';
    const d = new Date(String(input).replace(/-/g, '/'));
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  private matchBroker(org: string): BrokerProfile | undefined {
    const orgNormalized = this.normalizeText(org);
    if (!orgNormalized) return undefined;

    return TARGET_BROKERS.find((broker) =>
      broker.aliases.some((alias) => {
        const aliasNormalized = this.normalizeText(alias);
        return orgNormalized.includes(aliasNormalized) || aliasNormalized.includes(orgNormalized);
      }),
    );
  }

  private normalizeText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, '')
      .replace(/[（(].*?[)）]/g, '')
      .replace(/有限责任公司|股份有限公司|有限公司/g, '');
  }
}
