import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import * as cheerio from 'cheerio';
import { CRAWL_DELAY_MS } from '../config.js';

/**
 * 第一银行爬虫
 * 数据源：第一银行投资趋势洞察 https://wealth.firstbank.com.tw/investment-tips/trend-insight/news
 */
export class FirstBankCrawler extends BaseCrawler {
  constructor() {
    super('firstbank', '第一银行', 'news', 'cn', { intervalMinutes: 30 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    for (let page = 1; page <= this.config.maxPages; page++) {
      if (page > 1) await this.delay(CRAWL_DELAY_MS);

      try {
        const url = page === 1 
          ? 'https://wealth.firstbank.com.tw/investment-tips/trend-insight/news'
          : `https://wealth.firstbank.com.tw/investment-tips/trend-insight/news?page=${page}`;

        const resp = await this.http.get(url, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
          },
        });

        const $ = cheerio.load(resp.data);
        const items: ContentItem[] = [];

        // 解析新闻列表（根据实际页面结构调整选择器）
        $('.news-item, .article-item, .list-item, article, .card').each((_, elem) => {
          const $elem = $(elem);
          const title = $elem.find('.title, h2, h3, h4, a[class*="title"]').first().text().trim();
          const content = $elem.find('.content, .summary, .desc, .excerpt, p').first().text().trim();
          const url = $elem.find('a').first().attr('href') || '';
          const timeStr = $elem.find('.time, .date, [class*="date"], [class*="time"]').first().text().trim();

          if (title) {
            items.push({
              id: this.generateId('firstbank'),
              title,
              content: content || title,
              sourceType: 'news',
              sourceName: '第一银行',
              author: '第一银行',
              url: url.startsWith('http') ? url : `https://wealth.firstbank.com.tw${url}`,
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
          // 尝试备用选择器
          $('a[href*="/investment-tips/trend-insight/"]').each((_, elem) => {
            const $elem = $(elem);
            const title = $elem.text().trim();
            const url = $elem.attr('href') || '';

            if (title && title.length > 5) {
              items.push({
                id: this.generateId('firstbank'),
                title,
                content: title,
                sourceType: 'news',
                sourceName: '第一银行',
                author: '第一银行',
                url: url.startsWith('http') ? url : `https://wealth.firstbank.com.tw${url}`,
                publishedAt: '',
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

        if (items.length === 0) break;

        allItems.push(...items.slice(0, this.config.pageSize));
        console.log(`[firstbank] Page ${page}: fetched ${items.length} items`);

        if (items.length < this.config.pageSize) break;
      } catch (err) {
        console.error(`[firstbank] Page ${page} failed:`, (err as Error).message);
        break;
      }
    }

    return allItems;
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return '';
    try {
      // 处理繁体中文日期格式
      const cleaned = timeStr.replace(/年|月/g, '-').replace(/日/g, '').trim();
      const d = new Date(cleaned);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }
}
