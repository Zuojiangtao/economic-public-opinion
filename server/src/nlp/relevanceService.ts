/**
 * T013 主体相关度评分服务
 *
 * 判断一条舆情内容对某个行业/板块的真实相关性，降低关键词误伤。
 *
 * 评分维度：
 *   - 标题命中（0-40）：关键词出现在标题中，说明该主体是核心议题
 *   - 正文频次（0-30）：关键词在正文中出现次数，每次 +5，上限 30
 *   - 实体命中（0-20）：NLP 实体列表中存在与行业匹配的实体
 *   - 首段命中（0-10）：关键词出现在正文前 200 字，说明主题靠前
 *
 * 输出：
 *   - relevanceScore  0-100，越高越相关
 *   - isCoreSubject   true if score >= 60
 *   - isMentionOnly   true if score < 30
 *   - subjectType     company | industry | index | macro | commodity
 *   - impactCycle     short_term | long_term | unknown
 *   - impactDirectionClear  基于事件识别结果判断影响方向是否明确
 *   - matchedTerms    命中的词列表
 */

import type { ContentItem, IndustryMapping, StructuredEvent } from '../types.js';

// ─── 主体类型 ──────────────────────────────────────────────────────────────────

export type SubjectType = 'company' | 'industry' | 'index' | 'macro' | 'commodity';
export type ImpactCycle = 'short_term' | 'long_term' | 'unknown';

export interface IndustryRelevance {
  industryId: string;
  industryName: string;
  /** 相关度得分 0-100 */
  relevanceScore: number;
  /** 主体类型 */
  subjectType: SubjectType;
  /** 是否为核心主体（得分 >= 60，内容主要议题是该主体） */
  isCoreSubject: boolean;
  /** 是否只是顺带提及（得分 < 30，仅偶发出现） */
  isMentionOnly: boolean;
  /** 影响方向是否明确（基于事件识别结果） */
  impactDirectionClear: boolean;
  /** 影响周期 */
  impactCycle: ImpactCycle;
  /** 命中的关键词列表 */
  matchedTerms: string[];
}

// ─── 信号词典 ─────────────────────────────────────────────────────────────────

/** 短期交易性信号词 */
const SHORT_TERM_SIGNALS = [
  '短期', '近期', '本周', '本月', '今日', '今天', '涨停', '跌停',
  '炒作', '主力', '游资', '资金异动', '突破', '消息面', '题材',
  '概念炒作', '热点', '板块轮动', '短线', '超短', '日内',
];

/** 中长期基本面信号词 */
const LONG_TERM_SIGNALS = [
  '长期', '中长期', '未来', '趋势', '战略', '政策方向', '基本面',
  '行业格局', '规划', '布局', '发展路径', '产业链', '结构性',
  '十四五', '十五五', '年规划', '长远', '战略布局', '产业升级',
];

/** 宏观经济信号词 */
const MACRO_TERMS = [
  'gdp', 'cpi', 'ppi', '货币政策', '财政政策', '利率', '通胀', '通缩',
  '宏观经济', '降息', '降准', '加息', '联储', '美联储', '央行',
  '经济增速', '消费数据', '工业产值', '外汇储备', '贸易顺差', '贸易逆差',
];

/** 大宗商品信号词 */
const COMMODITY_TERMS = [
  '原油', '金价', '铜价', '铁矿石', '煤炭价格', '天然气', '大豆', '玉米',
  '期货', '现货', '商品', '贵金属', '螺纹钢', '铝价', '锂价', '镍价',
  '石油', '布伦特', 'wti', '能源价格',
];

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function containsAny(text: string, terms: string[]): boolean {
  for (const t of terms) {
    if (text.includes(t)) return true;
  }
  return false;
}

function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(term, pos)) !== -1) {
    count++;
    pos += term.length;
  }
  return count;
}

// ─── 构建行业词项集合 ──────────────────────────────────────────────────────────

interface TermEntry {
  term: string;
  /** 词来源，决定主体类型 */
  origin: 'keyword' | 'synonym' | 'stock' | 'index' | 'overseas';
}

function buildTermEntries(industry: IndustryMapping): TermEntry[] {
  const entries: TermEntry[] = [];
  const seen = new Set<string>();

  const add = (term: string, origin: TermEntry['origin']) => {
    const t = term.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      entries.push({ term: t, origin });
    }
  };

  for (const k of industry.keywords)  add(k, 'keyword');
  for (const s of industry.synonyms)  add(s, 'synonym');
  for (const idx of industry.indices) add(idx, 'index');

  for (const stock of industry.stocks) {
    add(stock.code, 'stock');
    add(stock.name, 'stock');
    if (stock.shortName) add(stock.shortName, 'stock');
    if (stock.englishName) add(stock.englishName, 'stock');
    if (stock.aliases) for (const a of stock.aliases) add(a, 'stock');
  }

  for (const om of industry.overseasMappings) {
    add(om.code, 'overseas');
    add(om.name, 'overseas');
  }

  return entries;
}

// ─── 主题类型推断 ──────────────────────────────────────────────────────────────

function inferSubjectType(
  matchedEntries: TermEntry[],
  text: string,
): SubjectType {
  // 若命中词中有股票条目优先判定为公司主体
  if (matchedEntries.some((e) => e.origin === 'stock')) return 'company';
  if (matchedEntries.some((e) => e.origin === 'index'))  return 'index';
  if (matchedEntries.some((e) => e.origin === 'overseas')) return 'company';

  // 正文中出现宏观词 → 宏观
  if (containsAny(text, MACRO_TERMS)) return 'macro';
  // 正文中出现大宗商品词 → 商品
  if (containsAny(text, COMMODITY_TERMS)) return 'commodity';

  return 'industry';
}

// ─── 影响周期判断 ──────────────────────────────────────────────────────────────

function inferImpactCycle(text: string): ImpactCycle {
  const shortHits = SHORT_TERM_SIGNALS.filter((s) => text.includes(s)).length;
  const longHits  = LONG_TERM_SIGNALS.filter((s)  => text.includes(s)).length;

  if (shortHits > longHits && shortHits >= 1) return 'short_term';
  if (longHits  > shortHits && longHits  >= 1) return 'long_term';
  // 相等但至少有一方命中，取长期为默认（基本面优先）
  if (longHits >= 1) return 'long_term';
  if (shortHits >= 1) return 'short_term';
  return 'unknown';
}

// ─── 影响方向是否明确 ─────────────────────────────────────────────────────────

function inferImpactDirectionClear(item: ContentItem): boolean {
  // T012 事件识别结果：存在方向明确的事件
  const events: StructuredEvent[] = item.nlp?.events ?? [];
  if (events.some((e) => (e.impactDirection === 'positive' || e.impactDirection === 'negative') && e.confidence >= 0.6)) {
    return true;
  }
  // T011 增强情绪：非中性且置信度 >= 0.65
  const enhanced = item.nlp?.enhanced;
  if (enhanced && enhanced.label !== 'neutral' && enhanced.confidence >= 0.65) {
    return true;
  }
  return false;
}

// ─── 核心评分函数 ──────────────────────────────────────────────────────────────

/**
 * 计算单条内容对指定行业的相关度。
 */
export function scoreRelevance(item: ContentItem, industry: IndustryMapping): IndustryRelevance {
  const titleText   = (item.title   ?? '').toLowerCase();
  const bodyText    = (item.content ?? '').toLowerCase();
  const fullText    = titleText + ' ' + bodyText;
  const firstPara   = bodyText.slice(0, 200);

  const termEntries = buildTermEntries(industry);

  let titleScore   = 0;
  let freqScore    = 0;
  let entityScore  = 0;
  let proxyScore   = 0;

  const matchedTerms: string[]   = [];
  const matchedEntries: TermEntry[] = [];

  // 1. 标题命中（0-40）：任意词命中标题得 40 分（一次性）
  for (const entry of termEntries) {
    if (titleText.includes(entry.term)) {
      if (titleScore === 0) titleScore = 40;          // 只计一次
      if (!matchedTerms.includes(entry.term)) {
        matchedTerms.push(entry.term);
        matchedEntries.push(entry);
      }
    }
  }

  // 2. 正文频次（0-30）：统计正文中各词命中次数，每次 +5，上限 30
  let totalBodyFreq = 0;
  for (const entry of termEntries) {
    const cnt = countOccurrences(bodyText, entry.term);
    if (cnt > 0) {
      totalBodyFreq += cnt;
      if (!matchedTerms.includes(entry.term)) {
        matchedTerms.push(entry.term);
        matchedEntries.push(entry);
      }
    }
  }
  freqScore = Math.min(30, totalBodyFreq * 5);

  // 3. 实体命中（0-20）：NLP entities 中存在对应行业实体
  const entityNames = (item.nlp?.entities ?? []).map((e) => e.name.toLowerCase());
  for (const entry of termEntries) {
    if (entityNames.includes(entry.term)) {
      entityScore = 20;
      break;
    }
  }

  // 4. 首段命中（0-10）：正文前 200 字中出现词条
  if (matchedTerms.length > 0) {
    if (matchedTerms.some((t) => firstPara.includes(t))) {
      proxyScore = 10;
    }
  }

  const raw = titleScore + freqScore + entityScore + proxyScore;
  const relevanceScore = Math.min(100, raw);

  return {
    industryId:           industry.id,
    industryName:         industry.name,
    relevanceScore,
    subjectType:          inferSubjectType(matchedEntries, fullText),
    isCoreSubject:        relevanceScore >= 60,
    isMentionOnly:        relevanceScore < 30,
    impactDirectionClear: inferImpactDirectionClear(item),
    impactCycle:          inferImpactCycle(fullText),
    matchedTerms,
  };
}

/**
 * 批量计算一条内容对所有行业的相关度（仅返回有命中词的行业）。
 */
export function scoreRelevanceForIndustries(
  item: ContentItem,
  industries: IndustryMapping[],
): IndustryRelevance[] {
  return industries
    .map((ind) => scoreRelevance(item, ind))
    .filter((r) => r.matchedTerms.length > 0);
}
