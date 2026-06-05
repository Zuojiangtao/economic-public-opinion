import { Router } from 'express';
import type { JsonStorage } from '../storage/JsonStorage.js';
import {
  loadMonitoringProjectsMap,
  saveMonitoringProjectsMap,
} from '../storage/monitoringProjectsStore.js';
import { loadLexicons, saveLexicons } from '../storage/lexiconsStore.js';
import {
  loadIndustryMappingsMap,
  saveIndustryMappingsMap,
} from '../storage/industryMappingsStore.js';
import {
  queryIndustriesByKeywords,
  queryIndustriesByText,
} from '../nlp/industryMappingService.js';
import type { CrawlScheduler } from '../scheduler/CrawlScheduler.js';
import type { SourceType, SentimentLabel, RiskLevel, MarketType, IndustryType } from '../types.js';

export function createRouter(storage: JsonStorage, scheduler: CrawlScheduler): Router {
  const router = Router();

  // ==================== Auth ====================

  router.post('/auth/login', (_req, res) => {
    res.json({
      token: 'mock-jwt-token',
      user: { id: 'user-1', username: '管理员', role: 'admin', avatar: '' },
    });
  });

  router.get('/auth/me', (_req, res) => {
    res.json({ id: 'user-1', username: '管理员', role: 'admin', avatar: '' });
  });

  // 需在 /contents 之前初始化，供按监测方案筛选舆情（数据见根目录 data/monitoring-projects.json）
  const projects = loadMonitoringProjectsMap();

  // ==================== Contents ====================

  router.get('/contents', (req, res) => {
    const monitoringProjectId = req.query.monitoringProjectId as string | undefined;
    const project = monitoringProjectId ? projects.get(monitoringProjectId) : undefined;
    const monitoringProjectRules =
      project && monitoringProjectId
        ? {
            sourceTypes: (project.sourceTypes || []) as SourceType[],
            include: project.keywords?.include ?? [],
            exclude: project.keywords?.exclude ?? [],
          }
        : undefined;

    const params = {
      keyword: req.query.keyword as string | undefined,
      sourceType: req.query.sourceType as SourceType | undefined,
      sentiment: req.query.sentiment as SentimentLabel | undefined,
      riskLevel: req.query.riskLevel as RiskLevel | undefined,
      market: req.query.market as MarketType | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
      sortBy: (req.query.sortBy as string) || 'publishedAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      monitoringProjectId,
      monitoringProjectRules,
    };

    const result = storage.search(params);
    res.json(result);
  });

  router.get('/contents/stats', (_req, res) => {
    const stats = storage.getStats();
    res.json(stats);
  });

  router.get('/contents/:id', (req, res) => {
    const item = storage.getById(req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在' });
      return;
    }
    res.json(item);
  });

  // ==================== Monitoring Projects (in-memory) ====================

  router.get('/monitoring-projects', (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const all = Array.from(projects.values());
    const start = (page - 1) * pageSize;
    res.json({
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      pageSize,
    });
  });

  router.get('/monitoring-projects/:id', (req, res) => {
    const p = projects.get(req.params.id);
    if (!p) {
      res.status(404).json({ code: 'NOT_FOUND', message: '方案不存在' });
      return;
    }
    res.json(p);
  });

  router.post('/monitoring-projects', (req, res) => {
    const id = `project-${Date.now()}`;
    const project = {
      id,
      ...req.body,
      status: req.body.status || 'active',
      keywords: req.body.keywords || { include: [], exclude: [] },
      sourceTypes: req.body.sourceTypes || ['news'],
      hitCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projects.set(id, project);
    saveMonitoringProjectsMap(projects);
    res.status(201).json(project);
  });

  router.put('/monitoring-projects/:id', (req, res) => {
    const existing = projects.get(req.params.id);
    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: '方案不存在' });
      return;
    }
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    projects.set(req.params.id, updated);
    saveMonitoringProjectsMap(projects);
    res.json(updated);
  });

  router.delete('/monitoring-projects/:id', (req, res) => {
    projects.delete(req.params.id);
    saveMonitoringProjectsMap(projects);
    res.status(204).end();
  });

  // ==================== Alerts (in-memory) ====================

  const alerts = new Map<string, any>();
  initDefaultAlerts(alerts);

  router.get('/alerts', (req, res) => {
    const status = req.query.status as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    let items = Array.from(alerts.values());
    if (status) items = items.filter((a) => a.status === status);
    if (riskLevel) items = items.filter((a) => a.riskLevel === riskLevel);

    const start = (page - 1) * pageSize;
    res.json({
      items: items.slice(start, start + pageSize),
      total: items.length,
      page,
      pageSize,
    });
  });

  router.get('/alerts/:id', (req, res) => {
    const a = alerts.get(req.params.id);
    if (!a) {
      res.status(404).json({ code: 'NOT_FOUND', message: '预警不存在' });
      return;
    }
    res.json(a);
  });

  router.post('/alerts/:id/handle', (req, res) => {
    const a = alerts.get(req.params.id);
    if (!a) {
      res.status(404).json({ code: 'NOT_FOUND', message: '预警不存在' });
      return;
    }
    const statusMap: Record<string, string> = {
      start_processing: 'processing',
      resolve: 'resolved',
      ignore: 'ignored',
      reopen: 'pending',
    };
    a.status = statusMap[req.body.action] || a.status;
    a.handleRecords = a.handleRecords || [];
    a.handleRecords.push({
      handler: '管理员',
      action: req.body.action,
      note: req.body.note || '',
      timestamp: new Date().toISOString(),
    });
    res.json(a);
  });

  // ==================== Alert Rules (in-memory) ====================

  const alertRules: any[] = [
    {
      id: 'rule-001', name: '负面声量突增预警', description: '当负面内容数量在2小时内增长超过100%时触发',
      enabled: true, conditions: { sentimentBelow: -0.3, volumeThreshold: 100 }, createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rule-002', name: '情绪阈值预警', description: '当监测方案内平均情绪指数低于设定阈值时触发',
      enabled: true, conditions: { sentimentBelow: -0.5 }, createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rule-003', name: '高风险内容预警', description: '当出现高风险或极高风险级别内容时立即触发',
      enabled: true, conditions: { riskLevelAbove: 'high' }, createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  router.get('/alert-rules', (_req, res) => {
    res.json(alertRules);
  });

  router.post('/alert-rules', (req, res) => {
    const rule = { id: `rule-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
    alertRules.push(rule);
    res.status(201).json(rule);
  });

  // ==================== Industry Mappings ====================

  const industryMappings = loadIndustryMappingsMap();

  router.get('/industry-mappings', (req, res) => {
    const type = req.query.type as IndustryType | undefined;
    let items = Array.from(industryMappings.values());
    if (type) items = items.filter((m) => m.type === type);
    res.json(items);
  });

  router.get('/industry-mappings/:id', (req, res) => {
    const m = industryMappings.get(req.params.id);
    if (!m) {
      res.status(404).json({ code: 'NOT_FOUND', message: '行业映射不存在' });
      return;
    }
    res.json(m);
  });

  router.post('/industry-mappings/query', (req, res) => {
    const { keywords, text } = req.body as { keywords?: string[]; text?: string };
    const all = Array.from(industryMappings.values());
    let results = keywords && keywords.length > 0
      ? queryIndustriesByKeywords(keywords, all)
      : [];
    if (text) {
      const textResults = queryIndustriesByText(text, all);
      const merged = new Map(results.map((r) => [r.industry.id, r]));
      for (const r of textResults) {
        const existing = merged.get(r.industry.id);
        if (existing) {
          existing.relevanceScore += r.relevanceScore;
          for (const t of r.matchedTerms) {
            if (!existing.matchedTerms.includes(t)) existing.matchedTerms.push(t);
          }
        } else {
          merged.set(r.industry.id, r);
        }
      }
      results = Array.from(merged.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    res.json(results);
  });

  router.post('/industry-mappings', (req, res) => {
    const id = `industry-${Date.now()}`;
    const now = new Date().toISOString();
    const mapping = {
      id,
      ...req.body,
      relatedConcepts: req.body.relatedConcepts || [],
      stocks: req.body.stocks || [],
      indices: req.body.indices || [],
      overseasMappings: req.body.overseasMappings || [],
      createdAt: now,
      updatedAt: now,
    };
    industryMappings.set(id, mapping);
    saveIndustryMappingsMap(industryMappings);
    res.status(201).json(mapping);
  });

  router.put('/industry-mappings/:id', (req, res) => {
    const existing = industryMappings.get(req.params.id);
    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: '行业映射不存在' });
      return;
    }
    const updated = { ...existing, ...req.body, id: existing.id, updatedAt: new Date().toISOString() };
    industryMappings.set(req.params.id, updated);
    saveIndustryMappingsMap(industryMappings);
    res.json(updated);
  });

  router.delete('/industry-mappings/:id', (req, res) => {
    industryMappings.delete(req.params.id);
    saveIndustryMappingsMap(industryMappings);
    res.status(204).end();
  });

  // ==================== Lexicons（数据见根目录 data/lexicons.json） ====================

  const lexicons = loadLexicons();

  router.get('/lexicons', (req, res) => {
    const category = req.query.category as string | undefined;
    const filtered = category ? lexicons.filter((l) => l.category === category) : lexicons;
    res.json(filtered);
  });

  router.post('/lexicons', (req, res) => {
    const entry = { id: `lex-${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
    lexicons.push(entry);
    saveLexicons(lexicons);
    res.status(201).json(entry);
  });

  router.delete('/lexicons/:id', (req, res) => {
    const idx = lexicons.findIndex((l) => l.id === req.params.id);
    if (idx !== -1) lexicons.splice(idx, 1);
    saveLexicons(lexicons);
    res.status(204).end();
  });

  // ==================== Crawler Management ====================

  router.get('/crawlers/status', (_req, res) => {
    res.json({
      crawlers: scheduler.getStatuses(),
      storageSize: storage.getSize(),
    });
  });

  router.post('/crawlers/run-all', async (_req, res) => {
    const results = await scheduler.runAllEnabled();
    storage.save();
    res.json({ results, storageSize: storage.getSize() });
  });

  router.post('/crawlers/:name/run', async (req, res) => {
    const result = await scheduler.runSingle(req.params.name);
    storage.save();
    res.json({ ...result, storageSize: storage.getSize() });
  });

  router.post('/crawlers/:name/toggle', (req, res) => {
    const crawler = scheduler.getCrawler(req.params.name);
    if (!crawler) {
      res.status(404).json({ code: 'NOT_FOUND', message: '爬虫不存在' });
      return;
    }
    const enabled = req.body.enabled ?? !crawler.getStatus().enabled;
    crawler.setEnabled(enabled);
    res.json(crawler.getStatus());
  });

  return router;
}

function initDefaultAlerts(alerts: Map<string, any>) {
  const defaults = [
    {
      id: 'alert-001', title: '负面舆情激增预警', description: '过去2小时内负面内容激增',
      riskLevel: 'critical', status: 'pending', ruleName: '负面声量突增预警',
      triggeredAt: new Date().toISOString(), relatedContentIds: [], handleRecords: [],
    },
    {
      id: 'alert-002', title: '市场情绪指数偏低', description: '当前平均情绪指数低于阈值',
      riskLevel: 'high', status: 'processing', ruleName: '情绪阈值预警',
      triggeredAt: new Date(Date.now() - 3600000).toISOString(), relatedContentIds: [],
      handleRecords: [{ handler: '管理员', action: 'start_processing', note: '调查中', timestamp: new Date().toISOString() }],
    },
  ];
  for (const a of defaults) alerts.set(a.id, a);
}
