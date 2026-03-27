import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 富途证券（Futu）爬虫 - 港股/美股市场数据
 *
 * 富途是香港领先的互联网券商，提供港股、美股、A股的交易与资讯服务。
 *
 * 接入方式：
 * 1. Futu Open API（OpenD + Futu API）
 *    - 官方提供的量化交易 API
 *    - 需要 Futu 账户与 API 授权
 *    - 支持获取：实时行情、K线数据、新闻资讯、公司公告
 *    - 文档：https://www.futunn.com/OpenAPI
 *
 * 2. Futu Web RSS/News API（非官方）
 *    - 富途网站提供的新闻、快讯接口
 *    - 可通过 web 端接口获取资讯数据
 *
 * 3. 牛牛社区（NN Community）
 *    - 富途旗下的投资者社区
 *    - 提供热门帖子、讨论内容
 *
 * 启用方式：
 * - 设置 FUTU_API_KEY 环境变量（如需使用官方 API）
 * - 或配置 FUTU_COOKIE 获取网页端数据（非官方方式，可能不稳定）
 */
export class FutuCrawler extends BaseCrawler {
  constructor() {
    super('futu', '富途证券', 'broker', 'hk', { enabled: false, intervalMinutes: 10 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiKey = process.env.FUTU_API_KEY;
    const cookie = process.env.FUTU_COOKIE;

    // 如果配置了 Open API Key，使用官方 API
    if (apiKey) {
      return await this.fetchFromOpenApi(apiKey);
    }

    // 否则尝试从网页端获取
    if (cookie) {
      return await this.fetchFromWeb(cookie);
    }

    // 未配置任何凭证，返回空并提示
    console.warn('[futu] FUTU_API_KEY 或 FUTU_COOKIE 未设置，跳过爬取。');
    console.warn('[futu] 如需接入，请：');
    console.warn('[futu] 1. 申请 Futu Open API：https://www.futunn.com/OpenAPI');
    console.warn('[futu] 2. 或设置 FUTU_COOKIE 使用网页端接口');
    return [];
  }

  private async fetchFromOpenApi(apiKey: string): Promise<ContentItem[]> {
    try {
      // Futu Open API 需要通过 OpenD 本地服务调用
      // 这里假设 OpenD 运行在本地端口 11111
      const opendUrl = process.env.FUTU_OPEND_URL || 'http://127.0.0.1:11111';

      const resp = await this.http.get(`${opendUrl}/api/news`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
        params: {
          market: 'HK,US',
          limit: this.config.pageSize,
        },
      });

      const news = resp.data?.news || resp.data?.data || [];
      const items = news.map((item: any) => this.mapNewsItem(item));

      console.log(`[futu] Fetched ${items.length} news via OpenAPI`);
      return items;
    } catch (err) {
      console.error('[futu] OpenAPI fetch failed:', (err as Error).message);
      console.warn('[futu] 请确保 OpenD 服务已启动');
      return [];
    }
  }

  private async fetchFromWeb(cookie: string): Promise<ContentItem[]> {
    try {
      // 富途牛牛快讯接口
      const resp = await this.http.get('https://www.futunn.com/flash/api/flash-list', {
        headers: {
          'Cookie': cookie,
          'Referer': 'https://www.futunn.com/',
          'Accept': 'application/json',
        },
        params: {
          size: this.config.pageSize,
          type: 'all',
        },
      });

      const news = resp.data?.data?.list || resp.data?.list || [];
      const items = news.map((item: any) => this.mapWebNewsItem(item));

      console.log(`[futu] Fetched ${items.length} news from web`);
      return items;
    } catch (err) {
      console.error('[futu] Web fetch failed:', (err as Error).message);
      return [];
    }
  }

  private mapNewsItem(item: any): ContentItem {
    const market = this.detectMarket(item.market || item.stockCode);

    return {
      id: this.generateId('futu'),
      title: item.title || item.headline || '富途快讯',
      content: item.content || item.summary || item.body || '',
      sourceType: 'broker',
      sourceName: '富途证券 Futu',
      author: item.source || item.publisher || '富途牛牛',
      url: item.url || `https://www.futunn.com/stock/${item.stockCode || ''}`,
      publishedAt: this.parseTime(item.time || item.publishTime || item.timestamp),
      fetchedAt: '',
      market,
      metrics: {
        views: item.viewCount || 0,
      },
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private mapWebNewsItem(item: any): ContentItem {
    const market = this.detectMarket(item.code || item.stockCode);

    return {
      id: this.generateId('futu'),
      title: item.title || item.content?.substring(0, 50) || '富途快讯',
      content: item.content || item.summary || '',
      sourceType: 'broker',
      sourceName: '富途牛牛',
      author: item.sourceName || '富途',
      url: item.link || item.url || 'https://www.futunn.com/flash',
      publishedAt: this.parseTime(item.time || item.createTime || item.publishTime),
      fetchedAt: '',
      market,
      metrics: {},
      matches: [],
      nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
      dedup: { clusterId: '', similarCount: 0 },
    };
  }

  private detectMarket(stockCode?: string): 'hk' | 'us' | 'cn' {
    if (!stockCode) return 'hk';

    // 港股：5位数字或以 HK|SH|SZ 开头
    if (/^\d{5}$/.test(stockCode) || /^HK\.?/i.test(stockCode)) {
      return 'hk';
    }

    // 美股：字母代码
    if (/^[A-Z]{1,5}$/.test(stockCode) || stockCode.includes('.')) {
      return 'us';
    }

    return 'hk';
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
