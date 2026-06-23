import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { CRAWL_DELAY_MS } from '../config.js';

/**
 * 新浪财经爬虫
 * 数据源：新浪财经滚动新闻 API
 */
export class SinaFinanceCrawler extends BaseCrawler {
  constructor() {
    super('sina_finance', '新浪财经', 'news', 'cn', { intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      if (page > 1) await this.delay(CRAWL_DELAY_MS);

      try {
        const resp = await this.http.get('https://feed.mix.sina.com.cn/api/roll/get', {
          params: {
            pageid: '153',
            lid: '2516',
            k: '',
            num: this.config.pageSize,
            page,
          },
          headers: {
            Referer: 'https://finance.sina.com.cn/',
          },
        });

        const data = resp.data?.result?.data;
        if (!Array.isArray(data) || data.length === 0) break;

        for (const item of data) {
          allItems.push({
            id: this.generateId('sina'),
            title: item.title || '',
            content: this.stripHtml(item.intro || item.summary || item.title || ''),
            sourceType: 'news',
            sourceName: item.media_name || '新浪财经',
            author: item.author || item.media_name || '新浪财经',
            url: item.url || '',
            publishedAt: this.parseTimestamp(item.ctime || item.intime),
            fetchedAt: '',
            market: 'cn',
            metrics: {
              comments: item.comment_count || 0,
            },
            matches: [],
            nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
            dedup: { clusterId: '', similarCount: 0 },
          } as ContentItem);
        }

        console.log(`[sina_finance] Page ${page}: fetched ${data.length} items`);
      } catch (err) {
        console.error(`[sina_finance] Page ${page} failed:`, (err as Error).message);
        break;
      }
    }

    return allItems;
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private parseTimestamp(ts: number | string): string {
    if (!ts) return '';
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
}
