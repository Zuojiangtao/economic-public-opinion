import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import * as cheerio from 'cheerio';
import { CRAWL_DELAY_MS } from '../config.js';

/**
 * 证券之星爬虫
 * 数据源：证券之星 https://stock.stockstar.com/
 */
export class StockstarCrawler extends BaseCrawler {
  constructor() {
    super('stockstar', '证券之星', 'news', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    try {
      // 尝试 API 接口
      const resp = await this.http.get('https://stock.stockstar.com/api/news/list', {
        params: {
          page: 1,
          size: this.config.pageSize,
        },
        headers: {
          Referer: 'https://stock.stockstar.com/',
          'Accept': 'application/json',
        },
      });

      const data = resp.data?.data || resp.data?.list || [];
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          allItems.push(this.mapApiItem(item));
        }
        console.log(`[stockstar] API: fetched ${data.length} items`);
        return allItems;
      }
    } catch (err) {
      console.log('[stockstar] API failed, trying HTML parsing...', (err as Error).message);
    }

    // Fallback: HTML 解析
    try {
      const resp = await this.http.get('https://stock.stockstar.com/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(resp.data);
      const items: ContentItem[] = [];

      // 解析新闻列表（根据实际页面结构调整选择器）
      $('.news-item, .article-item, .list-item, .news-list li, article').each((_, elem) => {
        const $elem = $(elem);
        const title = $elem.find('.title, h2, h3, a[class*="title"]').first().text().trim();
        const content = $elem.find('.content, .summary, .desc, p').first().text().trim();
        const url = $elem.find('a').first().attr('href') || '';
        const timeStr = $elem.find('.time, .date, [class*="time"]').first().text().trim();

        if (title) {
          items.push({
            id: this.generateId('stockstar'),
            title,
            content: content || title,
            sourceType: 'news',
            sourceName: '证券之星',
            author: '证券之星',
            url: url.startsWith('http') ? url : `https://stock.stockstar.com${url}`,
            publishedAt: this.parseTime(timeStr),
            fetchedAt: '',
            market: 'cn',
            metrics: {},
            matches: [],
            nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
            dedup: { clusterId: '', similarCount: 0 },
          });
        }
      });

      if (items.length === 0) {
        // 尝试备用选择器 - 查找所有新闻链接
        $('a[href*="/news/"], a[href*="/stock/"]').each((_, elem) => {
          const $elem = $(elem);
          const title = $elem.text().trim();
          const url = $elem.attr('href') || '';

          if (title && title.length > 5 && !title.includes('更多')) {
            items.push({
              id: this.generateId('stockstar'),
              title,
              content: title,
              sourceType: 'news',
              sourceName: '证券之星',
              author: '证券之星',
              url: url.startsWith('http') ? url : `https://stock.stockstar.com${url}`,
              publishedAt: new Date().toISOString(),
              fetchedAt: '',
              market: 'cn',
              metrics: {},
              matches: [],
              nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
              dedup: { clusterId: '', similarCount: 0 },
            });
          }
        });
      }

      if (items.length > 0) {
        console.log(`[stockstar] HTML: fetched ${items.length} items`);
        return items.slice(0, this.config.pageSize);
      }
    } catch (err) {
      console.error('[stockstar] HTML parsing failed:', (err as Error).message);
    }

    return allItems;
  }

  private mapApiItem(item: any): ContentItem {
    return {
      id: this.generateId('stockstar'),
      title: item.title || item.name || '',
      content: this.stripHtml(item.content || item.summary || item.description || item.title || ''),
      sourceType: 'news',
      sourceName: '证券之星',
      author: item.author || item.source || '证券之星',
      url: item.url || item.link || `https://stock.stockstar.com/news/${item.id || ''}`,
      publishedAt: this.parseTime(item.publishTime || item.createTime || item.time || ''),
      fetchedAt: '',
      market: 'cn',
      metrics: {
        views: item.viewCount || item.views || 0,
        comments: item.commentCount || item.comments || 0,
      },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim();
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return new Date().toISOString();
    try {
      // 处理相对时间
      if (timeStr.includes('分钟前') || timeStr.includes('小时前') || timeStr.includes('天前')) {
        return new Date().toISOString();
      }
      const d = new Date(timeStr.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
