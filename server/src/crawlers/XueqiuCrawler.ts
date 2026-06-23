import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 雪球爬虫
 * 数据源：雪球热门话题/帖子
 * 注意：需要先访问主页获取 cookie
 */
export class XueqiuCrawler extends BaseCrawler {
  private cookie = '';

  constructor() {
    super('xueqiu', '雪球', 'social', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    await this.initCookie();

    const allItems: ContentItem[] = [];

    try {
      const resp = await this.http.get('https://xueqiu.com/statuses/hot/listV2.json', {
        params: {
          since_id: -1,
          max_id: -1,
          size: this.config.pageSize,
        },
        headers: {
          Cookie: this.cookie,
          Referer: 'https://xueqiu.com/',
          Origin: 'https://xueqiu.com',
        },
      });

      const items = resp.data?.items || resp.data?.list || [];

      for (const item of items) {
        const original = item.original_status || item;
        const text = original.text || original.description || '';
        const title = original.title || this.extractTitle(text);
        const username = original.user?.screen_name || '雪球用户';

        allItems.push({
          id: this.generateId('xq'),
          title,
          content: this.stripHtml(text),
          sourceType: 'social',
          sourceName: '雪球',
          author: username,
          url: `https://xueqiu.com${original.target || `/statuses/${original.id}`}`,
          publishedAt: this.parseTimestamp(original.created_at),
          fetchedAt: '',
          market: 'cn',
          metrics: {
            likes: original.like_count || 0,
            comments: original.reply_count || 0,
            shares: original.retweet_count || 0,
          },
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      }

      console.log(`[xueqiu] Fetched ${allItems.length} hot items`);
    } catch (err) {
      console.error('[xueqiu] Fetch failed:', (err as Error).message);
      throw err;
    }

    return allItems;
  }

  private async initCookie() {
    if (this.cookie) return;
    try {
      const resp = await this.http.get('https://xueqiu.com/', {
        maxRedirects: 5,
      });
      const setCookies = resp.headers['set-cookie'];
      if (setCookies) {
        this.cookie = setCookies.map((c: string) => c.split(';')[0]).join('; ');
      }
    } catch {
      console.warn('[xueqiu] Failed to get initial cookie');
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim().substring(0, 2000);
  }

  private extractTitle(text: string): string {
    const clean = this.stripHtml(text);
    return clean.length > 60 ? clean.substring(0, 60) + '...' : clean;
  }

  private parseTimestamp(ts: number | string): string {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
}
