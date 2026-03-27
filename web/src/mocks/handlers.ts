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
} from '../api/types';

let contents = [...mockContents];
let projects = [...mockMonitoringProjects];
let alerts = [...mockAlerts];
let alertRules = [...mockAlertRules];
let lexicons = [...mockLexicons];
let nextId = 1000;

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

  // Monitoring Projects
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
      keywords: body.keywords || { include: [], exclude: [] },
      sourceTypes: body.sourceTypes || ['news'],
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
];
