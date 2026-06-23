import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 美股爬虫（存根）
 *
 * 数据源：SEC EDGAR、美股财经媒体
 *
 * 建议接入方式：
 * 1. SEC EDGAR API（免费，但有限制）
 *    - 获取上市公司公告、财报（10-K, 10-Q, 8-K）
 *    - https://www.sec.gov/edgar/sec-api-documentation
 *
 * 2. 美股财经媒体
 *    - Yahoo Finance API
 *    - Seeking Alpha
 *    - MarketWatch
 *    - Bloomberg / CNBC
 *
 * 3. 第三方数据服务
 *    - Alpha Vantage API
 *    - Polygon.io
 *    - IEX Cloud
 *    - Financial Modeling Prep
 *
 * 目标数据：
 * - 美股上市公司公告和财报
 * - 美股市场资讯和评论
 * - 中概股相关新闻
 * - 美联储政策动态
 *
 * 启用方式：设置 SEC_API_KEY 或相关环境变量
 */
export class SECCrawler extends BaseCrawler {
  constructor() {
    super('sec_us', '美股资讯', 'news', 'us', { enabled: false, intervalMinutes: 30 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.SEC_API_KEY || process.env.ALPHA_VANTAGE_KEY;

    if (!apiKey) {
      console.warn('[sec_us] SEC_API_KEY/ALPHA_VANTAGE_KEY not set, skipping. This crawler requires US stock data API access.');
      return [];
    }

    console.warn('[sec_us] Stub crawler - implement US stock data source integration based on your API provider.');

    // 示例：假设返回美股相关内容
    return [
      {
        id: this.generateId('us'),
        title: '美股中概股动态示例',
        content: '热门中概股多数上涨，纳斯达克中国金龙指数涨2%',
        sourceType: 'news',
        sourceName: '美股资讯',
        author: '美股分析师',
        url: 'https://example.com/us-stock-news',
        publishedAt: '',
        fetchedAt: '',
        market: 'us',
        metrics: { views: 2000, comments: 100 },
        matches: [],
        nlp: { sentiment: 0.3, sentimentLabel: 'positive', riskLevel: 'low', summary: '', entities: [] },
        dedup: { clusterId: '', similarCount: 0 },
      },
    ];
  }
}
