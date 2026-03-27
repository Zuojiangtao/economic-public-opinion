import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 抖音爬虫（存根）
 *
 * 抖音反爬机制极强，包括：
 * 1. 复杂的请求签名（_signature、msToken、a_bogus 等）
 * 2. 设备指纹和行为检测
 * 3. 频繁的接口和签名算法更新
 *
 * 建议接入方式：
 * 1. 使用抖音开放平台 API（需要企业资质）
 * 2. 使用第三方数据服务商
 * 3. 使用 Playwright + stealth 插件
 *
 * 目标数据：
 * - 财经类视频的评论和互动数据
 * - 财经大V的内容
 *
 * 启用方式：设置 DOUYIN_COOKIE 环境变量后启用
 */
export class DouyinCrawler extends BaseCrawler {
  constructor() {
    super('douyin', '抖音', 'social', 'cn', { enabled: false, intervalMinutes: 60 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const cookie = process.env.DOUYIN_COOKIE;
    if (!cookie) {
      console.warn('[douyin] DOUYIN_COOKIE not set, skipping. This crawler requires signature algorithm implementation.');
      return [];
    }

    console.warn('[douyin] Stub crawler - requires a_bogus/msToken signature. See crawler comments for guidance.');
    return [];
  }
}
