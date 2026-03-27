import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 小红书爬虫（存根）
 *
 * 小红书反爬机制极强，包括：
 * 1. 请求签名（X-s、X-t 等自定义头）
 * 2. 设备指纹检测
 * 3. 频繁的反爬策略更新
 * 4. 需要登录态
 *
 * 建议接入方式：
 * 1. 使用小红书开放平台 API（需要企业资质申请）
 * 2. 使用第三方数据服务商（如数说聚合等）
 * 3. 使用 Playwright + stealth 插件模拟浏览器
 *
 * 目标数据：
 * - 金融/理财/投资 相关笔记
 * - 基金、股票、保险 相关讨论
 *
 * 启用方式：设置 XHS_COOKIE 环境变量后启用
 */
export class XiaohongshuCrawler extends BaseCrawler {
  constructor() {
    super('xiaohongshu', '小红书', 'social', 'cn', { enabled: false, intervalMinutes: 60 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const cookie = process.env.XHS_COOKIE;
    if (!cookie) {
      console.warn('[xiaohongshu] XHS_COOKIE not set, skipping. This crawler requires additional anti-detection setup.');
      return [];
    }

    console.warn('[xiaohongshu] Stub crawler - requires X-s signature implementation. See crawler comments for guidance.');
    return [];
  }
}
