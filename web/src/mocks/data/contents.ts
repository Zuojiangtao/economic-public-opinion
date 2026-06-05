import type { ContentItem, FinancialSentimentLabel } from '../../api/types';

const sources = [
  { sourceType: 'news' as const, sourceName: '财联社' },
  { sourceType: 'news' as const, sourceName: '第一财经' },
  { sourceType: 'news' as const, sourceName: '证券时报' },
  { sourceType: 'forums' as const, sourceName: '雪球' },
  { sourceType: 'forums' as const, sourceName: '东方财富股吧' },
  { sourceType: 'social' as const, sourceName: '微博财经' },
  { sourceType: 'social' as const, sourceName: '微信公众号' },
  { sourceType: 'broker' as const, sourceName: '中信证券研究' },
  { sourceType: 'broker' as const, sourceName: '国泰君安研究' },
  { sourceType: 'app' as const, sourceName: '同花顺评论' },
];

const titles = [
  'A股三大指数集体高开，半导体板块领涨',
  '央行今日开展逆回购操作，净投放1000亿元',
  '北向资金今日净流入超50亿元，加仓消费板块',
  '多家券商上调2026年GDP增速预期至5.2%',
  '新能源车销量持续攀升，比亚迪市占率突破35%',
  '房地产板块午后异动拉升，多股涨停',
  '人民币汇率突破7.0关口，创三个月新高',
  '美联储暗示6月可能降息，全球市场反应积极',
  '芯片产业链集体走强，国产替代逻辑持续演绎',
  '银行板块估值修复行情启动，高股息策略受青睐',
  '白酒龙头业绩超预期，消费升级趋势确认',
  '光伏产业产能过剩担忧升温，相关个股承压',
  '医药板块利好频出，创新药赛道重获市场关注',
  '碳中和目标推动，环保板块迎来政策催化',
  '市场情绪回暖，两市成交额重上万亿',
  '科创板注册制改革深化，新股发行节奏加快',
  '外资机构看好中国资产，A股配置价值凸显',
  '债市波动加剧，10年期国债收益率破2.3%',
  '金融监管趋严，互联网金融行业迎整改潮',
  '农业板块逆势走强，粮食安全主题持续发酵',
  '锂电池回收产业链受关注，龙头企业订单大增',
  '人工智能概念持续火爆，算力需求推动产业链',
  '中特估行情再起，央企重组预期升温',
  '港股科技股反弹，恒生科技指数大涨3%',
  '民营经济政策支持力度加大，市场信心提振',
  '社保基金增持银行股，长期投资价值获认可',
  '券商板块异动拉升，市场憧憬牛市行情',
  '信创产业加速推进，国产替代迎来重要窗口期',
  '稀土永磁板块走强，下游需求旺盛',
  '市场监管加强短期导致恐慌，分析师称属正常调整',
];

const contents = [
  '据最新数据显示，今日A股市场整体呈现震荡上行态势。半导体板块表现尤为突出，多只个股涨停。分析人士指出，在国产替代加速推进的背景下，芯片产业链有望持续受益。近期北向资金持续加仓科技板块，显示外资对中国科技创新的信心。',
  '央行今日在公开市场开展了大规模逆回购操作，向市场投放流动性。业内人士认为，此举释放了积极信号，表明货币政策将继续保持适度宽松。金融市场流动性充裕有助于支撑股市和债市表现。',
  '北向资金今日大幅净流入，重点加仓消费、金融等权重板块。分析师认为，随着中国经济持续复苏，外资对A股的配置意愿正在增强。特别是估值处于历史低位的消费龙头，受到了外资的重点关注。',
  '多家头部券商发布宏观经济展望报告，纷纷上调2026年GDP增速预期。报告指出，随着政策持续发力和经济内生动力增强，消费和投资有望保持较快增长。对股市而言，企业盈利改善将是核心驱动力。',
  '新能源汽车市场持续火热，比亚迪最新公布的数据显示其市场占有率已突破35%。产业链上下游均呈现供销两旺格局。分析认为，智能化将是下一阶段新能源车竞争的关键战场。',
];

const entities = [
  { name: '比亚迪', type: 'company' as const },
  { name: '宁德时代', type: 'company' as const },
  { name: '贵州茅台', type: 'company' as const },
  { name: '中信证券', type: 'company' as const },
  { name: '央行', type: 'company' as const },
  { name: '沪深300', type: 'index' as const },
  { name: '创业板指', type: 'index' as const },
  { name: '半导体', type: 'industry' as const },
  { name: '新能源', type: 'industry' as const },
  { name: '房地产', type: 'industry' as const },
  { name: '医药生物', type: 'industry' as const },
  { name: '消费', type: 'industry' as const },
];

const sentimentLabels = ['positive', 'neutral', 'negative'] as const;
const riskLevels = ['low', 'medium', 'high', 'critical'] as const;
const markets = ['cn', 'hk', 'us'] as const;

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(randomInt(6, 22), randomInt(0, 59), randomInt(0, 59));
  return d.toISOString();
}

export function generateMockContents(count: number = 200): ContentItem[] {
  // T011: 精细标签映射（sentimentLabel -> FinancialSentimentLabel 演示分布）
  const financialLabelMap: Record<string, FinancialSentimentLabel[]> = {
    positive: ['strong_positive', 'weak_positive'],
    neutral: ['neutral', 'rumor'],
    negative: ['weak_negative', 'strong_negative', 'risk'],
  };
  const reasoningMap: Record<FinancialSentimentLabel, string> = {
    strong_positive: '判断为【强利好】。 强正面信号：涨停、创新高、超预期。',
    weak_positive: '判断为【弱利好】。 正面信号：利好、增持、反弹。',
    neutral: '判断为【中性】。 未检测到明确情绪信号，依据文本特征判定为中性。',
    weak_negative: '判断为【弱利空】。 负面信号：利空、下跌、减持。',
    strong_negative: '判断为【强利空】。 强负面信号：暴跌、跌停、大跌。',
    risk: '判断为【风险】。 风险信号：暴雷、违约、破产。 建议重点关注。',
    rumor: '判断为【传闻】。 传闻信号：据悉、消息称、有望。 内容尚未得到证实。',
  };

  const items: ContentItem[] = [];
  for (let i = 0; i < count; i++) {
    const src = randomPick(sources);
    const sentLabel = randomPick(sentimentLabels);
    const sentScore =
      sentLabel === 'positive'
        ? Math.random() * 0.5 + 0.5
        : sentLabel === 'negative'
          ? -(Math.random() * 0.5 + 0.5)
          : Math.random() * 0.4 - 0.2;
    const risk =
      sentLabel === 'negative'
        ? randomPick(['medium', 'high', 'critical'] as const)
        : randomPick(riskLevels);
    const market = randomPick(markets);
    const publishedAt = generateDate(randomInt(0, 30));

    // T011: 生成增强情绪标签（仅部分条目携带，模拟已分析状态）
    const hasEnhanced = i % 3 !== 0; // ~67% 的条目有增强分析
    const financialLabel: FinancialSentimentLabel | undefined = hasEnhanced
      ? randomPick(financialLabelMap[sentLabel as string])
      : undefined;

    items.push({
      id: `content-${String(i + 1).padStart(4, '0')}`,
      title: randomPick(titles),
      content: randomPick(contents),
      sourceType: src.sourceType,
      sourceName: src.sourceName,
      author: `分析师${randomInt(1, 50)}`,
      url: `https://example.com/article/${i + 1}`,
      publishedAt,
      fetchedAt: new Date(new Date(publishedAt).getTime() + 60000).toISOString(),
      market,
      metrics: {
        likes: randomInt(0, 10000),
        comments: randomInt(0, 500),
        shares: randomInt(0, 2000),
        views: randomInt(100, 100000),
      },
      matches: [
        {
          projectId: `project-${randomInt(1, 5)}`,
          projectName: `方案${randomInt(1, 5)}`,
          keywords: [randomPick(['半导体', '新能源', '央行', '消费', '医药'])],
          tags: [randomPick(['热点', '风险', '机会', '政策'])],
        },
      ],
      nlp: {
        sentiment: Math.round(sentScore * 100) / 100,
        sentimentLabel: sentLabel,
        riskLevel: risk,
        summary: randomPick(titles),
        entities: [randomPick(entities), randomPick(entities)].filter(
          (e, idx, arr) => arr.findIndex((x) => x.name === e.name) === idx,
        ),
        ...(hasEnhanced && financialLabel
          ? {
              enhanced: {
                label: financialLabel,
                confidence: Math.round((0.55 + Math.random() * 0.35) * 100) / 100,
                reasoning: reasoningMap[financialLabel],
                secondaryAnalysis: financialLabel === 'risk' || financialLabel === 'strong_negative',
                modelSource: 'dictionary' as const,
                positiveSignals: sentLabel === 'positive' ? [randomPick(['利好', '增持', '反弹', '涨停'])] : [],
                negativeSignals: sentLabel === 'negative' ? [randomPick(['利空', '下跌', '减持', '暴跌'])] : [],
                riskSignals: financialLabel === 'risk' ? [randomPick(['暴雷', '违约', '破产'])] : [],
                rumorSignals: financialLabel === 'rumor' ? [randomPick(['据悉', '消息称', '有望'])] : [],
              },
            }
          : {}),
      },
      dedup: {
        clusterId: `cluster-${randomInt(1, 30)}`,
        similarCount: randomInt(0, 10),
      },
    });
  }
  return items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export const mockContents = generateMockContents(200);
