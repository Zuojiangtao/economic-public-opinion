import * as cheerio from 'cheerio';
import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { decodeHtmlBuffer } from './encodingUtils.js';

const LIST_URL = 'https://www.cs.com.cn/xwzx/';
const BASE_RESOLVE = 'https://www.cs.com.cn/xwzx/';

/**
 * 专业金融机构媒体爬虫
 * 数据源：中证网（中国证券报）要闻频道 — 证券监管、资本市场、宏观政策等权威资讯
 * 注意：该站可能使用 GB2312 编码，需通过 decodeHtmlBuffer 转码
 */
export class ChinaSecuritiesJournalCrawler extends BaseCrawler {
  constructor() {
    super('cs_journal', '中证网（中国证券报）', 'broker', 'cn', { intervalMinutes: 12 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const resp = await this.http.get(LIST_URL, {
      responseType: 'arraybuffer',
      headers: {
        Referer: 'https://www.cs.com.cn/',
      },
    });

    const html = decodeHtmlBuffer(resp.data);
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const raw: { url: string; title: string; content: string; publishedAt: string }[] = [];

    const resolveUrl = (href: string) => {
      try {
        return new URL(href, BASE_RESOLVE).href;
      } catch {
        return href;
      }
    };

    $('#slideBox .bd ul li > a').each((_i, el) => {
      const $a = $(el);
      const href = $a.attr('href')?.trim();
      const title = $a.find('h3').first().text().trim();
      const content = $a.find('section span').first().text().replace(/\s+/g, ' ').trim();
      if (!href || !title) return;
      const url = resolveUrl(href);
      if (seen.has(url)) return;
      seen.add(url);
      raw.push({
        url,
        title,
        content: content || title,
        publishedAt: '',
      });
    });

    $('ul.ch_type3_list li > a').each((_i, el) => {
      const $a = $(el);
      const href = $a.attr('href')?.trim();
      const title = $a.find('h3').first().text().trim();
      const timeText = $a.find('em').first().text().trim();
      if (!href || !title) return;
      const url = resolveUrl(href);
      if (seen.has(url)) return;
      seen.add(url);
      raw.push({
        url,
        title,
        content: title,
        publishedAt: this.parseCnDateTime(timeText),
      });
    });

    const limit = this.config.pageSize * this.config.maxPages;
    const sliced = raw.slice(0, limit);

    console.log(`[cs_journal] Fetched ${sliced.length} items`);

    return sliced.map((r) => ({
      id: this.generateId('csj'),
      title: r.title,
      content: r.content,
      sourceType: 'broker',
      sourceName: this.sourceName,
      author: '中国证券报',
      url: r.url,
      publishedAt: r.publishedAt,
      fetchedAt: '',
      market: 'cn',
      metrics: {},
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    } as ContentItem));
  }

  private parseCnDateTime(text: string): string {
    if (!text) return '';
    const m = text.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (m) {
      const d = new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10),
      );
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return '';
  }
}
