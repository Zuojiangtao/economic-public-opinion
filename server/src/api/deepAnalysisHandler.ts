/**
 * DeepSeek 手动深度分析
 *
 * 由用户手动触发，抓取指定时间段的高影响内容，
 * 统一发送给 DeepSeek 进行综合分析，结果存档。
 */
import { Router } from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import type { JsonStorage } from '../storage/JsonStorage.js';
import type { ContentItem } from '../types.js';

// DeepSeek 配置（独立于双阶段流水线）
const DEEPSEEK_BASE_URL = process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = process.env['DEEPSEEK_MODEL'] ?? 'deepseek-v4-pro';
const DEEPSEEK_API_KEY = process.env['DEEPSEEK_API_KEY'] ?? '';

// 存档目录
const ARCHIVE_DIR = path.resolve(process.cwd(), 'data', 'deep-analysis');

interface DeepAnalysisRecord {
  id: string;
  createdAt: string;
  startDate: string;
  endDate: string;
  contentCount: number;
  contentIds: string[];
  /** DeepSeek 返回的完整分析结果 */
  analysis: string;
  /** 结构化摘要 */
  summary: {
    overallSentiment: string;
    keyEvents: string[];
    riskWarnings: string[];
    sectorImpact: string[];
    actionableInsights: string[];
  };
  model: string;
  tokensUsed?: number;
}

function ensureArchiveDir() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }
}

function loadArchive(): DeepAnalysisRecord[] {
  ensureArchiveDir();
  const files = fs.readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.json')).sort().reverse();
  return files.map(f => JSON.parse(fs.readFileSync(path.join(ARCHIVE_DIR, f), 'utf-8')));
}

function saveRecord(record: DeepAnalysisRecord) {
  ensureArchiveDir();
  const filename = `${record.id}.json`;
  fs.writeFileSync(path.join(ARCHIVE_DIR, filename), JSON.stringify(record, null, 2), 'utf-8');
}

/** 筛选高影响内容 */
function filterHighImpact(items: ContentItem[], startDate: string, endDate: string): ContentItem[] {
  return items.filter(item => {
    // 时间范围
    if (item.publishedAt < startDate || item.publishedAt > endDate + 'T23:59:59Z') return false;
    // 高影响：secondaryAnalysis=true 或 risk/strong_negative/strong_positive
    const enhanced = item.nlp?.enhanced;
    if (enhanced?.secondaryAnalysis) return true;
    if (enhanced?.label === 'risk' || enhanced?.label === 'strong_negative' || enhanced?.label === 'strong_positive') return true;
    // 或者 riskLevel 为 high/critical
    if (item.nlp?.riskLevel === 'high' || item.nlp?.riskLevel === 'critical') return true;
    return false;
  });
}

/** 构建分析 prompt */
function buildPrompt(items: ContentItem[]): string {
  const contents = items.map((item, i) => {
    const enhanced = item.nlp?.enhanced;
    return `---
[${i + 1}] ${item.title}
来源: ${item.sourceName} (${item.sourceType})
时间: ${item.publishedAt}
情绪标签: ${enhanced?.label ?? item.nlp?.sentimentLabel ?? '未知'}
置信度: ${enhanced?.confidence ?? '-'}
风险等级: ${item.nlp?.riskLevel ?? '-'}
正文: ${(item.content ?? '').slice(0, 800)}${(item.content ?? '').length > 800 ? '...' : ''}
关键词: ${[...(enhanced?.positiveSignals ?? []), ...(enhanced?.negativeSignals ?? []), ...(enhanced?.riskSignals ?? [])].join(', ')}
---`;
  }).join('\n');

  return `你是一位资深中国金融市场策略分析师。以下是 ${items.length} 条已被初筛标记为"高影响"的金融舆情内容。
请对这些内容进行综合深度分析，输出严格 JSON，不要包含额外文字：

{
  "overallSentiment": "综合情绪判断（一句话）",
  "keyEvents": ["识别出的关键事件1", "关键事件2", ...],
  "riskWarnings": ["风险预警1", "风险预警2", ...],
  "sectorImpact": ["行业/板块影响1", "影响2", ...],
  "actionableInsights": ["可操作的分析洞察1", "洞察2", ...],
  "fullAnalysis": "完整的深度分析报告（3-8段，包含因果逻辑、传导链分析、市场影响判断）"
}

要求：
1. 综合所有内容，识别事件之间的关联和传导链
2. 评估对相关板块/个股的潜在连锁反应
3. 突出需要重点关注的风险信号
4. 给出可操作的投资参考方向（非投资建议）

以下是待分析内容：

${contents}`;
}

/** 调用 DeepSeek API */
async function callDeepSeek(prompt: string): Promise<{ content: string; tokensUsed?: number }> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY 未配置，请在 .env 中设置');
  }

  const response = await axios.post<{ choices: { message: { content: string } }[]; usage?: { total_tokens: number } }>(
    `${DEEPSEEK_BASE_URL}/chat/completions`,
    {
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: '你是资深中国金融市场策略分析师，输出严格 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    },
    {
      headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
      timeout: 120000, // 2 分钟超时，深度分析需要较长时间
    },
  );

  return {
    content: response.data.choices[0]?.message?.content ?? '{}',
    tokensUsed: response.data.usage?.total_tokens,
  };
}

export function createDeepAnalysisRouter(storage: JsonStorage): Router {
  const router = Router();

  /**
   * POST /deep-analysis
   * 手动触发 DeepSeek 深度分析
   * Body: { startDate: string, endDate: string }
   */
  router.post('/', async (req, res) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      res.status(400).json({ code: 'BAD_REQUEST', message: '需要提供 startDate 和 endDate' });
      return;
    }

    // 筛选高影响内容
    const allItems = storage.getAll();
    const highImpact = filterHighImpact(allItems, startDate, endDate);

    if (highImpact.length === 0) {
      res.status(200).json({
        success: true,
        message: '该时间段内没有高影响内容需要分析',
        contentCount: 0,
      });
      return;
    }

    // 限制条目数量，避免 prompt 过长
    const MAX_ITEMS = 30;
    const toAnalyze = highImpact.slice(0, MAX_ITEMS);

    try {
      console.log(`[DeepAnalysis] 开始分析 ${toAnalyze.length} 条高影响内容 (${startDate} ~ ${endDate})`);

      const prompt = buildPrompt(toAnalyze);
      const { content: rawResult, tokensUsed } = await callDeepSeek(prompt);

      // 解析 JSON 结果
      let parsed: Record<string, unknown>;
      try {
        // 尝试提取 JSON（DeepSeek 可能会包裹 markdown 代码块）
        const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResult);
      } catch {
        // JSON 解析失败，保存原始文本
        parsed = {
          overallSentiment: '解析失败，见 fullAnalysis 原文',
          keyEvents: [],
          riskWarnings: [],
          sectorImpact: [],
          actionableInsights: [],
          fullAnalysis: rawResult,
        };
      }

      // 构建存档记录
      const record: DeepAnalysisRecord = {
        id: `da-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        startDate,
        endDate,
        contentCount: toAnalyze.length,
        contentIds: toAnalyze.map(c => c.id),
        analysis: (parsed['fullAnalysis'] as string) ?? rawResult,
        summary: {
          overallSentiment: (parsed['overallSentiment'] as string) ?? '',
          keyEvents: (parsed['keyEvents'] as string[]) ?? [],
          riskWarnings: (parsed['riskWarnings'] as string[]) ?? [],
          sectorImpact: (parsed['sectorImpact'] as string[]) ?? [],
          actionableInsights: (parsed['actionableInsights'] as string[]) ?? [],
        },
        model: DEEPSEEK_MODEL,
        tokensUsed,
      };

      // 存档
      saveRecord(record);
      console.log(`[DeepAnalysis] 分析完成，已存档: ${record.id}`);

      res.json({
        success: true,
        record,
        message: `已分析 ${toAnalyze.length} 条高影响内容`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[DeepAnalysis] 分析失败:', msg);
      res.status(500).json({ code: 'ANALYSIS_ERROR', message: msg });
    }
  });

  /**
   * GET /deep-analysis
   * 获取历史分析记录列表
   * Query: limit=10
   */
  router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const records = loadArchive().slice(0, limit);
    res.json({ records, total: records.length });
  });

  /**
   * GET /deep-analysis/:id
   * 获取单条分析记录详情
   */
  router.get('/:id', (req, res) => {
    ensureArchiveDir();
    const filePath = path.join(ARCHIVE_DIR, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ code: 'NOT_FOUND', message: '分析记录不存在' });
      return;
    }
    const record = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DeepAnalysisRecord;
    res.json(record);
  });

  return router;
}
