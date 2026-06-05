/**
 * T011 金融语义情绪模型适配层
 *
 * 架构：
 *   SentimentModelAdapter（抽象接口）
 *     ├── DictionaryModelAdapter  —— 增强版词典法（默认 baseline）
 *     └── LLMModelAdapter         —— 大模型适配器（预留，需配置 API Key 后启用）
 *
 * 高影响内容（风险级 >= high 或信号数 >= 5）会被标记 secondaryAnalysis=true，
 * 调用方可选择触发额外处理。
 */

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

// ─── LLM 适配器（预留存根）────────────────────────────────────────────────────

/**
 * LLMModelAdapter — 大模型分析适配器（预留，未启用）
 *
 * 当配置 LLM_API_KEY 环境变量后可启用。目前回落到 DictionaryModelAdapter。
 * 接入时只需替换此类的 analyze 实现，其余调用链不变。
 */
export class LLMModelAdapter implements SentimentModelAdapter {
  readonly modelSource: SentimentModelSource = 'llm';
  private fallback = new DictionaryModelAdapter();

  async analyze(text: string, sourceType?: string): Promise<EnhancedSentimentResult> {
    // TODO: 当 LLM_API_KEY 配置后，发起 API 请求并解析结构化输出。
    // 目前回落到词典模型，并标记 modelSource 为 dictionary。
    const result = await this.fallback.analyze(text, sourceType);
    return result;
  }
}

// ─── 情绪模型 Pipeline ────────────────────────────────────────────────────────

const _llmApiKey = process.env['LLM_API_KEY'];
const _activeAdapter: SentimentModelAdapter = _llmApiKey
  ? new LLMModelAdapter()
  : new DictionaryModelAdapter();

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
