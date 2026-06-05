/**
 * T012 结构化事件识别服务
 *
 * 基于关键词模式匹配，将非结构化舆情文本识别为以下金融事件类型：
 *   - policy_change        政策变化
 *   - earnings_forecast    业绩预告
 *   - shareholding_change  增减持
 *   - merger_acquisition   并购重组
 *   - regulatory_penalty   监管处罚
 *   - debt_default         债务违约
 *   - industry_prosperity  产业景气变化
 *   - rating_change        研报评级变化
 *
 * 每种事件类型输出：类型、影响方向、置信度、触发词、关联主体、摘要。
 */

import type {
  FinancialEventType,
  EventImpactDirection,
  StructuredEvent,
} from '../types.js';

// ─── 事件模式定义 ─────────────────────────────────────────────────────────────

interface EventPattern {
  type: FinancialEventType;
  /** 正面影响触发词 */
  positiveKeywords: string[];
  /** 负面影响触发词 */
  negativeKeywords: string[];
  /** 中性/模糊触发词（方向uncertain） */
  neutralKeywords: string[];
  /** 最低置信度阈值（命中至少这么多词才输出事件） */
  minHits: number;
  /** 简短事件类型描述（用于生成 summary） */
  label: string;
}

const EVENT_PATTERNS: EventPattern[] = [
  // ── 政策变化 ──────────────────────────────────────────────────────────────
  {
    type: 'policy_change',
    label: '政策变化',
    positiveKeywords: [
      '降息', '降准', '宽松', '刺激政策', '财政补贴', '税收优惠', '政策支持', '政策红利',
      '扶持政策', '利好政策', '放开', '解禁', '松绑', '减税', '退税', '专项债',
      '政策利好', '新政', '改革开放', '碳中和政策', '绿色债券', '产业政策',
    ],
    negativeKeywords: [
      '加息', '收紧', '限制', '禁止', '叫停', '整顿', '清退', '整改',
      '监管趋严', '政策收紧', '管控', '约束', '限额', '不得', '严禁',
    ],
    neutralKeywords: [
      '政策', '新规', '办法', '条例', '规定', '指引', '通知', '意见',
      '征求意见', '改革方案', '行动计划', '指导意见', '实施细则',
    ],
    minHits: 1,
  },

  // ── 业绩预告 ──────────────────────────────────────────────────────────────
  {
    type: 'earnings_forecast',
    label: '业绩预告',
    positiveKeywords: [
      '业绩预增', '净利润增长', '营收增长', '超预期', '大幅增长', '净利大增',
      '高增长', '业绩高增', '盈利大幅增加', '预计盈利', '业绩亮眼',
      '净利润同比增长', '营业收入增长', '利润创历史新高',
    ],
    negativeKeywords: [
      '业绩预减', '净利润下降', '亏损', '大幅亏损', '业绩下滑', '净利下降',
      '收入下降', '营收下滑', '盈利预警', '业绩不及预期', '利润缩水',
      '净亏损', '亏损扩大', '业绩暴雷', '业绩大幅下滑',
    ],
    neutralKeywords: [
      '业绩预告', '业绩快报', '年报', '半年报', '季报', '一季报', '三季报',
      '利润', '营业收入', 'EPS', '每股收益', '净利润', '扣非净利润',
    ],
    minHits: 1,
  },

  // ── 增减持 ────────────────────────────────────────────────────────────────
  {
    type: 'shareholding_change',
    label: '增减持',
    positiveKeywords: [
      '增持', '大举增持', '回购', '股票回购', '董事增持', '高管增持',
      '控股股东增持', '大股东增持', '举牌', '大幅增持', '增持计划',
    ],
    negativeKeywords: [
      '减持', '大幅减持', '清仓', '高管减持', '控股股东减持', '大股东减持',
      '减持计划', '套现', '抛售', '强制减持', '集中减持',
    ],
    neutralKeywords: [
      '持股', '股权变动', '股东', '持仓', '股份', '解禁', '限售股',
    ],
    minHits: 1,
  },

  // ── 并购重组 ──────────────────────────────────────────────────────────────
  {
    type: 'merger_acquisition',
    label: '并购重组',
    positiveKeywords: [
      '并购', '重组', '合并', '收购', '战略合作', '股权收购', '资产重组',
      '整合', '注入', '装入', '借壳', '反向并购', '强强联合',
    ],
    negativeKeywords: [
      '并购失败', '重组失败', '收购终止', '并购受阻', '监管否决',
    ],
    neutralKeywords: [
      '重大资产重组', '重大事项', '重大合同', '收购草案', '重组方案',
      '资产注入', '定向增发', '发行股份购买资产',
    ],
    minHits: 1,
  },

  // ── 监管处罚 ──────────────────────────────────────────────────────────────
  {
    type: 'regulatory_penalty',
    label: '监管处罚',
    positiveKeywords: [],
    negativeKeywords: [
      '罚款', '处罚', '行政处罚', '立案调查', '被调查', '责令整改',
      '吊销', '暂停', '警告', '谴责', '通报批评', '监管函',
      '问询函', '处罚决定', '违规', '违法', '行政监管措施',
      '证监会', '银保监', '市场监管', '反垄断调查', '刑事调查',
    ],
    neutralKeywords: [
      '监管', '合规', '整改', '检查', '核查',
    ],
    minHits: 1,
  },

  // ── 债务违约 ──────────────────────────────────────────────────────────────
  {
    type: 'debt_default',
    label: '债务违约',
    positiveKeywords: [
      '债务重组成功', '化债', '展期协议达成', '还款计划落实',
    ],
    negativeKeywords: [
      '违约', '债务违约', '债券违约', '无法偿还', '到期未还', '暴雷',
      '爆雷', '流动性危机', '债务危机', '破产', '清算', '资不抵债',
      '财务危机', '信用违约', '兑付危机', '无力偿债', '停牌核查',
    ],
    neutralKeywords: [
      '债务', '债券', '偿债', '到期', '展期', '信用评级', '评级下调',
    ],
    minHits: 1,
  },

  // ── 产业景气变化 ──────────────────────────────────────────────────────────
  {
    type: 'industry_prosperity',
    label: '产业景气变化',
    positiveKeywords: [
      '景气度回升', '产业复苏', '需求回暖', '订单增加', '产能扩张',
      '行业回暖', '供需改善', '价格上涨', '涨价', '量价齐升',
      '出货量增加', '产量创新高', '景气上行', '周期向上',
    ],
    negativeKeywords: [
      '景气度下行', '产业下行', '需求疲软', '订单减少', '产能过剩',
      '行业下滑', '供需失衡', '价格下跌', '降价', '量价齐跌',
      '出货量减少', '库存高企', '景气下行', '周期向下',
    ],
    neutralKeywords: [
      'PMI', '采购经理指数', '景气指数', '行业数据', '产量', '开工率',
      '库存', '产能利用率', '出货量', '订单量', '行业趋势',
    ],
    minHits: 1,
  },

  // ── 研报评级变化 ──────────────────────────────────────────────────────────
  {
    type: 'rating_change',
    label: '研报评级变化',
    positiveKeywords: [
      '上调评级', '调升评级', '买入评级', '强烈推荐', '增持评级',
      '目标价上调', '上调目标价', '首次覆盖给予买入', '维持买入',
      '看好', '推荐买入', '超配', '强买', '跑赢大市',
    ],
    negativeKeywords: [
      '下调评级', '调降评级', '卖出评级', '减持评级', '中性评级',
      '目标价下调', '下调目标价', '撤销评级', '停止覆盖',
      '谨慎推荐', '回避', '低配', '跑输大市',
    ],
    neutralKeywords: [
      '研报', '评级', '目标价', '券商', '分析师', '覆盖', '维持评级',
    ],
    minHits: 1,
  },
];

// ─── 辅助：提取关联主体 ───────────────────────────────────────────────────────

const COMPANY_NAMES = [
  '比亚迪', '宁德时代', '贵州茅台', '中信证券', '招商银行', '工商银行',
  '中国平安', '腾讯', '阿里巴巴', '京东', '美团', '拼多多', '百度',
  '华为', '小米', '字节跳动', '蚂蚁集团', '恒大', '碧桂园', '万科',
  '中芯国际', '海康威视', '迈瑞医疗', '宁波银行', '三一重工',
  '隆基绿能', '阳光电源', '通威股份', '中国石油', '中国石化',
  '国泰君安', '海通证券', '广发证券', '华泰证券', '东方财富',
  '格力电器', '美的集团', '海尔智家', '顺丰控股', '中通快递',
];

const INDUSTRY_NAMES = [
  '半导体', '芯片', '新能源', '光伏', '锂电池', '储能', '人工智能', 'AI',
  '大模型', '算力', '信创', '房地产', '楼市', '医药', '医疗', '创新药',
  '白酒', '消费', '汽车', '新能源车', '银行', '保险', '券商', '军工',
  '农业', '稀土', '黄金', '石油', '环保', '碳中和', '电力', '煤炭',
];

function extractSubjects(text: string): string[] {
  const found: string[] = [];
  for (const name of COMPANY_NAMES) {
    if (text.includes(name)) found.push(name);
  }
  for (const name of INDUSTRY_NAMES) {
    if (text.includes(name)) found.push(name);
  }
  return [...new Set(found)].slice(0, 5); // 最多返回 5 个主体
}

// ─── 核心识别逻辑 ─────────────────────────────────────────────────────────────

function matchPattern(
  text: string,
  pattern: EventPattern,
): { hits: string[]; direction: EventImpactDirection; confidence: number } | null {
  const positiveHits = pattern.positiveKeywords.filter((w) => text.includes(w));
  const negativeHits = pattern.negativeKeywords.filter((w) => text.includes(w));
  const neutralHits = pattern.neutralKeywords.filter((w) => text.includes(w));

  const allHits = [...positiveHits, ...negativeHits, ...neutralHits];
  if (allHits.length < pattern.minHits) return null;

  // 主方向判定
  let direction: EventImpactDirection;
  if (positiveHits.length > 0 && negativeHits.length === 0) {
    direction = 'positive';
  } else if (negativeHits.length > 0 && positiveHits.length === 0) {
    direction = 'negative';
  } else if (positiveHits.length > 0 && negativeHits.length > 0) {
    // 混合信号，以更多者为主，标记 uncertain
    direction = 'uncertain';
  } else {
    direction = 'neutral';
  }

  // 置信度：强信号（正/负）hit 越多越高；仅中性词命中则较低
  const strongHits = positiveHits.length + negativeHits.length;
  let confidence: number;
  if (strongHits >= 3) confidence = 0.90;
  else if (strongHits === 2) confidence = 0.80;
  else if (strongHits === 1) confidence = 0.70;
  else if (neutralHits.length >= 2) confidence = 0.55;
  else confidence = 0.45;

  return { hits: allHits, direction, confidence };
}

/**
 * 对一段文本识别结构化金融事件列表。
 * @param text 标题 + 内容拼接文本
 * @returns 识别出的事件列表（可为空）
 */
export function recognizeEvents(text: string): StructuredEvent[] {
  const events: StructuredEvent[] = [];
  const subjects = extractSubjects(text);

  for (const pattern of EVENT_PATTERNS) {
    const match = matchPattern(text, pattern);
    if (!match) continue;

    // 构建简洁 summary
    const directionLabel: Record<EventImpactDirection, string> = {
      positive: '正面',
      negative: '负面',
      neutral: '中性',
      uncertain: '不确定',
    };
    const summary = `${pattern.label}（${directionLabel[match.direction]}影响）：命中词「${match.hits.slice(0, 3).join('、')}」`;

    events.push({
      type: pattern.type,
      impactDirection: match.direction,
      confidence: match.confidence,
      triggers: match.hits,
      subjects,
      summary,
    });
  }

  // 按置信度降序返回
  return events.sort((a, b) => b.confidence - a.confidence);
}
