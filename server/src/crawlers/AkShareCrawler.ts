import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseCrawler } from './BaseCrawler.js';
import type { ContentItem } from '../types.js';
import { createRequire } from 'node:module';
const iconv = createRequire(import.meta.url)('iconv-lite');

const execFileAsync = promisify(execFile);

// 项目根目录下的 scripts/akshare_fetch.py
const SCRIPT_PATH = new URL('../../scripts/akshare_fetch.py', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

/**
 * AKShare 爬虫
 * 数据源：通过 Python AKShare 库获取财新快讯 + 个股新闻
 * 需要 Python3 + akshare 包
 * 注意：Windows 下子进程 stdout 默认使用系统编码（GBK），需转码为 UTF-8
 */
export class AkShareCrawler extends BaseCrawler {
  constructor() {
    super('akshare', 'AKShare聚合', 'news', 'cn', { intervalMinutes: 15 });
  }

  protected async doFetch(): Promise<ContentItem[]> {
    const allItems: ContentItem[] = [];

    try {
      // 使用 buffer 编码接收子进程输出，手动解码为 UTF-8
      // 避免 Windows 下默认 GBK 编码导致中文乱码
      const { stdout, stderr } = await execFileAsync('python3', [SCRIPT_PATH], {
        timeout: 60_000,
        maxBuffer: 5 * 1024 * 1024,
        encoding: 'buffer',
      });

      // 将 stdout Buffer 按 UTF-8 解码；若 UTF-8 解码失败则尝试 GBK
      let stdoutText: string;
      const stdoutBuf = stdout as Buffer;
      try {
        stdoutText = stdoutBuf.toString('utf-8');
        // 检测是否有乱码特征（UTF-8 解码出替换字符 ）
        if (stdoutText.includes('\ufffd')) {
          stdoutText = iconv.decode(stdoutBuf, 'gbk');
        }
      } catch {
        stdoutText = iconv.decode(stdoutBuf, 'gbk');
      }

      // stderr 也做同样处理
      let stderrText: string;
      const stderrBuf = stderr as Buffer;
      try {
        stderrText = stderrBuf.toString('utf-8');
        if (stderrText.includes('\ufffd')) {
          stderrText = iconv.decode(stderrBuf, 'gbk');
        }
      } catch {
        stderrText = iconv.decode(stderrBuf, 'gbk');
      }

      if (stderrText) {
        // AKShare 有进度条输出到 stderr，只记录真正的错误
        const errors = stderrText.split('\n').filter(l => l.includes('error') || l.includes('Error'));
        if (errors.length) console.warn(`[akshare] stderr: ${errors.join('; ')}`);
      }

      const data = JSON.parse(stdoutText);

      // 财新快讯
      for (const item of data.cx_news || []) {
        if (!item.title) continue;
        allItems.push({
          id: this.generateId('akshare-cx'),
          title: item.title,
          content: item.content || item.title,
          sourceType: 'news',
          sourceName: item.source || '财新',
          author: item.source || '财新',
          url: item.url || 'https://www.caixin.com/',
          publishedAt: '',
          fetchedAt: '',
          market: 'cn',
          metrics: {},
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      }

      // 个股新闻
      for (const item of data.stock_news || []) {
        if (!item.title) continue;
        allItems.push({
          id: this.generateId('akshare-em'),
          title: item.title,
          content: (item.content || item.title).slice(0, 500),
          sourceType: 'news',
          sourceName: item.source || '东方财富',
          author: item.source || '东方财富',
          url: item.url || '',
          publishedAt: this.parseTime(item.publishedAt),
          fetchedAt: '',
          market: 'cn',
          metrics: {},
          matches: [],
          nlp: { sentiment: 0, sentimentLabel: 'neutral', riskLevel: 'low', summary: '', entities: [] },
          dedup: { clusterId: '', similarCount: 0 },
        } as ContentItem);
      }

      console.log(`[akshare] Fetched ${allItems.length} items (cx: ${data.cx_news?.length || 0}, stock: ${data.stock_news?.length || 0})`);
    } catch (err) {
      console.error('[akshare] Fetch failed:', (err as Error).message);
    }

    return allItems;
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
