import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';

/**
 * 知乎爬虫（存根）
 *
 * 知乎有较强反爬机制，需要：
 * 1. 登录态 Cookie（通过浏览器手动获取）
 * 2. 处理验证码和频率限制
 * 3. 使用 Playwright/Puppeteer 模拟浏览器
 *
 * 目标数据：
 * - 热榜中与金融/股市相关的话题
 * - 特定话题下的回答
 * - 金融相关专栏文章
 *
 * 可能的 API：
 * - 热榜：https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total
 * - 搜索：https://www.zhihu.com/api/v4/search_v3?t=general&q=关键词
 *
 * 启用方式：设置 ZHIHU_COOKIE 环境变量后启用
 */
export class ZhihuCrawler extends BaseCrawler {
  constructor() {
    super('zhihu', '知乎', 'social', 'cn', { enabled: false, intervalMinutes: 30 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const cookie = process.env.ZHIHU_COOKIE;
    if (!cookie) {
      console.warn('[zhihu] ZHIHU_COOKIE not set, skipping. Set env var to enable.');
      return [];
    }

    try {
      const resp = await this.http.get(
        'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total',
        {
          params: { limit: 20 },
          headers: {
            Cookie: cookie,
            Referer: 'https://www.zhihu.com/hot',
          },
        },
      );

      const items: ContentItem[] = [];
      const data = resp.data?.data || [];

      for (const entry of data) {
        const target = entry.target || {};
        const title = target.title || entry.title || '';

        if (!this.isFinanceRelated(title)) continue;

        items.push({
          id: this.generateId('zhihu'),
          title,
          content: target.excerpt || title,
          sourceType: 'social',
          sourceName: '知乎',
          author: target.author?.name || '知乎用户',
          url: `https://www.zhihu.com/question/${target.id}`,
          publishedAt: target.created ? new Date(target.created).toISOString() : '',
          fetchedAt: '',
          market: 'cn',
          metrics: {
            likes: target.voteup_count || 0,
            comments: target.comment_count || 0,
            views: entry.detail_text ? parseInt(entry.detail_text.replace(/\D/g, '')) || 0 : 0,
          },
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      }

      console.log(`[zhihu] Fetched ${items.length} finance-related hot items`);
      return items;
    } catch (err) {
      console.error('[zhihu] Fetch failed:', (err as Error).message);
      return [];
    }
  }

  private isFinanceRelated(text: string): boolean {
    const keywords = [
      '股', '基金', '投资', '理财', '金融', '央行', '利率', '降息',
      'A股', '港股', '美股', '房价', '楼市', '经济', '通胀', '就业',
      '上市', 'IPO', '资本', '市场', '牛市', '熊市', '涨', '跌',
    ];
    return keywords.some((kw) => text.includes(kw));
  }
}
