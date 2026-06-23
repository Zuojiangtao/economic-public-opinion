import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import * as cheerio from 'cheerio';
import { CRAWL_DELAY_MS } from '../config.js';

/**
 * 老虎社区爬虫
 * 数据源：老虎社区 https://www.laohu8.com/community
 */
export class Laohu8Crawler extends BaseCrawler {
  constructor() {
    super('laohu8', '老虎社区', 'social', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    try {
      // 尝试 API 接口
      const resp = await this.http.get('https://www.laohu8.com/api/v1/article/community/hot', {
        params: {
          page: 1,
          size: this.config.pageSize,
        },
        headers: {
          Referer: 'https://www.laohu8.com/community',
          'Accept': 'application/json',
        },
      });

      const data = resp.data?.data?.items || resp.data?.items || [];
      if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          allItems.push(this.mapApiItem(item));
        }
        console.log(`[laohu8] API: fetched ${data.length} items`);
        return allItems;
      }
    } catch (err) {
      console.log('[laohu8] API failed, trying HTML parsing...', (err as Error).message);
    }

    // Fallback: HTML 解析
    try {
      const resp = await this.http.get('https://www.laohu8.com/community', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      const $ = cheerio.load(resp.data);
      const items: ContentItem[] = [];

      // 尝试解析社区帖子列表（根据实际页面结构调整选择器）
      $('.post-item, .article-item, .community-item, article').each((_, elem) => {
        const $elem = $(elem);
        const title = $elem.find('.title, h2, h3, a[class*="title"]').first().text().trim();
        const content = $elem.find('.content, .summary, .desc, p').first().text().trim();
        const url = $elem.find('a').first().attr('href') || '';
        const author = $elem.find('.author, .user-name, [class*="author"]').first().text().trim();
        const timeStr = $elem.find('.time, .date, [class*="time"]').first().text().trim();

        if (title) {
          items.push({
            id: this.generateId('laohu8'),
            title,
            content: content || title,
            sourceType: 'social',
            sourceName: '老虎社区',
            author: author || '老虎社区用户',
            url: url.startsWith('http') ? url : `https://www.laohu8.com${url}`,
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

      if (items.length > 0) {
        console.log(`[laohu8] HTML: fetched ${items.length} items`);
        return items.slice(0, this.config.pageSize);
      }
    } catch (err) {
      console.error('[laohu8] HTML parsing failed:', (err as Error).message);
    }

    return allItems;
  }

  private mapApiItem(item: any): ContentItem {
    return {
      id: this.generateId('laohu8'),
      title: item.title || item.subject || '',
      content: this.stripHtml(item.content || item.summary || item.description || item.title || ''),
      sourceType: 'social',
      sourceName: '老虎社区',
      author: item.author || item.userName || item.user?.name || '老虎社区用户',
      url: item.url || item.link || `https://www.laohu8.com/post/${item.id || ''}`,
      publishedAt: this.parseTime(item.publishTime || item.createTime || item.time || ''),
      fetchedAt: '',
      market: 'cn',
      metrics: {
        likes: item.likeCount || item.likes || 0,
        comments: item.commentCount || item.comments || 0,
        views: item.viewCount || item.views || 0,
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
    if (!timeStr) return '';
    try {
      // 处理相对时间（如"2小时前"）——无法得到精确发布时间，返回空
      if (timeStr.includes('分钟前') || timeStr.includes('小时前') || timeStr.includes('天前')) {
        return '';
      }
      const d = new Date(timeStr.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }
}
