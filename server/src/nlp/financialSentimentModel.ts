/**
 * T011 金融语义情绪模型适配层
 *
 * 架构：
 *   SentimentModelAdapter（抽象接口）
 *     ├── DictionaryModelAdapter  —— 增强版词典法（默认 baseline）
 *     └── TwoStageLLMAdapter       —— MiMo 双阶段分析（双阶段 LLM）
 *
 * 环境变量（server/.env）：
 *   PRIMARY_LLM_API_KEY    必填，主力模型（MiMo）鉴权
 *   PRIMARY_LLM_BASE_URL   可选，默认 https://api.xiaomimimo.com/v1
 *   PRIMARY_LLM_MODEL      可选，默认 mimo-v2.5-v
 *   DEEP_LLM_API_KEY       可选，深度分析模型（MiMo V2.5）鉴权
 *   DEEP_LLM_BASE_URL      可选，默认 https://api.xiaomimimo.com/v1
 *   DEEP_LLM_MODEL         可选，默认 mimo-v2.5-v
 *   LLM_PORTFOLIO_ONLY     可选，默认 true。设为 false 则所有文章都走 LLM。
 *
 * 高影响内容（含风险词或强信号）会被标记 secondaryAnalysis=true。
 *
 * 成本控制：默认只对持仓相关行业的文章调用 LLM，其余走词典法。
 * 通过 LLM_PORTFOLIO_ONLY 环境变量控制。
 */

import axios from 'axios';
import type {
  FinancialSentimentLabel,
  EnhancedSentimentResult,
  SentimentModelSource,
} from '../types.js';

// ─── 词典扩展 ────────────────────────────────────────────────────────────────

const STRONG_POSITIVE_WORDS = [
  '涨停', '涨停板', '连续涨停', '暴涨', '大涨', '飙涨', '急涨', '巨涨',
  '创新高', '历史新高', '年内新高', '突破', '超预期', '大超预期',
  '超预期增长', '业绩爆发', '净利润暴增', '营收大增',
  '重大利好', '特大利好', '利好兑现', '政策大礼包',
];

const WEAK_POSITIVE_WORDS = [
  '利好', '上涨', '反弹', '回暖', '复苏', '增长', '改善', '向好',
  '强势', '领涨', '净流入', '加仓', '增持', '买入', '推荐', '利多',
  '降息', '降准', '宽松', '刺激', '支持', '扶持', '补贴',
  '盈利', '分红', '回购', '重组', '并购', '合作', '企稳', '止跌',
  '底部', '站上', '攀升', '走高', '高开', '收涨', '放量上涨', '翻红',
];

const STRONG_NEGATIVE_WORDS = [
  '跌停', '跌停板', '连续跌停', '暴跌', '大跌', '崩盘', '闪崩', '腰斩',
  '创新低', '历史新低', '重挫', '断崖式', '断崖下跌',
  '暴雷', '爆雷', '违约', '破产', '清盘', '强平', '质押爆仓',
  '大规模减持', '集中抛售', '重大亏损', '业绩暴雷',
];

const WEAK_NEGATIVE_WORDS = [
  '利空', '下跌', '走弱', '下挫', '杀跌', '破位', '新低',
  '恐慌', '担忧', '悲观', '看空', '看跌', '熊市',
  '亏损', '减持', '抛售', '净流出', '卖出',
  '监管', '处罚', '罚款', '整顿', '叫停', '警告', '约谈',
  '做空', '空头', '沽空', '绿盘', '低开', '收跌', '放量下跌',
];

const RISK_KEYWORDS = [
  '暴雷', '爆雷', '违约', '破产', '跑路', '失联', '崩盘',
  '做空', '造假', '欺诈', '操纵', '清盘', '退市', '强平',
  '危机', '恐慌', '闪崩', '质押爆仓', '断崖', '腰斩',
  '重大诉讼', '刑事调查', '被迫停牌', '债务危机', '流动性危机',
];

const RUMOR_KEYWORDS = [
  '据悉', '消息称', '有消息', '据报道', '传言', '传闻', '疑似',
  '或将', '可能', '有望', '据知情人士', '据内部人士', '坊间消息',
  '未经证实', '尚未证实', '市场传言', '业内消息', '小道消息',
  '听说', '据说', '爆料', '曝光', '独家消息', '知情人透露',
];

// ─── 持仓行业过滤（成本控制）─────────────────────────────────────────────────

const LLM_PORTFOLIO_ONLY = (process.env['LLM_PORTFOLIO_ONLY'] ?? 'true') !== 'false';

/**
 * 持仓相关行业关键词集。
 * 仅包含 isHoldings=true 的行业：有色金属、银行、新能源/汽车、公用事业、证券、煤炭、工程机械
 * 同时覆盖持仓个股名称和代码。
 *
 * 匹配逻辑：文章标题+正文包含任一关键词即视为"持仓相关"，走 LLM 分析；
 * 不匹配的文章直接用词典法，省 token。
 */
const PORTFOLIO_KEYWORDS: ReadonlySet<string> = new Set([
  // ── 有色金属 (紫金矿业) ──
  '有色金属', '铜价', '铜矿', '铜业', '铝价', '铝业', '铝矿', '金价', '碳酸锂', '氢氧化锂',
  '钴', '镍', '银价', '稀土', '铅锌',
  '紫金矿业', '山东黄金', '赣锋锂业', '601899',
  // ── 银行 (工商银行) ──
  '银行业', '银行股', '降准', '降息', 'LPR', '存款利率', '贷款利率', '净息差', '不良贷款', '拨备', '国有大行', '城商行',
  '工商银行', '工行', '建设银行', '招商银行', '601398',
  // ── 新能源/汽车 (比亚迪) ──
  '新能源', '光伏', '锂电池', '储能', '风电', '电动汽车', '充电桩', '氢能', '碳中和',
  '汽车行业', '汽车销量', '整车', '智能驾驶', '自动驾驶', '车联网', '新能源汽车', '造车新势力',
  '比亚迪', '宁德时代', '特斯拉', '002594',
  // ── 公用事业 (浙能电力) ──
  '电力行业', '电力股', '公用事业', '水务', '燃气', '供电', '供热', '电价',
  '浙能电力', '长江电力', '华能水电', '600023',
  // ── 证券 (招商证券) ──
  '证券', '券商', '投行', '资产管理', '经纪业务', '两融', '自营业务', '注册制', 'IPO', '再融资',
  '招商证券', '中信证券', '600999',
  // ── 煤炭 (中国神华) ──
  '煤炭', '焦煤', '动力煤', '焦炭', '煤化工', '煤矿', '煤电',
  '中国神华', '兖矿能源', '中煤能源', '601088',
  // ── 工程机械 (徐工机械) ──
  '工程机械', '挖掘机', '起重机', '装载机', '混凝土机械', '桩工机械', '叉车',
  '徐工机械', '三一重工', '中联重科', '000425',
]);

/** 检查文本是否与持仓行业相关 */
export function isPortfolioRelevant(text: string): boolean {
  const keywords = Array.from(PORTFOLIO_KEYWORDS);
  for (let i = 0; i < keywords.length; i++) {
    if (text.includes(keywords[i])) return true;
  }
  return false;
}

// ─── 适配器接口 ───────────────────────────────────────────────────────────────

export interface SentimentModelAdapter {
  readonly modelSource: SentimentModelSource;
  analyze(text: string, sourceType?: string): Promise<EnhancedSentimentResult>;
}

// ─── 词典增强模型 ─────────────────────────────────────────────────────────────

/**
 * 增强版词典情绪模型（DictionaryModelAdapter）
 *
 * 相比原始词典法，增加：
 *  - 精细标签（强利好/弱利好/中性/弱利空/强利空/风险/传闻）
 *  - 置信度估算（基于信号强度和一致性）
 *  - 可读判断理由
 *  - 传闻检测
 *  - 高影响内容标记
 */
export class DictionaryModelAdapter implements SentimentModelAdapter {
  readonly modelSource: SentimentModelSource = 'dictionary';

  async analyze(text: string, sourceType?: string): Promise<EnhancedSentimentResult> {
    const strongPositiveHits = STRONG_POSITIVE_WORDS.filter((w) => text.includes(w));
    const weakPositiveHits = WEAK_POSITIVE_WORDS.filter((w) => text.includes(w));
    const strongNegativeHits = STRONG_NEGATIVE_WORDS.filter((w) => text.includes(w));
    const weakNegativeHits = WEAK_NEGATIVE_WORDS.filter((w) => text.includes(w));
    const riskHits = RISK_KEYWORDS.filter((w) => text.includes(w));
    const rumorHits = RUMOR_KEYWORDS.filter((w) => text.includes(w));

    const positiveSignals = [...strongPositiveHits, ...weakPositiveHits];
    const negativeSignals = [...strongNegativeHits, ...weakNegativeHits];

    const totalSignals =
      positiveSignals.length + negativeSignals.length + riskHits.length + rumorHits.length;

    const label = this.resolveLabel(
      strongPositiveHits.length,
      weakPositiveHits.length,
      strongNegativeHits.length,
      weakNegativeHits.length,
      riskHits.length,
      rumorHits.length,
      sourceType,
    );

    const confidence = this.estimateConfidence(
      label,
      totalSignals,
      strongPositiveHits.length,
      strongNegativeHits.length,
      riskHits.length,
      rumorHits.length,
    );

    const reasoning = this.buildReasoning(
      label,
      strongPositiveHits,
      weakPositiveHits,
      strongNegativeHits,
      weakNegativeHits,
      riskHits,
      rumorHits,
      sourceType,
    );

    // 高影响内容判定：有风险关键词 or 强信号 or 总信号数多
    const isHighImpact =
      riskHits.length > 0 ||
      strongNegativeHits.length > 0 ||
      strongPositiveHits.length >= 2 ||
      totalSignals >= 5;

    return {
      label,
      confidence,
      reasoning,
      secondaryAnalysis: isHighImpact,
      modelSource: 'dictionary',
      positiveSignals,
      negativeSignals,
      riskSignals: riskHits,
      rumorSignals: rumorHits,
    };
  }

  private resolveLabel(
    strongPos: number,
    weakPos: number,
    strongNeg: number,
    weakNeg: number,
    risk: number,
    rumor: number,
    sourceType?: string,
  ): FinancialSentimentLabel {
    // 风险优先判定
    if (risk >= 2 || (risk >= 1 && strongNeg >= 1)) return 'risk';

    // 传闻判定（传闻词多于实质性信号，且无强方向信号）
    if (rumor >= 2 && strongPos === 0 && strongNeg === 0) return 'rumor';

    const posScore = strongPos * 2 + weakPos;
    const negScore = strongNeg * 2 + weakNeg;

    if (posScore === 0 && negScore === 0) return 'neutral';

    const diff = posScore - negScore;
    const total = posScore + negScore;

    if (diff > 0) {
      // 正向：强利好（强信号多 or 净差值大）
      if (strongPos >= 2 || (strongPos >= 1 && diff >= 3) || diff / total >= 0.7) {
        return 'strong_positive';
      }
      return 'weak_positive';
    } else {
      // 负向
      if (risk >= 1) return 'risk';
      if (strongNeg >= 2 || (strongNeg >= 1 && diff <= -3) || (-diff) / total >= 0.7) {
        return 'strong_negative';
      }
      return 'weak_negative';
    }
  }

  private estimateConfidence(
    label: FinancialSentimentLabel,
    totalSignals: number,
    strongPos: number,
    strongNeg: number,
    risk: number,
    rumor: number,
  ): number {
    if (label === 'neutral') {
      // 无信号时中性置信度适中
      return totalSignals === 0 ? 0.6 : 0.5;
    }
    if (label === 'rumor') {
      // 传闻置信度偏低，因内容尚未证实
      return Math.min(0.7, 0.3 + rumor * 0.1);
    }
    if (label === 'risk') {
      return Math.min(0.95, 0.6 + risk * 0.1 + strongNeg * 0.05);
    }

    // 有强信号时置信度更高
    const base = 0.4;
    const signalBonus = Math.min(0.4, totalSignals * 0.06);
    const strongBonus = Math.min(0.2, (strongPos + strongNeg) * 0.1);
    return Math.min(0.9, base + signalBonus + strongBonus);
  }

  private buildReasoning(
    label: FinancialSentimentLabel,
    strongPos: string[],
    weakPos: string[],
    strongNeg: string[],
    weakNeg: string[],
    risk: string[],
    rumor: string[],
    sourceType?: string,
  ): string {
    const parts: string[] = [];

    const labelNameMap: Record<FinancialSentimentLabel, string> = {
      strong_positive: '强利好',
      weak_positive: '弱利好',
      neutral: '中性',
      weak_negative: '弱利空',
      strong_negative: '强利空',
      risk: '风险',
      rumor: '传闻',
    };
    parts.push(`判断为【${labelNameMap[label]}】。`);

    if (strongPos.length > 0) {
      parts.push(`强正面信号：${strongPos.slice(0, 3).join('、')}。`);
    }
    if (weakPos.length > 0) {
      parts.push(`正面信号：${weakPos.slice(0, 3).join('、')}。`);
    }
    if (strongNeg.length > 0) {
      parts.push(`强负面信号：${strongNeg.slice(0, 3).join('、')}。`);
    }
    if (weakNeg.length > 0) {
      parts.push(`负面信号：${weakNeg.slice(0, 3).join('、')}。`);
    }
    if (risk.length > 0) {
      parts.push(`风险信号：${risk.slice(0, 3).join('、')}。`);
    }
    if (rumor.length > 0) {
      parts.push(`传闻信号：${rumor.slice(0, 3).join('、')}，内容尚未得到证实。`);
    }
    if (strongPos.length === 0 && weakPos.length === 0 && strongNeg.length === 0 && weakNeg.length === 0 && risk.length === 0 && rumor.length === 0) {
      parts.push('未检测到明确情绪信号，依据文本特征判定为中性。');
    }
    if (sourceType === 'broker') {
      parts.push('来源为券商研报，专业性较高。');
    } else if (sourceType === 'regulatory') {
      parts.push('来源为监管机构公告，权威性较高。');
    }

    return parts.join(' ');
  }
}

// ─── LLM 适配器（双阶段：MiMo 双阶段分析）──────────────────────

/**
 * 环境变量配置：
 *
 * 【主力模型 — 用于所有内容的情绪初筛】
 *   PRIMARY_LLM_BASE_URL   默认 https://api.xiaomimimo.com/v1
 *   PRIMARY_LLM_MODEL      默认 mimo-v2.5-v
 *   PRIMARY_LLM_API_KEY    必填
 *
 * 【深度分析模型 — 仅用于高影响内容的二次分析】
 *   DEEP_LLM_BASE_URL      默认 https://api.xiaomimimo.com/v1
 *   DEEP_LLM_MODEL         默认 mimo-v2.5-v
 *   DEEP_LLM_API_KEY       必填
 *
 * 【向后兼容（已废弃）】
 *   LLM_BASE_URL / LLM_MODEL / LLM_API_KEY
 *   如果 PRIMARY_LLM_* 未设置，会回退到这组旧变量
 */

const PRIMARY_LLM_BASE_URL = process.env['PRIMARY_LLM_BASE_URL']
  ?? process.env['LLM_BASE_URL']
  ?? 'https://api.xiaomimimo.com/v1';
const PRIMARY_LLM_MODEL    = process.env['PRIMARY_LLM_MODEL']
  ?? process.env['LLM_MODEL']
  ?? 'mimo-v2.5-pro';
const PRIMARY_LLM_API_KEY  = process.env['PRIMARY_LLM_API_KEY']
  ?? process.env['LLM_API_KEY']
  ?? '';

const DEEP_LLM_BASE_URL = process.env['DEEP_LLM_BASE_URL']
  ?? 'https://api.xiaomimimo.com/v1';
const DEEP_LLM_MODEL    = process.env['DEEP_LLM_MODEL']
  ?? 'mimo-v2.5-v';
const DEEP_LLM_API_KEY  = process.env['DEEP_LLM_API_KEY'] ?? '';

/** OpenAI 兼容接口返回的结构化情绪分析结果（用于 JSON mode 解析） */
interface LLMSentimentOutput {
  label: FinancialSentimentLabel;
  confidence: number;
  reasoning: string;
  positiveSignals: string[];
  negativeSignals: string[];
  riskSignals: string[];
  rumorSignals: string[];
}

const PRIMARY_SYSTEM_PROMPT = `你是一位中国金融市场舆情分析师。快速判断给定文本的金融情绪，输出严格 JSON，不要包含额外文字：
{
  "label": "strong_positive|weak_positive|neutral|weak_negative|strong_negative|risk|rumor",
  "confidence": 0.0~1.0,
  "reasoning": "一句话判断理由（中文）",
  "positiveSignals": ["正面关键词"],
  "negativeSignals": ["负面关键词"],
  "riskSignals": ["风险关键词"],
  "rumorSignals": ["传闻关键词"]
}
标签：strong_positive=强利好, weak_positive=弱利好, neutral=中性, weak_negative=弱利空, strong_negative=强利空, risk=风险事件, rumor=未证实传闻`;

const DEEP_SYSTEM_PROMPT = `你是一位资深中国金融市场策略分析师。请对以下高影响舆情内容进行深度分析，输出严格 JSON，不要包含额外文字：
{
  "label": "strong_positive|weak_positive|neutral|weak_negative|strong_negative|risk|rumor",
  "confidence": 0.0~1.0,
  "reasoning": "深度分析理由（2-4句话，包含因果逻辑和市场影响判断）",
  "positiveSignals": ["正面关键词"],
  "negativeSignals": ["负面关键词"],
  "riskSignals": ["风险关键词"],
  "rumorSignals": ["传闻关键词"],
  "marketImpact": "对相关板块/个股的潜在影响分析",
  "riskLevel": "low|medium|high|critical",
  "actionSuggestion": "建议关注方向"
}
要求：结合中国金融市场特点，分析事件传导链和潜在连锁反应，评估实际影响程度。`;

/** 通用 LLM 调用（带全局限速） */
// ── Rate Limiter: 控制并发和请求间隔，避免 429 ──
const LLM_CONCURRENCY = 3;       // 最多 3 个并发请求
const LLM_MIN_INTERVAL_MS = 300; // 每个请求最少间隔 300ms
let llmActiveCount = 0;
let llmLastRequestTime = 0;

async function callLLM(
  baseUrl: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
): Promise<LLMSentimentOutput> {
  // 等待并发槽位
  while (llmActiveCount >= LLM_CONCURRENCY) {
    await new Promise(r => setTimeout(r, 100));
  }
  // 保证最小间隔
  const elapsed = Date.now() - llmLastRequestTime;
  if (elapsed < LLM_MIN_INTERVAL_MS) {
    await new Promise(r => setTimeout(r, LLM_MIN_INTERVAL_MS - elapsed));
  }

  llmActiveCount++;
  llmLastRequestTime = Date.now();
  try {
    const response = await axios.post<{
    choices: { message: { content: string } }[];
  }>(
    `${baseUrl}/chat/completions`,
    {
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 20000,
    },
  );

  const raw = response.data.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw);
  } finally {
    llmActiveCount--;
  }
}

/** 将 LLM 输出归一化为标准结果 */
function normalizeLLMOutput(parsed: LLMSentimentOutput, source: SentimentModelSource): EnhancedSentimentResult {
  const validLabels: FinancialSentimentLabel[] = [
    'strong_positive', 'weak_positive', 'neutral',
    'weak_negative', 'strong_negative', 'risk', 'rumor',
  ];
  const label: FinancialSentimentLabel = validLabels.includes(parsed.label)
    ? parsed.label
    : 'neutral';

  const isHighImpact =
    (parsed.riskSignals?.length ?? 0) > 0 ||
    label === 'risk' ||
    label === 'strong_negative' ||
    label === 'strong_positive';

  return {
    label,
    confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.7)),
    reasoning: parsed.reasoning ?? '',
    secondaryAnalysis: isHighImpact,
    modelSource: source,
    positiveSignals: parsed.positiveSignals ?? [],
    negativeSignals: parsed.negativeSignals ?? [],
    riskSignals: parsed.riskSignals ?? [],
    rumorSignals: parsed.rumorSignals ?? [],
  };
}

/**
 * TwoStageLLMAdapter — MiMo 双阶段分析
 *
 * Stage 1（MiMo）：所有内容走主力模型，快速情绪分类
 * Stage 2（MiMo）：仅当 Stage 1 标记 secondaryAnalysis=true 时触发
 */
export class TwoStageLLMAdapter implements SentimentModelAdapter {
  readonly modelSource: SentimentModelSource = 'llm';
  private fallback = new DictionaryModelAdapter();

  async analyze(text: string, sourceType?: string): Promise<EnhancedSentimentResult> {
    // 成本控制：非持仓相关文章直接走词典法
    if (LLM_PORTFOLIO_ONLY && !isPortfolioRelevant(text)) {
      return this.fallback.analyze(text, sourceType);
    }

    const userContent = sourceType
      ? `[来源类型: ${sourceType}]\\n${text.slice(0, 1500)}`
      : text.slice(0, 1500);

    // ── Stage 1: 主力模型初筛 ──
    let primaryResult: EnhancedSentimentResult;
    try {
      const parsed = await callLLM(
        PRIMARY_LLM_BASE_URL, PRIMARY_LLM_MODEL, PRIMARY_LLM_API_KEY,
        PRIMARY_SYSTEM_PROMPT, userContent, 512,
      );
      primaryResult = normalizeLLMOutput(parsed, 'llm-primary');
      console.log(`[TwoStageLLM] Primary(${PRIMARY_LLM_MODEL}): ${primaryResult.label} (${primaryResult.confidence}) secondary=${primaryResult.secondaryAnalysis}`);
    } catch (err) {
      console.warn('[TwoStageLLM] Primary LLM failed, falling back to dictionary:', err instanceof Error ? err.message : err);
      return this.fallback.analyze(text, sourceType);
    }

    // ── Stage 2: 高影响内容深度分析 ──
    // 置信度 >= 0.85 时初筛结果已足够可靠，跳过深度分析省 token
    if (primaryResult.secondaryAnalysis && DEEP_LLM_API_KEY && primaryResult.confidence < 0.85) {
      try {
        const deepContent = userContent + `\n\n[初筛结果] 情绪=${primaryResult.label}, 置信度=${primaryResult.confidence}, 理由=${primaryResult.reasoning}`;
        const parsed = await callLLM(
          DEEP_LLM_BASE_URL, DEEP_LLM_MODEL, DEEP_LLM_API_KEY,
          DEEP_SYSTEM_PROMPT, deepContent, 1024,
        );
        const deepResult = normalizeLLMOutput(parsed, 'llm-deep');
        // 深度分析覆盖初筛结果，保留初筛信号
        deepResult.positiveSignals = Array.from(new Set([...primaryResult.positiveSignals, ...deepResult.positiveSignals]));
        deepResult.negativeSignals = Array.from(new Set([...primaryResult.negativeSignals, ...deepResult.negativeSignals]));
        deepResult.secondaryAnalysis = true;
        console.log(`[TwoStageLLM] Deep(${DEEP_LLM_MODEL}): ${deepResult.label} (${deepResult.confidence})`);
        return deepResult;
      } catch (err) {
        console.warn('[TwoStageLLM] Deep LLM failed, using primary result:', err instanceof Error ? err.message : err);
        return primaryResult;
      }
    }

    return primaryResult;
  }

  /**
   * 批量分析：把多条内容合并成一个 prompt，一次 LLM 调用搞定
   * 比逐条分析快 10x+，且大幅减少 API 调用次数
   */
  async analyzeBatch(items: Array<{ text: string; sourceType?: string }>): Promise<EnhancedSentimentResult[]> {
    if (items.length === 0) return [];
    if (items.length === 1) return [await this.analyze(items[0].text, items[0].sourceType)];

    // 成本控制：将非持仓相关文章分流到词典法
    if (LLM_PORTFOLIO_ONLY) {
      const results: EnhancedSentimentResult[] = new Array(items.length);
      const llmItems: Array<{ idx: number; text: string; sourceType?: string }> = [];

      for (let i = 0; i < items.length; i++) {
        if (isPortfolioRelevant(items[i].text + ' ' + (items[i].sourceType ?? ''))) {
          llmItems.push({ idx: i, ...items[i] });
        } else {
          results[i] = await this.fallback.analyze(items[i].text, items[i].sourceType);
        }
      }

      // 仅持仓相关文章走 LLM 批量分析
      // 先用词典法预筛：中性且置信度 >= 0.6 的直接跳过 LLM
      if (llmItems.length > 0) {
        const finalLlmItems: typeof llmItems = [];
        let skippedByDict = 0;
        for (const item of llmItems) {
          const dictResult = await this.fallback.analyze(item.text, item.sourceType);
          if (dictResult.label === 'neutral' && dictResult.confidence >= 0.6) {
            results[item.idx] = dictResult;
            skippedByDict++;
          } else {
            finalLlmItems.push(item);
          }
        }
        if (skippedByDict > 0) {
          console.log(`[TwoStageLLM] Dict pre-filter: skipped ${skippedByDict}/${llmItems.length} neutral articles`);
        }
        if (finalLlmItems.length > 0) {
          console.log(`[TwoStageLLM] Batch filter: ${finalLlmItems.length}/${items.length} articles need LLM`);
          const llmResults = await this.analyzeOneBatch(finalLlmItems.map(i => ({ text: i.text, sourceType: i.sourceType })));
          for (let i = 0; i < finalLlmItems.length; i++) {
            results[finalLlmItems[i].idx] = llmResults[i] ?? await this.fallback.analyze(finalLlmItems[i].text, finalLlmItems[i].sourceType);
          }
        } else {
          console.log(`[TwoStageLLM] Batch filter: all ${llmItems.length} articles handled by dictionary`);
        }
      } else {
        console.log(`[TwoStageLLM] Batch filter: 0/${items.length} articles relevant, all dictionary`);
      }

      return results;
    }

    // 每批最多 20 条，减少 LLM 调用次数（原来 5 条太保守）
    const BATCH_SIZE = 20;
    const results: EnhancedSentimentResult[] = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await this.analyzeOneBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async analyzeOneBatch(batch: Array<{ text: string; sourceType?: string }>): Promise<EnhancedSentimentResult[]> {
    // 构建批量 prompt
    const numbered = batch.map((item, idx) =>
      `[${idx + 1}] ${item.sourceType ? `(${item.sourceType})` : ''} ${item.text.slice(0, 300)}`
    ).join('\n');

    const batchPrompt = `请对以下 ${batch.length} 条金融文本逐条分析情绪，返回 JSON 数组，每个元素格式同单条分析。
文本列表：
${numbered}`;

    try {
      const response = await axios.post<{ choices: { message: { content: string } }[] }>(
        `${PRIMARY_LLM_BASE_URL}/chat/completions`,
        {
          model: PRIMARY_LLM_MODEL,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PRIMARY_SYSTEM_PROMPT + `\n\n批量分析模式：返回 {"results": [...]} 数组，每个元素包含 label, confidence, reasoning, positiveSignals, negativeSignals, riskSignals, rumorSignals, secondaryAnalysis。` },
            { role: 'user', content: batchPrompt },
          ],
          temperature: 0.1,
          max_tokens: 6144,
        },
        { headers: { Authorization: `Bearer ${PRIMARY_LLM_API_KEY}` }, timeout: 60000 },
      );

      const raw = response.data.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);
      const results: LLMSentimentOutput[] = parsed.results || parsed;

      if (!Array.isArray(results)) {
        throw new Error('Batch response is not an array');
      }

      return results.map((r, idx) => {
        const normalized = normalizeLLMOutput(r || {}, 'llm-primary');
        console.log(`[TwoStageLLM] Batch[${idx}]: ${normalized.label} (${normalized.confidence})`);
        return normalized;
      });
    } catch (err) {
      console.warn('[TwoStageLLM] Batch analysis failed, falling back to individual:', err instanceof Error ? err.message : err);
      // 降级：逐条分析
      const fallbackResults: EnhancedSentimentResult[] = [];
      for (const item of batch) {
        fallbackResults.push(await this.analyze(item.text, item.sourceType));
      }
      return fallbackResults;
    }
  }
}

// ─── 情绪模型 Pipeline ────────────────────────────────────────────────────────

const _primaryKey = PRIMARY_LLM_API_KEY;
const _activeAdapter: SentimentModelAdapter = _primaryKey
  ? new TwoStageLLMAdapter()
  : new DictionaryModelAdapter();

console.log(`[FinancialSentiment] Active adapter: ${_activeAdapter.modelSource}${_primaryKey ? ` (primary=${PRIMARY_LLM_MODEL}, deep=${DEEP_LLM_MODEL})` : ''}`);

/**
 * 分析金融文本情绪（增强版）
 *
 * @param text       待分析文本（标题 + 正文拼接）
 * @param sourceType 来源类型，影响置信度修正和理由生成
 */
export async function analyzeFinancialSentiment(
  text: string,
  sourceType?: string,
): Promise<EnhancedSentimentResult> {
  return _activeAdapter.analyze(text, sourceType);
}

/**
 * 批量分析金融文本情绪（合并 prompt，减少 API 调用）
 * 仅当活跃适配器为 TwoStageLLMAdapter 时生效，否则降级为逐条分析
 */
export async function analyzeFinancialSentimentBatch(
  items: Array<{ text: string; sourceType?: string }>,
): Promise<EnhancedSentimentResult[]> {
  if (_activeAdapter instanceof TwoStageLLMAdapter) {
    return _activeAdapter.analyzeBatch(items);
  }
  // 降级：逐条分析
  const results: EnhancedSentimentResult[] = [];
  for (const item of items) {
    results.push(await _activeAdapter.analyze(item.text, item.sourceType));
  }
  return results;
}

/**
 * 将精细情绪标签映射回三分类标签（兼容现有 SentimentLabel）
 */
export function toBaseSentimentLabel(
  label: FinancialSentimentLabel,
): 'positive' | 'neutral' | 'negative' {
  switch (label) {
    case 'strong_positive':
    case 'weak_positive':
      return 'positive';
    case 'strong_negative':
    case 'weak_negative':
    case 'risk':
      return 'negative';
    case 'neutral':
    case 'rumor':
    default:
      return 'neutral';
  }
}
