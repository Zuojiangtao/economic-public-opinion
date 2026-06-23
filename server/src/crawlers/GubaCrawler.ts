import * as cheerio from 'cheerio';
import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';
import { decodeHtmlBuffer } from './encodingUtils.js';

/**
 * 东方财富股吧爬虫
 * 数据源：股吧热门帖子
 * 注意：该站可能使用 GBK 编码，需通过 decodeHtmlBuffer 转码
 */
export class GubaCrawler extends BaseCrawler {
  private boards = [
    { code: '1', name: '沪深两市' },
    { code: '300059', name: '东方财富股吧' },
  ];

  constructor() {
    super('guba', '股吧', 'forums', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    for (const board of this.boards) {
      try {
        await this.delay(CRAWL_DELAY_MS);

        const url = `https://guba.eastmoney.com/list,${board.code}.html`;
        const resp = await this.http.get(url, {
          headers: {
            Referer: 'https://guba.eastmoney.com/',
          },
          responseType: 'arraybuffer',
        });

        const html = decodeHtmlBuffer(resp.data);
        const $ = cheerio.load(html);
        const posts = $('.listitem, .articleh');

        posts.each((_i, el) => {
          const $el = $(el);
          const titleEl = $el.find('.l3 a, .l3 .title a').first();
          const title = titleEl.text().trim();
          const href = titleEl.attr('href') || '';

          if (!title || title.includes('公告') || title.length < 4) return;

          const readCount = parseInt($el.find('.l1, .read').text().replace(/\D/g, '')) || 0;
          const commentCount = parseInt($el.find('.l2, .reply').text().replace(/\D/g, '')) || 0;
          const author = $el.find('.l4 a, .author a').text().trim() || '股吧用户';
          const timeText = $el.find('.l5, .update').text().trim();

          const fullUrl = href.startsWith('http')
            ? href
            : `https://guba.eastmoney.com${href}`;

          allItems.push({
            id: this.generateId('guba'),
            title,
            content: title,
            sourceType: 'forums',
            sourceName: `股吧-${board.name}`,
            author,
            url: fullUrl,
            publishedAt: this.parseGubaTime(timeText),
            fetchedAt: '',
            market: 'cn',
            metrics: {
              views: readCount,
              comments: commentCount,
            },
            matches: [],
            nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
            dedup: { clusterId: '', similarCount: 0 },
          } as ContentItem);
        });

        console.log(`[guba] Board ${board.name}: fetched ${posts.length} items`);
      } catch (err) {
        console.error(`[guba] Board ${board.name} failed:`, (err as Error).message);
      }
    }

    return allItems;
  }

  private parseGubaTime(timeStr: string): string {
    if (!timeStr) return '';
    const now = new Date();

    const mmdd = timeStr.match(/^(\d{1,2})-(\d{1,2})\s*(\d{2}):(\d{2})$/);
    if (mmdd) {
      const d = new Date(now.getFullYear(), parseInt(mmdd[1]) - 1, parseInt(mmdd[2]), parseInt(mmdd[3]), parseInt(mmdd[4]));
      return isNaN(d.getTime()) ? '' : d.toISOString();
    }

    const hhmm = timeStr.match(/^(\d{2}):(\d{2})$/);
    if (hhmm) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hhmm[1]), parseInt(hhmm[2]));
      return isNaN(d.getTime()) ? '' : d.toISOString();
    }

    return '';
  }
}
