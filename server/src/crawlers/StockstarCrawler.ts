import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import * as cheerio from 'cheerio';

/**
 * 证券之星爬虫
 * 数据源：证券之星财经新闻 https://finance.stockstar.com/
 * 采用 HTML 解析（API 已下线）
 */
export class StockstarCrawler extends BaseCrawler {
  constructor() {
    super('stockstar', '证券之星', 'news', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    try {
      const resp = await this.http.get('https://finance.stockstar.com/', {
        responseType: 'text',
      });

      const $ = cheerio.load(resp.data);

      // 主选择器：新闻链接
      $('a[href*="IG20"]').each((_, elem) => {
        const $elem = $(elem);
        const title = $elem.text().trim();
        const url = $elem.attr('href') || '';

        // 过滤：标题至少 8 个字，排除导航类链接
        if (title.length < 8 || title.includes('更多') || title.includes('首页')) return;
        // 排除重复的短描述（和标题链接指向同一 URL 的摘要文本）
        if (allItems.some(item => item.url === url)) return;

        allItems.push({
          id: this.generateId('stockstar'),
          title,
          content: title,
          sourceType: 'news',
          sourceName: '证券之星',
          author: '证券之星',
          url: url.startsWith('http') ? url : `https://finance.stockstar.com/${url}`,
          publishedAt: this.parseTimeFromUrl(url),
          fetchedAt: '',
          market: 'cn',
          metrics: {},
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      });

      console.log(`[stockstar] HTML: fetched ${allItems.length} items`);
    } catch (err) {
      console.error('[stockstar] Fetch failed:', (err as Error).message);
    }

    return allItems.slice(0, this.config.pageSize);
  }

  /**
   * 从 URL 中的日期信息解析时间，如 IG2026061700010454 → 2026-06-17
   */
  private parseTimeFromUrl(url: string): string {
    const match = url.match(/IG(\d{4})(\d{2})(\d{2})/);
    if (match) {
      const d = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+08:00`);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  }
}
