import { http, HttpResponse, delay } from 'msw';
import { mockContents } from './data/contents';
import { mockMonitoringProjects } from './data/monitoring';
import { mockAlerts, mockAlertRules } from './data/alerts';
import { mockLexicons } from './data/lexicons';
import type {
  ContentItem,
  MonitoringProject,
  Alert,
  AlertRule,
  LexiconEntry,
  SentimentLabel,
  SourceType,
  RiskLevel,
  AlertStatus,
  LexiconCategory,
  TemperatureSnapshot,
  TemperatureDetail,
  TemperatureLevel,
  SourceConfig,
} from '../api/types';

let contents = [...mockContents];
let projects = [...mockMonitoringProjects];
let alerts = [...mockAlerts];
let alertRules = [...mockAlertRules];
let lexicons = [...mockLexicons];
let nextId = 1000;

// ---- 数据源配置 Mock 数据（T006） ----
let sourceConfigs: SourceConfig[] = [
  { id: 'RegulatoryAuthorityCrawler', name: '监管机构公告', sourceName: '监管机构公告', sourceType: 'regulatory', credibilityScore: 98, includeInTemperature: true, authorizationStatus: 'authorized', antiCrawlRisk: 'low', availabilityStatus: 'available', description: '证监会、交易所等监管机构官方公告，权威性最高', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'HKEXCrawler', name: '港交所披露易', sourceName: '港交所披露易', sourceType: 'regulatory', credibilityScore: 97, includeInTemperature: true, authorizationStatus: 'authorized', antiCrawlRisk: 'low', availabilityStatus: 'available', description: '香港交易所官方披露平台', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'SECCrawler', name: '美国SEC', sourceName: '美股资讯', sourceType: 'regulatory', credibilityScore: 96, includeInTemperature: true, authorizationStatus: 'authorized', antiCrawlRisk: 'low', availabilityStatus: 'available', description: '美国证监会公开披露文件', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'BrokerResearchCrawler', name: '券商研报', sourceName: '研报', sourceType: 'broker', credibilityScore: 92, includeInTemperature: true, authorizationStatus: 'restricted', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '国内主要券商研究报告', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'FirstBankCrawler', name: '第一银行研报', sourceName: '第一银行', sourceType: 'broker', credibilityScore: 88, includeInTemperature: true, authorizationStatus: 'restricted', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '海外券商研报', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'BloombergCrawler', name: '彭博社', sourceName: '彭博社 Bloomberg', sourceType: 'news', credibilityScore: 90, includeInTemperature: true, authorizationStatus: 'restricted', antiCrawlRisk: 'high', availabilityStatus: 'unstable', description: '全球顶级财经媒体', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ReutersCrawler', name: '路透社', sourceName: '路透社 Reuters', sourceType: 'news', credibilityScore: 88, includeInTemperature: true, authorizationStatus: 'restricted', antiCrawlRisk: 'high', availabilityStatus: 'unstable', description: '全球权威新闻通讯社', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ChinaSecuritiesJournalCrawler', name: '中国证券报', sourceName: '中国证券报', sourceType: 'news', credibilityScore: 85, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '证券行业官方报纸', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ClsCrawler', name: '财联社', sourceName: '财联社', sourceType: 'news', credibilityScore: 83, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '专注于财经资讯，快讯及时性强', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'SinaFinanceCrawler', name: '新浪财经', sourceName: '新浪财经', sourceType: 'news', credibilityScore: 75, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '综合财经门户，转载内容较多', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'WindCrawler', name: '万得资讯', sourceName: '万得资讯', sourceType: 'app', credibilityScore: 82, includeInTemperature: true, authorizationStatus: 'restricted', antiCrawlRisk: 'high', availabilityStatus: 'unstable', description: '专业金融数据终端', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ThsCrawler', name: '同花顺', sourceName: '同花顺', sourceType: 'app', credibilityScore: 72, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '国内主流股票APP', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'EastMoneyCrawler', name: '东方财富', sourceName: '东方财富', sourceType: 'app', credibilityScore: 70, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '国内最大股票社区和财经平台', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'StockstarCrawler', name: '证券之星', sourceName: '证券之星', sourceType: 'app', credibilityScore: 65, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'low', availabilityStatus: 'available', description: '老牌财经资讯平台', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'FutuCrawler', name: '富途证券', sourceName: '富途牛牛', sourceType: 'app', credibilityScore: 68, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '港美股主流券商平台', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'TigerCrawler', name: '老虎证券', sourceName: '老虎证券 Tiger', sourceType: 'app', credibilityScore: 65, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '港美股券商，散户社区讨论较多', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'XueqiuCrawler', name: '雪球', sourceName: '雪球', sourceType: 'social', credibilityScore: 52, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '国内最大股票社交平台', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'Laohu8Crawler', name: '老虎社区', sourceName: '老虎社区', sourceType: 'forums', credibilityScore: 42, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '老虎证券社区', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'GubaCrawler', name: '股吧', sourceName: '股吧', sourceType: 'forums', credibilityScore: 40, includeInTemperature: true, authorizationStatus: 'unauthorized', antiCrawlRisk: 'low', availabilityStatus: 'available', description: '东方财富股票讨论论坛', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'ZhihuCrawler', name: '知乎', sourceName: '知乎', sourceType: 'social', credibilityScore: 38, includeInTemperature: false, authorizationStatus: 'unauthorized', antiCrawlRisk: 'medium', availabilityStatus: 'available', description: '问答社区，金融话题质量参差不齐', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'XiaohongshuCrawler', name: '小红书', sourceName: '小红书', sourceType: 'social', credibilityScore: 25, includeInTemperature: false, authorizationStatus: 'unauthorized', antiCrawlRisk: 'high', availabilityStatus: 'unstable', description: '生活社区，金融信息可信度低', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'DouyinCrawler', name: '抖音', sourceName: '抖音', sourceType: 'social', credibilityScore: 20, includeInTemperature: false, authorizationStatus: 'unauthorized', antiCrawlRisk: 'high', availabilityStatus: 'unstable', description: '短视频平台，金融内容娱乐化，可信度最低', updatedAt: '2026-01-01T00:00:00Z' },
];

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export const handlers = [
  // Auth
  http.post('/api/v1/auth/login', async () => {
    await delay(300);
    return HttpResponse.json({
      token: 'mock-jwt-token',
      user: { id: 'user-1', username: '管理员', role: 'admin', avatar: '' },
    });
  }),

  http.get('/api/v1/auth/me', async () => {
    await delay(100);
    return HttpResponse.json({
      id: 'user-1',
      username: '管理员',
      role: 'admin',
      avatar: '',
    });
  }),

  // Contents
  http.get('/api/v1/contents', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword') || '';
    const sourceType = url.searchParams.get('sourceType') as SourceType | null;
    const sentiment = url.searchParams.get('sentiment') as SentimentLabel | null;
    const riskLevel = url.searchParams.get('riskLevel') as RiskLevel | null;
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const projectId = url.searchParams.get('monitoringProjectId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    const sortBy = url.searchParams.get('sortBy') || 'publishedAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    let filtered: ContentItem[] = [...contents];

    if (keyword) {
      const kw = keyword.toLowerCase();
      filtered = filtered.filter(
        (c) => c.title.toLowerCase().includes(kw) || c.content.toLowerCase().includes(kw),
      );
    }
    if (sourceType) filtered = filtered.filter((c) => c.sourceType === sourceType);
    if (sentiment) filtered = filtered.filter((c) => c.nlp.sentimentLabel === sentiment);
    if (riskLevel) filtered = filtered.filter((c) => c.nlp.riskLevel === riskLevel);
    if (startDate) filtered = filtered.filter((c) => c.publishedAt >= startDate);
    if (endDate) filtered = filtered.filter((c) => c.publishedAt <= endDate + 'T23:59:59Z');
    if (projectId) filtered = filtered.filter((c) => c.matches.some((m) => m.projectId === projectId));

    const riskOrder = { low: 0, medium: 1, high: 2, critical: 3 };
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'publishedAt') {
        cmp = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
      } else if (sortBy === 'sentiment') {
        cmp = a.nlp.sentiment - b.nlp.sentiment;
      } else if (sortBy === 'riskLevel') {
        cmp = riskOrder[a.nlp.riskLevel] - riskOrder[b.nlp.riskLevel];
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return HttpResponse.json(paginate(filtered, page, pageSize));
  }),

  http.get('/api/v1/contents/stats', async () => {
    await delay(300);
    const pos = contents.filter((c) => c.nlp.sentimentLabel === 'positive').length;
    const neu = contents.filter((c) => c.nlp.sentimentLabel === 'neutral').length;
    const neg = contents.filter((c) => c.nlp.sentimentLabel === 'negative').length;

    const dateMap = new Map<string, { total: number; positive: number; neutral: number; negative: number }>();
    contents.forEach((c) => {
      const d = c.publishedAt.substring(0, 10);
      if (!dateMap.has(d)) dateMap.set(d, { total: 0, positive: 0, neutral: 0, negative: 0 });
      const entry = dateMap.get(d)!;
      entry.total++;
      entry[c.nlp.sentimentLabel]++;
    });

    const trendData = Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const sourceMap = new Map<string, number>();
    contents.forEach((c) => sourceMap.set(c.sourceType, (sourceMap.get(c.sourceType) || 0) + 1));

    const keywordMap = new Map<string, number>();
    contents.forEach((c) =>
      c.matches.forEach((m) =>
        m.keywords.forEach((kw) => keywordMap.set(kw, (keywordMap.get(kw) || 0) + 1)),
      ),
    );

    const entityMap = new Map<string, { type: string; count: number }>();
    contents.forEach((c) =>
      c.nlp.entities.forEach((e) => {
        const existing = entityMap.get(e.name);
        entityMap.set(e.name, { type: e.type, count: (existing?.count || 0) + 1 });
      }),
    );

    return HttpResponse.json({
      totalCount: contents.length,
      sentimentDistribution: { positive: pos, neutral: neu, negative: neg },
      riskDistribution: {
        low: contents.filter((c) => c.nlp.riskLevel === 'low').length,
        medium: contents.filter((c) => c.nlp.riskLevel === 'medium').length,
        high: contents.filter((c) => c.nlp.riskLevel === 'high').length,
        critical: contents.filter((c) => c.nlp.riskLevel === 'critical').length,
      },
      sourceDistribution: Array.from(sourceMap.entries()).map(([sourceType, count]) => ({ sourceType, count })),
      trendData,
      topKeywords: Array.from(keywordMap.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topEntities: Array.from(entityMap.entries())
        .map(([name, v]) => ({ name, type: v.type, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }),

  http.get('/api/v1/contents/:id', async ({ params }) => {
    await delay(150);
    const item = contents.find((c) => c.id === params.id);
    if (!item) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(item);
  }),

  // T011: 增强情绪二次分析（Mock 版，模拟词典分析结果）
  http.post('/api/v1/contents/:id/sentiment/analyze', async ({ params }) => {
    await delay(400);
    const item = contents.find((c) => c.id === params.id);
    if (!item) return new HttpResponse(null, { status: 404 });
    // 返回已存在的 enhanced 数据，或生成一个演示结果
    if (item.nlp.enhanced) return HttpResponse.json(item.nlp.enhanced);
    const sentimentLabel = item.nlp.sentimentLabel;
    const mockEnhanced = {
      label: sentimentLabel === 'positive' ? 'weak_positive' : sentimentLabel === 'negative' ? 'weak_negative' : 'neutral',
      confidence: 0.72,
      reasoning: '判断为【弱利好】。 正面信号：利好、增持。 来源为券商研报，专业性较高。',
      secondaryAnalysis: false,
      modelSource: 'dictionary' as const,
      positiveSignals: sentimentLabel === 'positive' ? ['利好', '增持'] : [],
      negativeSignals: sentimentLabel === 'negative' ? ['利空', '下跌'] : [],
      riskSignals: item.nlp.riskLevel === 'high' || item.nlp.riskLevel === 'critical' ? ['风险'] : [],
      rumorSignals: [],
    };
    return HttpResponse.json(mockEnhanced);
  }),

  http.get('/api/v1/monitoring-projects', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
    return HttpResponse.json(paginate(projects, page, pageSize));
  }),

  http.get('/api/v1/monitoring-projects/:id', async ({ params }) => {
    await delay(150);
    const item = projects.find((p) => p.id === params.id);
    if (!item) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(item);
  }),

  http.post('/api/v1/monitoring-projects', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<MonitoringProject>;
    const newProject: MonitoringProject = {
      id: `project-${++nextId}`,
      name: body.name || '新方案',
      description: body.description || '',
      status: body.status || 'active',
      targetType: body.targetType || 'industry',
      targetIds: body.targetIds || [],
      keywords: body.keywords || { core: [], extended: [], exclude: [] },
      sourceTypes: body.sourceTypes || ['news'],
      sourceWeights: body.sourceWeights || [],
      temperatureThreshold: body.temperatureThreshold ?? 70,
      alertThreshold: body.alertThreshold ?? 85,
      outputCycle: body.outputCycle || 'realtime',
      sentimentThreshold: body.sentimentThreshold,
      riskThreshold: body.riskThreshold,
      hitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.unshift(newProject);
    return HttpResponse.json(newProject, { status: 201 });
  }),

  http.put('/api/v1/monitoring-projects/:id', async ({ params, request }) => {
    await delay(300);
    const idx = projects.findIndex((p) => p.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Partial<MonitoringProject>;
    projects[idx] = {
      ...projects[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(projects[idx]);
  }),

  http.delete('/api/v1/monitoring-projects/:id', async ({ params }) => {
    await delay(200);
    projects = projects.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Alerts
  http.get('/api/v1/alerts', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as AlertStatus | null;
    const riskLevel = url.searchParams.get('riskLevel') as RiskLevel | null;
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

    let filtered: Alert[] = [...alerts];
    if (status) filtered = filtered.filter((a) => a.status === status);
    if (riskLevel) filtered = filtered.filter((a) => a.riskLevel === riskLevel);

    return HttpResponse.json(paginate(filtered, page, pageSize));
  }),

  http.get('/api/v1/alerts/:id', async ({ params }) => {
    await delay(150);
    const item = alerts.find((a) => a.id === params.id);
    if (!item) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(item);
  }),

  http.post('/api/v1/alerts/:id/handle', async ({ params, request }) => {
    await delay(300);
    const idx = alerts.findIndex((a) => a.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { action: string; note?: string };

    const statusMap: Record<string, string> = {
      start_processing: 'processing',
      resolve: 'resolved',
      ignore: 'ignored',
      reopen: 'pending',
    };

    alerts[idx] = {
      ...alerts[idx],
      status: (statusMap[body.action] || alerts[idx].status) as Alert['status'],
      handleRecords: [
        ...alerts[idx].handleRecords,
        {
          handler: '管理员',
          action: body.action,
          note: body.note || '',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    return HttpResponse.json(alerts[idx]);
  }),

  // Alert Rules
  http.get('/api/v1/alert-rules', async () => {
    await delay(150);
    return HttpResponse.json(alertRules);
  }),

  http.post('/api/v1/alert-rules', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<AlertRule>;
    const newRule: AlertRule = {
      id: `rule-${++nextId}`,
      name: body.name || '新规则',
      description: body.description || '',
      enabled: body.enabled ?? true,
      conditions: body.conditions || {},
      createdAt: new Date().toISOString(),
    };
    alertRules.push(newRule);
    return HttpResponse.json(newRule, { status: 201 });
  }),

  http.put('/api/v1/alert-rules/:id', async ({ params, request }) => {
    await delay(300);
    const idx = alertRules.findIndex((r) => r.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Partial<AlertRule>;
    alertRules[idx] = {
      ...alertRules[idx],
      ...body,
      id: alertRules[idx].id,
      createdAt: alertRules[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(alertRules[idx]);
  }),

  http.delete('/api/v1/alert-rules/:id', async ({ params }) => {
    await delay(200);
    alertRules = alertRules.filter((r) => r.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/v1/alert-rules/:id/toggle', async ({ params, request }) => {
    await delay(200);
    const idx = alertRules.findIndex((r) => r.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { enabled?: boolean };
    alertRules[idx] = {
      ...alertRules[idx],
      enabled: body.enabled ?? !alertRules[idx].enabled,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(alertRules[idx]);
  }),

  http.post('/api/v1/alerts/evaluate', async () => {
    await delay(500);
    // Mock evaluation: return simulated newly triggered alerts
    return HttpResponse.json({ triggered: 0, alerts: [] });
  }),

  // Lexicons
  http.get('/api/v1/lexicons', async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const category = url.searchParams.get('category') as LexiconCategory | null;
    let filtered: LexiconEntry[] = [...lexicons];
    if (category) filtered = filtered.filter((l) => l.category === category);
    return HttpResponse.json(filtered);
  }),

  http.post('/api/v1/lexicons', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<LexiconEntry>;
    const newEntry: LexiconEntry = {
      id: `lex-${++nextId}`,
      word: body.word || '',
      category: body.category || 'brand',
      synonyms: body.synonyms || [],
      createdAt: new Date().toISOString(),
    };
    lexicons.push(newEntry);
    return HttpResponse.json(newEntry, { status: 201 });
  }),

  http.delete('/api/v1/lexicons/:id', async ({ params }) => {
    await delay(200);
    lexicons = lexicons.filter((l) => l.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Temperatures
  http.get('/api/v1/temperatures', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const granularity = (url.searchParams.get('granularity') || 'hour') as 'hour' | 'day';

    const mockIndustries: { id: string; name: string; score: number; delta: number; level: TemperatureLevel; bd: [number, number, number, number]; cnt: number; pos: number; neu: number; neg: number }[] = [
      { id: 'industry-ai',           name: 'AI科技',   score: 82, delta: +12, level: 'hot',     bd: [88, 75, 72, 95], cnt: 124, pos: 80, neu: 30, neg: 14 },
      { id: 'industry-semiconductor',name: '半导体',   score: 74, delta:  +7, level: 'warm',    bd: [72, 68, 65, 90], cnt: 98,  pos: 55, neu: 28, neg: 15 },
      { id: 'industry-new-energy',   name: '新能源',   score: 61, delta:  +3, level: 'neutral', bd: [65, 55, 58, 75], cnt: 76,  pos: 38, neu: 25, neg: 13 },
      { id: 'industry-pharma',       name: '医药',     score: 55, delta:  -2, level: 'neutral', bd: [50, 52, 48, 80], cnt: 62,  pos: 28, neu: 22, neg: 12 },
      { id: 'industry-metals',       name: '有色金属', score: 44, delta:  -5, level: 'cool',    bd: [40, 48, 38, 65], cnt: 45,  pos: 18, neu: 16, neg: 11 },
      { id: 'industry-bank',         name: '银行',     score: 38, delta:  -8, level: 'cool',    bd: [35, 40, 30, 70], cnt: 38,  pos: 14, neu: 15, neg: 9  },
      { id: 'industry-realestate',   name: '房地产',   score: 22, delta: -14, level: 'freezing',bd: [18, 28, 15, 55], cnt: 30,  pos: 5,  neu: 12, neg: 13 },
    ];

    const items: TemperatureSnapshot[] = mockIndustries.map((d) => ({
      id: `temp-${d.id}-${granularity}`,
      industryId: d.id,
      industryName: d.name,
      score: d.score,
      scoreDelta: d.delta,
      level: d.level,
      breakdown: {
        sentimentScore: d.bd[0],
        volumeAnomalyScore: d.bd[1],
        spreadIntensityScore: d.bd[2],
        sourceCredibilityScore: d.bd[3],
      },
      contentCount: d.cnt,
      sentimentDistribution: { positive: d.pos, neutral: d.neu, negative: d.neg },
      snapshotAt: new Date().toISOString(),
      granularity,
    }));

    return HttpResponse.json({ items, total: items.length, granularity });
  }),

  http.get('/api/v1/temperatures/:industryId', async ({ params, request }) => {
    await delay(150);
    const url = new URL(request.url);
    const granularity = (url.searchParams.get('granularity') || 'hour') as 'hour' | 'day';
    const industryId = params.industryId as string;

    const mockMap: Record<string, { name: string; score: number; level: TemperatureLevel; bd: [number, number, number, number]; cnt: number; pos: number; neu: number; neg: number }> = {
      'industry-ai':           { name: 'AI科技',   score: 82, level: 'hot',     bd: [88, 75, 72, 95], cnt: 124, pos: 80, neu: 30, neg: 14 },
      'industry-semiconductor':{ name: '半导体',   score: 74, level: 'warm',    bd: [72, 68, 65, 90], cnt: 98,  pos: 55, neu: 28, neg: 15 },
      'industry-new-energy':   { name: '新能源',   score: 61, level: 'neutral', bd: [65, 55, 58, 75], cnt: 76,  pos: 38, neu: 25, neg: 13 },
      'industry-pharma':       { name: '医药',     score: 55, level: 'neutral', bd: [50, 52, 48, 80], cnt: 62,  pos: 28, neu: 22, neg: 12 },
      'industry-metals':       { name: '有色金属', score: 44, level: 'cool',    bd: [40, 48, 38, 65], cnt: 45,  pos: 18, neu: 16, neg: 11 },
      'industry-bank':         { name: '银行',     score: 38, level: 'cool',    bd: [35, 40, 30, 70], cnt: 38,  pos: 14, neu: 15, neg: 9  },
      'industry-realestate':   { name: '房地产',   score: 22, level: 'freezing',bd: [18, 28, 15, 55], cnt: 30,  pos: 5,  neu: 12, neg: 13 },
    };

    const d = mockMap[industryId];
    if (!d) return new HttpResponse(null, { status: 404 });

    return HttpResponse.json({
      id: `temp-${industryId}-${granularity}`,
      industryId,
      industryName: d.name,
      score: d.score,
      level: d.level,
      breakdown: {
        sentimentScore: d.bd[0],
        volumeAnomalyScore: d.bd[1],
        spreadIntensityScore: d.bd[2],
        sourceCredibilityScore: d.bd[3],
      },
      contentCount: d.cnt,
      sentimentDistribution: { positive: d.pos, neutral: d.neu, negative: d.neg },
      snapshotAt: new Date().toISOString(),
      granularity,
      riskDistribution: { low: Math.round(d.cnt * 0.5), medium: Math.round(d.cnt * 0.3), high: Math.round(d.cnt * 0.15), critical: Math.round(d.cnt * 0.05) },
      topContents: [
        { id: 'c1', title: `${d.name}板块重大政策利好，多股涨停`, sourceType: 'news' as const, sourceName: '财联社', publishedAt: new Date(Date.now() - 3600000).toISOString(), sentiment: 'positive' as const, riskLevel: 'low' as const, url: '#' },
        { id: 'c2', title: `机构密集调研${d.name}龙头企业`, sourceType: 'broker' as const, sourceName: '中信证券', publishedAt: new Date(Date.now() - 7200000).toISOString(), sentiment: 'positive' as const, riskLevel: 'low' as const, url: '#' },
        { id: 'c3', title: `${d.name}监管风险提示：部分企业违规被查`, sourceType: 'news' as const, sourceName: '证券时报', publishedAt: new Date(Date.now() - 10800000).toISOString(), sentiment: 'negative' as const, riskLevel: 'high' as const, url: '#' },
        { id: 'c4', title: `社区热帖：${d.name}短期调整空间分析`, sourceType: 'forums' as const, sourceName: '雪球', publishedAt: new Date(Date.now() - 14400000).toISOString(), sentiment: 'neutral' as const, riskLevel: 'medium' as const, url: '#' },
        { id: 'c5', title: `${d.name}产业链景气度跟踪报告`, sourceType: 'broker' as const, sourceName: '华泰证券', publishedAt: new Date(Date.now() - 18000000).toISOString(), sentiment: 'positive' as const, riskLevel: 'low' as const, url: '#' },
      ],
    } as TemperatureDetail);
  }),

  // Temperature trend
  http.get('/api/v1/temperatures/:industryId/trend', async ({ params, request }) => {
    await delay(200);
    const url = new URL(request.url);
    const granularity = (url.searchParams.get('granularity') || 'hour') as 'hour' | 'day';
    const limit = parseInt(url.searchParams.get('limit') || '24');
    const industryId = params.industryId as string;

    const baseScores: Record<string, number> = {
      'industry-ai': 82, 'industry-semiconductor': 74, 'industry-new-energy': 61,
      'industry-pharma': 55, 'industry-metals': 44, 'industry-bank': 38, 'industry-realestate': 22,
    };
    const names: Record<string, string> = {
      'industry-ai': 'AI科技', 'industry-semiconductor': '半导体', 'industry-new-energy': '新能源',
      'industry-pharma': '医药', 'industry-metals': '有色金属', 'industry-bank': '银行', 'industry-realestate': '房地产',
    };
    const base = baseScores[industryId] ?? 50;
    const getLevel = (s: number): TemperatureLevel => s < 20 ? 'freezing' : s < 40 ? 'cool' : s < 60 ? 'neutral' : s < 80 ? 'warm' : 'hot';

    const now = Date.now();
    const intervalMs = granularity === 'hour' ? 3600000 : 86400000;
    const count = Math.min(limit, 24);

    const items: TemperatureSnapshot[] = Array.from({ length: count }, (_, i) => {
      const score = Math.max(0, Math.min(100, base + Math.round((Math.random() - 0.5) * 20)));
      return {
        id: `temp-${industryId}-${granularity}-${i}`,
        industryId,
        industryName: names[industryId] ?? industryId,
        score,
        level: getLevel(score),
        breakdown: { sentimentScore: score, volumeAnomalyScore: score - 5, spreadIntensityScore: score - 10, sourceCredibilityScore: 75 },
        contentCount: Math.round(base * 1.2 + Math.random() * 20),
        sentimentDistribution: { positive: Math.round(score * 0.8), neutral: 20, negative: Math.round((100 - score) * 0.3) },
        snapshotAt: new Date(now - (count - 1 - i) * intervalMs).toISOString(),
        granularity,
      };
    });

    return HttpResponse.json({ industryId, industryName: names[industryId] ?? industryId, granularity, items, total: items.length });
  }),

  // Source Configs (T006)
  http.get('/api/v1/source-configs', async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const sourceType = url.searchParams.get('sourceType') as SourceType | null;
    const result = sourceType ? sourceConfigs.filter((c) => c.sourceType === sourceType) : sourceConfigs;
    return HttpResponse.json(result);
  }),

  http.put('/api/v1/source-configs/:id', async ({ params, request }) => {
    await delay(200);
    const idx = sourceConfigs.findIndex((c) => c.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Partial<SourceConfig>;
    const allowed: (keyof SourceConfig)[] = ['credibilityScore', 'includeInTemperature', 'authorizationStatus', 'antiCrawlRisk', 'availabilityStatus', 'description'];
    const patch: Partial<SourceConfig> = {};
    for (const key of allowed) {
      if (key in body) (patch as Record<string, unknown>)[key] = (body as Record<string, unknown>)[key];
    }
    sourceConfigs[idx] = { ...sourceConfigs[idx], ...patch, updatedAt: new Date().toISOString() };
    return HttpResponse.json(sourceConfigs[idx]);
  }),

  http.post('/api/v1/source-configs/:id/toggle', async ({ params, request }) => {
    await delay(150);
    const idx = sourceConfigs.findIndex((c) => c.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { includeInTemperature?: boolean };
    sourceConfigs[idx] = {
      ...sourceConfigs[idx],
      includeInTemperature: body.includeInTemperature ?? !sourceConfigs[idx].includeInTemperature,
      updatedAt: new Date().toISOString(),
    };
    return HttpResponse.json(sourceConfigs[idx]);
  }),
];
