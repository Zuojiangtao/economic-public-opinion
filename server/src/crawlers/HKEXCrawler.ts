import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 港股爬虫（存根）
 *
 * 数据源：香港交易所披露易、港股财经媒体
 *
 * 建议接入方式：
 * 1. 港交所披露易 API（需申请）
 *    - 获取公告、财报、权益披露
 *    - https://www.hkexnews.hk
 *
 * 2. 港股财经媒体
 *    - 阿斯达克财经网 ( aastocks.com )
 *    - 香港经济日报 ( etnet.com.hk )
 *    - 财华社 ( finet.hk )
 *
 * 3. 第三方数据服务
 *    - 新浪财经港股 API
 *    - 东方财富港股数据
 *    - Bloomberg API / Refinitiv API
 *
 * 目标数据：
 * - 港股上市公司公告
 * - 港股财报和业绩
 * - 港股市场资讯和评论
 * - 港股通资金流向
 *
 * 启用方式：设置 HKEX_API_KEY 或相关环境变量
 */
export class HKEXCrawler extends BaseCrawler {
  constructor() {
    super('hkex', '港股资讯', 'news', 'hk', { enabled: false, intervalMinutes: 20 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.HKEX_API_KEY;

    if (!apiKey) {
      console.warn('[hkex] HKEX_API_KEY not set, skipping. This crawler requires Hong Kong stock data API access.');
      return [];
    }

    console.warn('[hkex] Stub crawler - implement HKEX data source integration based on your API provider.');

    // 示例：假设返回港股相关内容
    return [
      {
        id: this.generateId('hk'),
        title: '港股通资金流向数据示例',
        content: '南向资金今日净流入港股超50亿港元，加仓科技股',
        sourceType: 'news',
        sourceName: '港股资讯',
        author: '港股分析师',
        url: 'https://example.com/hk-stock-news',
        publishedAt: '',
        fetchedAt: '',
        market: 'hk',
        metrics: { views: 1000, comments: 50 },
        matches: [],
        nlp: { sentiment: 0.2, sentimentLabel: 'positive', riskLevel: 'low', summary: '', entities: [] },
        dedup: { clusterId: '', similarCount: 0 },
      },
    ];
  }
}
