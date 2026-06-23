import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';
import { decodeHtmlBuffer } from './encodingUtils.js';

/**
 * 东方财富快讯/新闻爬虫
 * 数据源：东方财富财经新闻 API
 * 注意：fallback URL 可能使用 GBK 编码，需通过 decodeHtmlBuffer 转码
 */
export class EastMoneyCrawler extends BaseCrawler {
  constructor() {
    super('eastmoney', '东方财富', 'news', 'cn', { intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      if (page > 1) await this.delay(CRAWL_DELAY_MS);

      try {
        // 尝试主 API
        const resp = await this.http.get('https://np-listapi.eastmoney.com/comm/web/getNewsByColumns', {
          params: {
            client: 'web',
            biz: 'web_news_col',
            column: '102',
            order: '1',
            needInteractData: '0',
            page_index: page,
            page_size: this.config.pageSize,
          },
          headers: { Referer: 'https://www.eastmoney.com/' },
        });

        let data = resp.data?.data?.list;
        if (!data) data = resp.data?.data;
        if (!Array.isArray(data) || data.length === 0) {
          if (page === 1) {
            console.log('[eastmoney] Primary API returned empty, trying fallback...');
            return await this.fetchFallback();
          }
          break;
        }

        for (const item of data) {
          allItems.push(this.mapItem(item));
        }

        console.log(`[eastmoney] Page ${page}: fetched ${data.length} items`);
      } catch (err) {
        console.error(`[eastmoney] Page ${page} failed:`, (err as Error).message);
        if (page === 1) return await this.fetchFallback();
        break;
      }
    }

    return allItems;
  }

  private async fetchFallback(): Promise<ContentItem[]> {
    try {
      const resp = await this.http.get('https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_50_1_.html', {
        headers: { Referer: 'https://www.eastmoney.com/' },
        responseType: 'arraybuffer',
      });

      let text = decodeHtmlBuffer(resp.data);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const json = JSON.parse(jsonMatch[0]);

      const data = json.LivesList || json.data || [];
      const items = (Array.isArray(data) ? data : []).map((item: any) => this.mapItem(item));
      console.log(`[eastmoney] Fallback: fetched ${items.length} items`);
      return items;
    } catch (err) {
      console.error('[eastmoney] Fallback also failed:', (err as Error).message);
      return [];
    }
  }

  private mapItem(item: any): ContentItem {
    return {
      id: this.generateId('em'),
      title: item.title || item.Title || '',
      content: this.stripHtml(item.digest || item.content || item.Content || item.title || item.Title || ''),
      sourceType: 'news',
      sourceName: '东方财富',
      author: item.source || item.mediaName || '东方财富',
      url: item.url || item.Url || item.url_unique || `https://finance.eastmoney.com/`,
      publishedAt: this.parseTime(item.showtime || item.display_time || item.ShowTime || ''),
      fetchedAt: '',
      market: 'cn',
      metrics: { comments: item.comment_count || 0 },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }
}
