import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 老虎证券（Tiger Brokers）爬虫 - 美股/港股/新加坡股/A股市场数据
 *
 * 老虎证券是知名的跨境互联网券商，提供美股、港股、A股等市场的交易与资讯服务。
 *
 * 接入方式：
 * 1. Tiger Open API
 *    - 官方提供的 Open API 服务
 *    - 需要老虎证券账户与 API 授权
 *    - 支持获取：实时行情、K线数据、资讯新闻、财务数据
 *    - 文档：https://www.itiger.com/openapi
 *
 * 2. Tiger Web 端接口（非官方）
 *    - 可通过老虎社区、新闻页面获取公开资讯
 *    - 需要 Cookie 或 Token
 *
 * 3. 老虎社区（Tiger Community）
 *    - 投资者交流与讨论平台
 *    - 提供热门话题、用户发帖
 *
 * 启用方式：
 * - 设置 TIGER_API_KEY 环境变量（如需使用官方 API）
 * - 或配置 TIGER_TOKEN 获取网页端数据
 * - 可选：TIGER_ACCOUNT_ID 指定账户
 */
export class TigerCrawler extends BaseCrawler {
  constructor() {
    super('tiger', '老虎证券', 'broker', 'us', { enabled: false, intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.TIGER_API_KEY;
    const token = process.env.TIGER_TOKEN;
    const privateKey = process.env.TIGER_PRIVATE_KEY;

    // 如果配置了 Open API，使用官方 API
    if (apiKey && privateKey) {
      return await this.fetchFromOpenApi(apiKey, privateKey);
    }

    // 如果配置了 Token，使用网页端接口
    if (token) {
      return await this.fetchFromWeb(token);
    }

    // 未配置任何凭证，返回空并提示
    console.warn('[tiger] TIGER_API_KEY + TIGER_PRIVATE_KEY 或 TIGER_TOKEN 未设置，跳过爬取。');
    console.warn('[tiger] 如需接入，请：');
    console.warn('[tiger] 1. 申请 Tiger Open API：https://www.itiger.com/openapi');
    console.warn('[tiger] 2. 或设置 TIGER_TOKEN 使用网页端接口');
    return [];
  }

  private async fetchFromOpenApi(apiKey: string, privateKey: string): Promise<ContentItem[]> {
    try {
      // Tiger Open API 需要签名验证
      // 实际调用需要实现 Tiger API 的签名逻辑
      const apiUrl = process.env.TIGER_API_URL || 'https://openapi.itiger.com/gateway';

      // 构建请求参数
      const timestamp = Date.now().toString();
      const sign = this.generateSign(apiKey, privateKey, timestamp);

      const resp = await this.http.post(apiUrl, {
        method: 'news_query',
        timestamp,
        sign,
        apiKey,
        params: {
          market: 'US,HK',
          limit: this.config.pageSize,
        },
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      const news = resp.data?.results || resp.data?.news || resp.data?.data || [];
      const items = news.map((item: any) => this.mapNewsItem(item));

      console.log(`[tiger] Fetched ${items.length} news via OpenAPI`);
      return items;
    } catch (err) {
      console.error('[tiger] OpenAPI fetch failed:', (err as Error).message);
      return [];
    }
  }

  private async fetchFromWeb(token: string): Promise<ContentItem[]> {
    try {
      // 老虎证券新闻/快讯接口
      const resp = await this.http.get('https://www.itiger.com/api/news/list', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Referer': 'https://www.itiger.com/',
          'Accept': 'application/json',
        },
        params: {
          size: this.config.pageSize,
          type: 'news',
        },
      });

      const news = resp.data?.data?.list || resp.data?.list || resp.data?.news || [];
      const items = news.map((item: any) => this.mapWebNewsItem(item));

      console.log(`[tiger] Fetched ${items.length} news from web`);
      return items;
    } catch (err) {
      console.error('[tiger] Web fetch failed:', (err as Error).message);
      return [];
    }
  }

  private generateSign(apiKey: string, privateKey: string, timestamp: string): string {
    // Tiger API 签名逻辑（简化版本）
    // 实际实现需要按照 Tiger API 文档的签名规则
    // 通常使用 RSA 签名或 HMAC-SHA256
    const crypto = require('crypto');
    const signStr = `${apiKey}${timestamp}`;
    return crypto.createHmac('sha256', privateKey).update(signStr).digest('hex');
  }

  private mapNewsItem(item: any): ContentItem {
    const market = this.detectMarket(item.market || item.symbol);

    return {
      id: this.generateId('tiger'),
      title: item.title || item.headline || '老虎证券资讯',
      content: item.content || item.summary || item.body || item.description || '',
      sourceType: 'broker',
      sourceName: '老虎证券 Tiger',
      author: item.source || item.author || '老虎证券',
      url: item.url || item.link || `https://www.itiger.com/stock/${item.symbol || ''}`,
      publishedAt: this.parseTime(item.time || item.publishTime || item.timestamp || item.createdAt),
      fetchedAt: '',
      market,
      metrics: {
        views: item.viewCount || item.views || 0,
      },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private mapWebNewsItem(item: any): ContentItem {
    const market = this.detectMarket(item.symbol || item.code);

    return {
      id: this.generateId('tiger'),
      title: item.title || item.content?.substring(0, 50) || '老虎证券快讯',
      content: item.content || item.summary || item.text || '',
      sourceType: 'broker',
      sourceName: '老虎证券',
      author: item.source || '老虎社区',
      url: item.link || item.url || 'https://www.itiger.com/news',
      publishedAt: this.parseTime(item.time || item.createTime || item.publishTime || item.ts),
      fetchedAt: '',
      market,
      metrics: {},
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private detectMarket(market?: string): 'hk' | 'us' | 'cn' {
    if (!market) return 'us';

    const m = market.toUpperCase();
    if (m === 'HK' || m === 'HKEX') return 'hk';
    if (m === 'US' || m === 'NYSE' || m === 'NASDAQ') return 'us';
    if (m === 'CN' || m === 'SH' || m === 'SZ') return 'cn';

    return 'us';
  }

  private parseTime(timeStr: string | number): string {
    if (!timeStr) return new Date().toISOString();
    try {
      // 处理时间戳（秒或毫秒）
      if (typeof timeStr === 'number') {
        const ts = timeStr > 10000000000 ? timeStr : timeStr * 1000;
        return new Date(ts).toISOString();
      }
      const d = new Date(timeStr);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
