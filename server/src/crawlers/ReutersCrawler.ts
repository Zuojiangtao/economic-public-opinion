import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 路透社（Reuters）爬虫
 *
 * 路透社是全球知名的新闻机构，提供金融、商业、政治等领域的新闻。
 *
 * 接入方式：
 * 1. Reuters News API
 *    - 官方新闻 API，需要付费订阅
 *    - 支持获取：财经新闻、市场分析、公司报道
 *    - 官网：https://developers.refinitiv.com/
 *
 * 2. Refinitiv Data Platform API
 *    - LSEG（伦敦证券交易所集团）旗下
 *    - 前身是 Thomson Reuters Financial & Risk
 *    - 提供全面的金融数据与新闻
 *
 * 3. RSS Feeds（免费但有限）
 *    - Reuters 提供部分免费的 RSS 订阅源
 *    - 内容相对有限，更新频率较低
 *
 * 启用方式：
 * - 设置 REUTERS_API_KEY 环境变量
 * - 可选：REUTERS_API_URL
 */
export class ReutersCrawler extends BaseCrawler {
  constructor() {
    super('reuters', '路透社', 'news', 'us', { enabled: false, intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.REUTERS_API_KEY;

    if (!apiKey) {
      console.warn('[reuters] REUTERS_API_KEY not set, skipping. Requires Reuters/Refinitiv API subscription.');
      console.warn('[reuters] 请申请 Refinitiv API 授权：https://developers.refinitiv.com/');
      console.warn('[reuters] 或使用免费 RSS 源：https://www.reutersagency.com/en/platforms/');
      return [];
    }

    const apiUrl = process.env.REUTERS_API_URL || 'https://api.refinitiv.com/data/news/v1/news-headlines';

    try {
      const resp = await this.http.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        params: {
          count: this.config.pageSize,
          languages: 'zh,en',
          query: 'markets OR finance OR economy OR stocks',
        },
      });

      const articles = resp.data?.news || resp.data?.headlines || resp.data?.articles || resp.data?.data || [];
      const items = articles.map((article: any) => this.mapArticle(article));

      console.log(`[reuters] Fetched ${items.length} articles`);
      return items;
    } catch (err) {
      console.error('[reuters] Fetch failed:', (err as Error).message);
      console.warn('[reuters] 请注意：Reuters API 需要付费订阅');
      return [];
    }
  }

  private mapArticle(article: any): ContentItem {
    return {
      id: this.generateId('reuters'),
      title: article.headline || article.title || 'Reuters News',
      content: article.story || article.summary || article.body || article.content || '',
      sourceType: 'news',
      sourceName: '路透社 Reuters',
      author: article.authors?.[0] || article.author || article.byline || 'Reuters',
      url: article.url || article.link || article.uri || 'https://www.reuters.com',
      publishedAt: this.parseTime(article.timestamp || article.publishedAt || article.date || article.time),
      fetchedAt: '',
      market: 'us',
      metrics: {},
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
