import type { ContentEntity, SentimentLabel, RiskLevel } from '../types.js';

const POSITIVE_WORDS = [
  '利好', '涨停', '大涨', '暴涨', '反弹', '突破', '创新高', '新高',
  '上涨', '走强', '飙升', '拉升', '翻红', '回暖', '复苏', '增长',
  '超预期', '提振', '看好', '看多', '牛市', '红盘', '放量上涨',
  '底部', '企稳', '止跌', '向好', '改善', '强势', '领涨',
  '净流入', '加仓', '增持', '买入', '推荐', '利多',
  '降息', '降准', '宽松', '刺激', '支持', '扶持', '补贴',
  '盈利', '分红', '回购', '重组', '并购', '合作',
  '突破关口', '站上', '攀升', '走高', '高开', '收涨',
];

const NEGATIVE_WORDS = [
  '利空', '跌停', '大跌', '暴跌', '崩盘', '闪崩', '跳水', '重挫',
  '下跌', '走弱', '下挫', '杀跌', '破位', '新低', '创新低',
  '恐慌', '恐惧', '担忧', '悲观', '看空', '看跌', '熊市',
  '暴雷', '爆雷', '违约', '破产', '清盘', '跑路', '失联',
  '亏损', '减持', '抛售', '出逃', '撤离', '净流出', '卖出',
  '监管', '处罚', '罚款', '整顿', '叫停', '警告', '约谈',
  '做空', '空头', '沽空', '质押爆仓', '平仓', '强平',
  '风险', '危机', '泡沫', '过热', '滞胀', '衰退', '萧条',
  '烂尾', '维权', '投诉', '欺诈', '造假', '操纵',
  '断崖', '腰斩', '绿盘', '低开', '收跌', '放量下跌',
];

const RISK_KEYWORDS = [
  '暴雷', '爆雷', '违约', '破产', '跑路', '失联', '崩盘',
  '做空', '造假', '欺诈', '操纵', '清盘', '退市',
  '危机', '恐慌', '闪崩', '质押爆仓', '强平', '断崖',
];

const COMPANY_PATTERNS = [
  '比亚迪', '宁德时代', '贵州茅台', '中信证券', '招商银行', '工商银行',
  '中国平安', '腾讯', '阿里巴巴', '京东', '美团', '拼多多', '百度',
  '华为', '小米', '字节跳动', '蚂蚁集团', '恒大', '碧桂园', '万科',
  '中芯国际', '海康威视', '迈瑞医疗', '宁波银行', '三一重工',
  '隆基绿能', '阳光电源', '通威股份', '中国石油', '中国石化',
  '国泰君安', '海通证券', '广发证券', '华泰证券', '东方财富',
];

const INDEX_PATTERNS = [
  '上证指数', '上证综指', '沪指', '沪深300', '创业板', '创业板指',
  '科创50', '中证500', '中证1000', '恒生指数', '恒指',
  '纳斯达克', '纳指', '道琼斯', '道指', '标普500',
  '深证成指', '深成指', '恒生科技', 'A股', '港股', '美股',
];

const INDUSTRY_PATTERNS = [
  '半导体', '芯片', '新能源', '光伏', '锂电池', '储能',
  '人工智能', 'AI', '大模型', '算力', '信创', '国产替代',
  '房地产', '楼市', '医药', '医疗', '创新药', '中药',
  '白酒', '消费', '汽车', '新能源车', '充电桩',
  '银行', '保险', '券商', '证券', '基金',
  '军工', '国防', '农业', '稀土', '黄金', '石油',
  '环保', '碳中和', '电力', '煤炭', '天然气',
];

export interface SentimentResult {
  score: number;
  label: SentimentLabel;
  riskLevel: RiskLevel;
  entities: ContentEntity[];
  positiveHits: string[];
  negativeHits: string[];
  riskHits: string[];
}

export function analyzeSentiment(text: string): SentimentResult {
  const positiveHits: string[] = [];
  const negativeHits: string[] = [];
  const riskHits: string[] = [];

  for (const word of POSITIVE_WORDS) {
    if (text.includes(word)) positiveHits.push(word);
  }
  for (const word of NEGATIVE_WORDS) {
    if (text.includes(word)) negativeHits.push(word);
  }
  for (const word of RISK_KEYWORDS) {
    if (text.includes(word)) riskHits.push(word);
  }

  const posCount = positiveHits.length;
  const negCount = negativeHits.length;
  const total = posCount + negCount;

  let score: number;
  if (total === 0) {
    score = 0;
  } else {
    score = (posCount - negCount) / total;
    score = Math.max(-1, Math.min(1, score));
  }

  const label: SentimentLabel =
    score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';

  let riskLevel: RiskLevel;
  if (riskHits.length >= 3) {
    riskLevel = 'critical';
  } else if (riskHits.length >= 2 || (negCount >= 3 && riskHits.length >= 1)) {
    riskLevel = 'high';
  } else if (negCount >= 2 || riskHits.length >= 1) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  const entities: ContentEntity[] = [];
  for (const name of COMPANY_PATTERNS) {
    if (text.includes(name)) entities.push({ name, type: 'company' });
  }
  for (const name of INDEX_PATTERNS) {
    if (text.includes(name)) entities.push({ name, type: 'index' });
  }
  for (const name of INDUSTRY_PATTERNS) {
    if (text.includes(name)) entities.push({ name, type: 'industry' });
  }

  const seen = new Set<string>();
  const uniqueEntities = entities.filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });

  return {
    score: Math.round(score * 100) / 100,
    label,
    riskLevel,
    entities: uniqueEntities.slice(0, 10),
    positiveHits,
    negativeHits,
    riskHits,
  };
}
