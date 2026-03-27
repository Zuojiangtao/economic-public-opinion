import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 财联社爬虫
 * 数据源：财联社电报/快讯
 */
export class ClsCrawler extends BaseCrawler {
  constructor() {
    super('cls', '财联社', 'news', 'cn', { intervalMinutes: 5, pageSize: 40 });
  }

  private apis = [
    {
      name: 'telegraph',
      url: 'https://www.cls.cn/nodeapi/updateTelegraph',
      params: { app: 'CailianpressWeb', os: 'web', sv: '8.4.6', rn: 30 },
    },
    {
      name: 'roll',
      url: 'https://www.cls.cn/v1/roll/get_roll_list',
      params: { app: 'CailianpressWeb', os: 'web', sv: '8.4.6', category: '', id: '' },
    },
    {
      name: 'depth',
      url: 'https://www.cls.cn/v3/depth/home/assembled/1000',
      params: { app: 'CailianpressWeb', os: 'web' },
    },
  ];

  protected async doFetch(): Promise<ContentItem[]> {
    for (const api of this.apis) {
      try {
        const resp = await this.http.get(api.url, {
          params: { ...api.params, rn: this.config.pageSize },
          headers: { Referer: 'https://www.cls.cn/' },
        });

        const data = resp.data?.data?.roll_data || resp.data?.data?.list || resp.data?.data || [];
        const items = (Array.isArray(data) ? data : []);

        if (items.length === 0) continue;

        const mapped = items.map((item: any) => {
          const title = item.title || this.extractTitle(item.content || item.brief || '');
          const content = item.content || item.brief || item.title || '';

          return {
            id: this.generateId('cls'),
            title,
            content: this.stripHtml(content),
            sourceType: 'news' as const,
            sourceName: '财联社',
            author: item.source || '财联社',
            url: item.shareurl || `https://www.cls.cn/detail/${item.id}`,
            publishedAt: this.parseTimestamp(item.ctime || item.mtime),
            fetchedAt: '',
            market: 'cn',
            metrics: {},
            matches: [],
            nlp: { sentiment: 0, sentimentLabel: 'neutral' as const, riskLevel: 'low' as const, summary: '', entities: [] },
            dedup: { clusterId: '', similarCount: 0 },
          } as ContentItem;
        });

        console.log(`[cls] API ${api.name}: fetched ${mapped.length} items`);
        return mapped;
      } catch (err) {
        console.warn(`[cls] API ${api.name} failed: ${(err as Error).message}, trying next...`);
      }
    }

    console.error('[cls] All APIs failed');
    return [];
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private extractTitle(text: string): string {
    const clean = this.stripHtml(text);
    const firstSentence = clean.split(/[。！？\n]/)[0];
    return firstSentence.length > 80 ? firstSentence.substring(0, 80) + '...' : firstSentence;
  }

  private parseTimestamp(ts: number | string): string {
    if (!ts) return new Date().toISOString();
    const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
}
