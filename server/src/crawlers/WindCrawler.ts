import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 万德（Wind）爬虫（存根）
 *
 * Wind 是付费金融终端，不支持爬取。接入方式：
 *
 * 1. Wind API（WindPy / Wind RESTful API）
 *    - 需要购买 Wind 终端 + API 授权
 *    - Python SDK (WindPy) 或 RESTful API
 *    - 可获取：新闻、研报、公告、行情、财务数据
 *
 * 2. Wind 量化接口（WindQuant）
 *    - 专业量化场景
 *    - 需要量化版授权
 *
 * 如果已有 Wind 终端许可，可以：
 * - 设置 WIND_API_URL 和 WIND_API_TOKEN 环境变量
 * - 实现 doFetch() 调用 Wind RESTful API
 *
 * 类似可替代的数据源：
 * - 恒生电子聚源数据（JY Data，也是付费）
 * - Tushare Pro（社区版部分免费）
 * - AKShare（开源，部分数据可用于学习/原型）
 *
 * 启用方式：设置 WIND_API_URL 和 WIND_API_TOKEN 环境变量
 */
export class WindCrawler extends BaseCrawler {
  constructor() {
    super('wind', '万德Wind', 'broker', 'cn', { enabled: false, intervalMinutes: 30 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const apiUrl = process.env.WIND_API_URL;
    const apiToken = process.env.WIND_API_TOKEN;

    if (!apiUrl || !apiToken) {
      console.warn('[wind] WIND_API_URL/WIND_API_TOKEN not set, skipping. Requires paid Wind terminal license.');
      return [];
    }

    console.warn('[wind] Stub crawler - implement Wind RESTful API calls based on your license.');
    return [];
  }
}
