import * as cheerio from 'cheerio';
import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 同花顺爬虫
 * 数据源：同花顺财经要闻
 */
export class ThsCrawler extends BaseCrawler {
  constructor() {
    super('ths', '同花顺', 'news', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    try {
      const resp = await this.http.get(
        'https://news.10jqka.com.cn/tapp/news/push/stock/',
        {
          params: {
            page: 1,
            tag: '',
            track: 'website',
            pagesize: this.config.pageSize,
          },
          headers: {
            Referer: 'https://news.10jqka.com.cn/',
          },
        },
      );

      let data: any[];
      if (resp.data?.data?.list) {
        data = resp.data.data.list;
      } else if (Array.isArray(resp.data?.data)) {
        data = resp.data.data;
      } else {
        data = await this.fallbackHtmlParse();
      }

      for (const item of data) {
        allItems.push({
          id: this.generateId('ths'),
          title: item.title || '',
          content: item.digest || item.content || item.title || '',
          sourceType: 'news',
          sourceName: item.source || '同花顺',
          author: item.source || '同花顺',
          url: item.url || `https://news.10jqka.com.cn/`,
          publishedAt: this.parseTime(item.ctime || item.rtime || ''),
          fetchedAt: '',
          market: 'cn',
          metrics: {
            comments: item.comment_count || 0,
            views: item.click_count || 0,
          },
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      }

      console.log(`[ths] Fetched ${allItems.length} items`);
    } catch (err) {
      console.error('[ths] Fetch failed:', (err as Error).message);
      throw err;
    }

    return allItems;
  }

  private async fallbackHtmlParse(): Promise<any[]> {
    const resp = await this.http.get('https://news.10jqka.com.cn/', {
      responseType: 'text',
    });

    const $ = cheerio.load(resp.data);
    const items: any[] = [];

    $('ul.list-con li, .news-list li').each((_i, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const title = link.text().trim();
      const href = link.attr('href') || '';
      const time = $el.find('.arc-time, time, .time').text().trim();

      if (title && title.length > 4) {
        items.push({
          title,
          content: title,
          url: href.startsWith('http') ? href : `https://news.10jqka.com.cn${href}`,
          ctime: time,
          source: '同花顺',
        });
      }
    });

    return items;
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return new Date().toISOString();
    try {
      if (/^\d+$/.test(timeStr)) {
        return new Date(parseInt(timeStr) * 1000).toISOString();
      }
      const d = new Date(timeStr.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
