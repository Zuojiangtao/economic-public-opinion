import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 彭博社（Bloomberg）爬虫
 *
 * 彭博社是全球领先的金融数据与新闻提供商。
 *
 * 接入方式（均需付费授权）：
 * 1. Bloomberg API（BLPAPI）
 *    - 官方提供的本地/网络 API
 *    - 需要 Bloomberg Terminal 订阅 + API 授权
 *    - 支持获取：实时行情、新闻、研究报告、历史数据
 *
 * 2. Bloomberg Data License
 *    - 企业级数据订阅服务
 *    - 批量数据下载与 API 访问
 *
 * 3. Bloomberg REST API
 *    - 基于 HTTP 的现代 API
 *    - 需要申请开发者账号与 API Key
 *
 * 启用方式：
 * - 设置 BLOOMBERG_API_KEY 环境变量
 * - 可选：BLOOMBERG_API_URL（默认使用 Bloomberg 官方 API）
 */
export class BloombergCrawler extends BaseCrawler {
  constructor() {
    super('bloomberg', '彭博社', 'news', 'us', { enabled: false, intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.BLOOMBERG_API_KEY;

    if (!apiKey) {
      console.warn('[bloomberg] BLOOMBERG_API_KEY not set, skipping. Requires Bloomberg API subscription.');
      console.warn('[bloomberg] 请申请 Bloomberg API 授权：https://www.bloomberg.com/professional/support/api-library/');
      return [];
    }

    const apiUrl = process.env.BLOOMBERG_API_URL || 'https://api.bloomberg.com/v1/news';

    try {
      const resp = await this.http.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        params: {
          limit: this.config.pageSize,
          languages: 'zh,en',
          categories: 'markets,companies,economy',
        },
      });

      const articles = resp.data?.articles || resp.data?.news || resp.data?.data || [];
      const items = articles.map((article: any) => this.mapArticle(article));

      console.log(`[bloomberg] Fetched ${items.length} articles`);
      return items;
    } catch (err) {
      console.error('[bloomberg] Fetch failed:', (err as Error).message);
      console.warn('[bloomberg] 请注意：Bloomberg API 需要付费订阅');
      return [];
    }
  }

  private mapArticle(article: any): ContentItem {
    return {
      id: this.generateId('bbg'),
      title: article.title || article.headline || 'Bloomberg News',
      content: article.summary || article.abstract || article.body || article.content || '',
      sourceType: 'news',
      sourceName: '彭博社 Bloomberg',
      author: article.authors?.[0] || article.author || article.byline || 'Bloomberg',
      url: article.url || article.link || article.uri || 'https://www.bloomberg.com',
      publishedAt: this.parseTime(article.publishedAt || article.published || article.timestamp || article.date),
      fetchedAt: '',
      market: 'us',
      metrics: {
        views: article.readCount || article.viewCount || 0,
      },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private parseTime(timeStr: string): string {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    } catch {
      return '';
    }
  }
}
