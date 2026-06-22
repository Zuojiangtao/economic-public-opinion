import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';

/**
 * 第一财经爬虫（替代原财联社 cls）
 * 数据源：第一财经公开 API
 * API: https://www.yicai.com/api/ajax/getlatest
 */
export class ClsCrawler extends BaseCrawler {
  constructor() {
    super('cls', '第一财经', 'news', 'cn', { intervalMinutes: 10, pageSize: 30 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      if (page > 1) await this.delay(CRAWL_DELAY_MS);

      try {
        const resp = await this.http.get('https://www.yicai.com/api/ajax/getlatest', {
          params: {
            page,
            pagesize: this.config.pageSize,
          },
          headers: {
            Referer: 'https://www.yicai.com/',
          },
        });

        const data = resp.data;
        if (!Array.isArray(data) || data.length === 0) break;

        for (const item of data) {
          allItems.push(this.mapItem(item));
        }

        console.log(`[cls/yicai] Page ${page}: fetched ${data.length} items`);
      } catch (err) {
        console.error(`[cls/yicai] Page ${page} failed:`, (err as Error).message);
        break;
      }
    }

    return allItems;
  }

  private mapItem(item: any): ContentItem {
    const newsId = item.NewsID || '';
    const title = item.NewsTitle || '';
    const content = item.NewsContent || item.NewsSummary || title;

    return {
      id: this.generateId('cls'),
      title: this.stripHtml(title),
      content: this.stripHtml(content).slice(0, 500),
      sourceType: 'news',
      sourceName: '第一财经',
      author: item.NewsAuthor || item.CreaterName || '第一财经',
      url: newsId ? `https://www.yicai.com/news/${newsId}` : 'https://www.yicai.com/',
      publishedAt: this.parseTime(item.CreateDate || ''),
      fetchedAt: '',
      market: 'cn',
      metrics: {
        comments: item.CommentCount || 0,
      },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    } as ContentItem;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return new Date().toISOString();
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
