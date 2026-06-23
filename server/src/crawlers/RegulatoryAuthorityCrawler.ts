import * as cheerio from 'cheerio';
import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';
import { decodeHtmlBuffer } from './encodingUtils.js';

interface AuthoritySource {
  name: string;
  listUrl: string;
  referer: string;
}

const AUTHORITY_SOURCES: AuthoritySource[] = [
  {
    name: '上海证券交易所',
    listUrl: 'https://www.sse.com.cn/aboutus/mediacenter/hotandd/',
    referer: 'https://www.sse.com.cn/',
  },
  {
    name: '深圳证券交易所（市场动态）',
    listUrl: 'https://www.szse.cn/aboutus/trends/news/',
    referer: 'https://www.szse.cn/',
  },
  {
    name: '深圳证券交易所（规则与指南）',
    listUrl: 'https://www.szse.cn/lawrules/index.html',
    referer: 'https://www.szse.cn/',
  },
  {
    name: '中国证监会',
    listUrl: 'https://www.csrc.gov.cn/csrc/c100027/common_list.shtml',
    referer: 'https://www.csrc.gov.cn/',
  },
];

/**
 * 权威监管机构资讯爬虫
 * 数据源：上交所 / 深交所 / 中国证监会 公告与新闻栏目
 */
export class RegulatoryAuthorityCrawler extends BaseCrawler {
  constructor() {
    super('authority_cn', '权威监管机构', 'news', 'cn', { intervalMinutes: 20, pageSize: 40, maxPages: 1 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];
    const seen = new Set<string>();

    for (const source of AUTHORITY_SOURCES) {
      try {
        await this.delay(CRAWL_DELAY_MS);
        const resp = await this.http.get(source.listUrl, {
          responseType: 'arraybuffer',
          headers: { Referer: source.referer },
        });

        const html = decodeHtmlBuffer(resp.data);
        const items = this.parseListPage(html, source);
        for (const item of items) {
          if (seen.has(item.url)) continue;
          seen.add(item.url);
          allItems.push(item);
        }

        console.log(`[authority_cn] ${source.name}: fetched ${items.length} items`);
      } catch (err) {
        console.warn(`[authority_cn] ${source.name} failed: ${(err as Error).message}`);
      }
    }

    return allItems.slice(0, this.config.pageSize * this.config.maxPages);
  }

  private parseListPage(html: string, source: AuthoritySource): ContentItem[] {
    const $ = cheerio.load(html);
    const items: ContentItem[] = [];

    $('a').each((_i, el) => {
      const $a = $(el);
      const title = $a.text().replace(/\s+/g, ' ').trim();
      const href = ($a.attr('href') || '').trim();
      if (!title || title.length < 8 || !href || href.startsWith('javascript:')) return;

      const url = this.resolveUrl(href, source.listUrl);
      if (!url.startsWith('http')) return;

      const context = $a.closest('li, tr, div, p').text().replace(/\s+/g, ' ').trim();
      const publishedAt = this.extractDate(context);

      items.push({
        id: this.generateId('auth'),
        title,
        content: context || title,
        sourceType: 'news',
        sourceName: source.name,
        author: source.name,
        url,
        publishedAt,
        fetchedAt: '',
        market: 'cn',
        metrics: {},
        matches: [],
        nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
        dedup: { clusterId: '', similarCount: 0 },
      } as ContentItem);
    });

    return items.slice(0, this.config.pageSize);
  }

  private resolveUrl(href: string, base: string): string {
    try {
      return new URL(href, base).href;
    } catch {
      return href;
    }
  }

  private extractDate(text: string): string {
    const m = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
    if (!m) return '';

    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    const hour = parseInt(m[4] || '0', 10);
    const minute = parseInt(m[5] || '0', 10);
    const date = new Date(year, month, day, hour, minute);

    return isNaN(date.getTime()) ? '' : date.toISOString();
  }
}
