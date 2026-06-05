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
import { loadSourceConfigs, saveSourceConfigs } from '../storage/sourceConfigsStore.js';
import {
  queryIndustriesByKeywords,
  queryIndustriesByText,
} from '../nlp/industryMappingService.js';
import { computeTemperatureSnapshots, computeTemperatureDetail } from '../temperature/temperatureService.js';
import {
  updateSnapshots,
  getSnapshotsByGranularity,
  pushToHistory,
  getHistory,
} from '../temperature/temperatureStore.js';
import { listClusters, getClusterById } from '../dedup/eventClusterStore.js';
import { queryCrawlLogs } from '../storage/crawlLogsStore.js';
import type { CrawlScheduler } from '../scheduler/CrawlScheduler.js';
import type { SourceType, SentimentLabel, RiskLevel, MarketType, IndustryType, AlertRule, Alert, AlertStatus } from '../types.js';
import { evaluateAlertRules } from '../alerts/alertEvaluationService.js';
import { analyzeFinancialSentiment, toBaseSentimentLabel } from '../nlp/financialSentimentModel.js';

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

  // 数据源配置（T006），用于温度计算中的来源可信度权重
  let sourceConfigs = loadSourceConfigs();

  // ==================== Contents ====================

  router.get('/contents', (req, res) => {
    const monitoringProjectId = req.query.monitoringProjectId as string | undefined;
    const project = monitoringProjectId ? projects.get(monitoringProjectId) : undefined;
    const monitoringProjectRules =
      project && monitoringProjectId
        ? {
            sourceTypes: (project.sourceTypes || []) as SourceType[],
            include: [
              ...(project.keywords?.core ?? project.keywords?.include ?? []),
              ...(project.keywords?.extended ?? []),
            ],
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

  // ==================== T011 金融语义情绪二次分析 ====================

  /**
   * POST /contents/:id/sentiment/analyze
   * 对指定内容触发（或重跑）增强情绪分析，返回 EnhancedSentimentResult。
   * 前端可在内容详情页手动触发，也可在告警详情中追溯。
   */
  router.post('/contents/:id/sentiment/analyze', async (req, res) => {
    const item = storage.getById(req.params.id);
    if (!item) {
      res.status(404).json({ code: 'NOT_FOUND', message: '内容不存在' });
      return;
    }
    try {
      const enhanced = await analyzeFinancialSentiment(
        item.title + ' ' + (item.content ?? ''),
        item.sourceType,
      );
      // 同步更新存储中的条目
      const updated = {
        ...item,
        nlp: {
          ...item.nlp,
          sentimentLabel: toBaseSentimentLabel(enhanced.label),
          enhanced,
        },
      };
      storage.upsert(updated);
      res.json(enhanced);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ code: 'ANALYSIS_ERROR', message: msg });
    }
  });


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

  const alerts = new Map<string, Alert>();
  initDefaultAlerts(alerts);

  // 注入告警回调到调度器，让爬虫熔断时可自动生成告警（T009）
  scheduler.setAlertCallback((alertData) => {
    if (!alerts.has(alertData.id)) {
      alerts.set(alertData.id, {
        ...alertData,
        status: 'pending',
        ruleName: '爬虫熔断预警',
        relatedContentIds: [],
        handleRecords: [],
      });
      console.log(`[AlertCallback] Auto-alert created: ${alertData.title}`);
    }
  });

  router.get('/alerts', (req, res) => {
    const status = req.query.status as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    let items = Array.from(alerts.values());
    if (status) items = items.filter((a) => a.status === status);
    if (riskLevel) items = items.filter((a) => a.riskLevel === riskLevel);
    // 按触发时间降序
    items.sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

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
    const statusMap: Record<string, AlertStatus> = {
      start_processing: 'processing',
      resolve: 'resolved',
      ignore: 'ignored',
      reopen: 'pending',
    };
    a.status = statusMap[req.body.action] ?? a.status;
    a.handleRecords = a.handleRecords || [];
    a.handleRecords.push({
      handler: '管理员',
      action: req.body.action,
      note: req.body.note || '',
      timestamp: new Date().toISOString(),
    });
    res.json(a);
  });

  // ==================== Alert Rules (in-memory, T010 升级版) ====================

  const alertRules: AlertRule[] = [
    {
      id: 'rule-001',
      name: '负面声量突增预警',
      description: '当负面内容数量在2小时内增长超过100%时触发',
      enabled: true,
      conditions: { negativeVolumeRiseAbove: 100, sourceTypes: ['news', 'forums', 'social'], windowMinutes: 120 },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rule-002',
      name: '情绪阈值预警',
      description: '当监测内容平均情绪指数低于设定阈值时触发',
      enabled: true,
      conditions: { sentimentBelow: -0.5, windowMinutes: 120 },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rule-003',
      name: '高风险内容预警',
      description: '当出现高风险或极高风险级别内容时立即触发',
      enabled: true,
      conditions: { riskLevelAbove: 'high', windowMinutes: 60 },
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'rule-004',
      name: '风险词命中预警',
      description: '当内容命中风险词库中的关键词时触发',
      enabled: true,
      conditions: { keywords: ['暴雷', '违约', '跑路', '崩盘', '做空', '债务危机'], windowMinutes: 120 },
      createdAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'rule-005',
      name: '行业温度过热预警',
      description: '当某行业温度指数超过80分时触发过热预警',
      enabled: true,
      conditions: { temperatureAbove: 80, windowMinutes: 60 },
      createdAt: '2026-03-01T00:00:00Z',
    },
    {
      id: 'rule-006',
      name: '行业温度快速升温预警',
      description: '当某行业温度指数在相邻两个快照之间上升超过15分时触发',
      enabled: true,
      conditions: { temperatureRiseAbove: 15, windowMinutes: 60 },
      createdAt: '2026-03-01T00:00:00Z',
    },
    {
      id: 'rule-007',
      name: '研报观点集中转向预警',
      description: '当近2小时内研报负面观点占比超过50%时触发',
      enabled: true,
      conditions: { brokerNegativeRatioAbove: 0.5, windowMinutes: 120 },
      createdAt: '2026-03-01T00:00:00Z',
    },
  ];

  router.get('/alert-rules', (_req, res) => {
    res.json(alertRules);
  });

  router.post('/alert-rules', (req, res) => {
    const rule: AlertRule = {
      id: `rule-${Date.now()}`,
      name: req.body.name,
      description: req.body.description || '',
      enabled: req.body.enabled ?? true,
      conditions: req.body.conditions || {},
      createdAt: new Date().toISOString(),
    };
    alertRules.push(rule);
    res.status(201).json(rule);
  });

  router.put('/alert-rules/:id', (req, res) => {
    const idx = alertRules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND', message: '规则不存在' });
      return;
    }
    const updated: AlertRule = {
      ...alertRules[idx],
      ...req.body,
      id: alertRules[idx].id,
      createdAt: alertRules[idx].createdAt,
      updatedAt: new Date().toISOString(),
    };
    alertRules[idx] = updated;
    res.json(updated);
  });

  router.delete('/alert-rules/:id', (req, res) => {
    const idx = alertRules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND', message: '规则不存在' });
      return;
    }
    alertRules.splice(idx, 1);
    res.status(204).end();
  });

  /** POST /alert-rules/:id/toggle — 快捷启停规则 */
  router.post('/alert-rules/:id/toggle', (req, res) => {
    const idx = alertRules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND', message: '规则不存在' });
      return;
    }
    alertRules[idx] = {
      ...alertRules[idx],
      enabled: req.body.enabled ?? !alertRules[idx].enabled,
      updatedAt: new Date().toISOString(),
    };
    res.json(alertRules[idx]);
  });

  /**
   * POST /alerts/evaluate
   * 手动触发一次预警规则计算（供管理员/调试使用）。
   * 返回本次新增的预警列表。
   */
  router.post('/alerts/evaluate', (_req, res) => {
    const newAlerts = runAlertEvaluation();
    res.json({ triggered: newAlerts.length, alerts: newAlerts });
  });

  /** 执行预警评估，将新预警写入 alerts Map，返回新增预警 */
  function runAlertEvaluation(): Alert[] {
    const allItems = storage.getAll();
    const newAlerts = evaluateAlertRules(alertRules, allItems);
    for (const a of newAlerts) {
      alerts.set(a.id, a);
      console.log(`[AlertEval] Triggered: [${a.riskLevel}] ${a.title}`);
    }
    return newAlerts;
  }

  // 每 5 分钟自动执行一次预警评估（T010 自动预警计算任务）
  const EVAL_INTERVAL_MS = 5 * 60 * 1000;
  const evalTimer = setInterval(() => {
    try {
      runAlertEvaluation();
    } catch (err) {
      console.error('[AlertEval] Evaluation error:', err);
    }
  }, EVAL_INTERVAL_MS);
  // Node.js 中 unref() 使定时器不阻止进程退出
  if (evalTimer.unref) evalTimer.unref();

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

  // ==================== Source Configs (T006) ====================

  /**
   * GET /source-configs
   * 返回所有数据源配置列表。
   * Query: sourceType（类型过滤）
   */
  router.get('/source-configs', (req, res) => {
    const sourceType = req.query.sourceType as SourceType | undefined;
    const result = sourceType
      ? sourceConfigs.filter((c) => c.sourceType === sourceType)
      : sourceConfigs;
    res.json(result);
  });

  /**
   * PUT /source-configs/:id
   * 更新单个数据源配置（仅允许更新可配置字段）。
   */
  router.put('/source-configs/:id', (req, res) => {
    const idx = sourceConfigs.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND', message: '数据源配置不存在' });
      return;
    }
    const allowed = ['credibilityScore', 'includeInTemperature', 'authorizationStatus', 'antiCrawlRisk', 'availabilityStatus', 'description'];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key];
    }
    sourceConfigs[idx] = { ...sourceConfigs[idx], ...patch, updatedAt: new Date().toISOString() };
    saveSourceConfigs(sourceConfigs);
    res.json(sourceConfigs[idx]);
  });

  /**
   * POST /source-configs/:id/toggle
   * 快捷切换数据源是否纳入温度计算。
   */
  router.post('/source-configs/:id/toggle', (req, res) => {
    const idx = sourceConfigs.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND', message: '数据源配置不存在' });
      return;
    }
    sourceConfigs[idx] = {
      ...sourceConfigs[idx],
      includeInTemperature: req.body.includeInTemperature ?? !sourceConfigs[idx].includeInTemperature,
      updatedAt: new Date().toISOString(),
    };
    saveSourceConfigs(sourceConfigs);
    res.json(sourceConfigs[idx]);
  });

  // ==================== Event Clusters (T007) ====================

  /**
   * GET /event-clusters
   * 返回事件簇列表，按聚合互动量降序排列。
   * Query:
   *   page            = 页码（默认 1）
   *   pageSize        = 每页条数（默认 20，最大 100）
   *   minSourceCount  = 至少涉及来源数（过滤跨平台事件）
   *   maxRiskLevel    = 风险等级下限（low|medium|high|critical）
   *   sortBy          = totalEngagement|sourceCount|firstSeenAt|lastSeenAt
   *   sortOrder       = asc|desc
   */
  router.get('/event-clusters', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const minSourceCount = req.query.minSourceCount ? parseInt(req.query.minSourceCount as string) : undefined;
    const maxRiskLevel = req.query.maxRiskLevel as string | undefined;
    const sortBy = (['totalEngagement', 'sourceCount', 'firstSeenAt', 'lastSeenAt'] as const)
      .find((v) => v === req.query.sortBy) ?? 'totalEngagement';
    const sortOrder = req.query.sortOrder === 'asc' ? 'asc' : 'desc';

    const result = listClusters({ page, pageSize, minSourceCount, maxRiskLevel, sortBy, sortOrder });
    res.json(result);
  });

  /**
   * GET /event-clusters/:id
   * 返回单个事件簇详情，附带簇内每条内容的摘要。
   */
  router.get('/event-clusters/:id', (req, res) => {
    const cluster = getClusterById(req.params.id);
    if (!cluster) {
      res.status(404).json({ code: 'NOT_FOUND', message: '事件簇不存在' });
      return;
    }
    // 附带每条内容摘要（id/title/sourceName/publishedAt/sentiment/riskLevel/url）
    const itemSummaries = cluster.itemIds.map((itemId) => {
      const item = storage.getById(itemId);
      if (!item) return null;
      return {
        id: item.id,
        title: item.title,
        sourceName: item.sourceName,
        sourceType: item.sourceType,
        publishedAt: item.publishedAt,
        sentiment: item.nlp.sentimentLabel,
        riskLevel: item.nlp.riskLevel,
        url: item.url,
      };
    }).filter(Boolean);

    res.json({ ...cluster, items: itemSummaries });
  });

  /**
   * POST /event-clusters/refresh
   * 触发一次全量重新聚类（管理员操作，生产环境可接入权限控制）。
   */
  router.post('/event-clusters/refresh', (_req, res) => {
    storage.runDedup();
    const result = listClusters({ page: 1, pageSize: 1 });
    res.json({ message: '重新聚类完成', total: result.total });
  });

  // ==================== Temperatures ====================

  /**
   * 计算并刷新温度快照的辅助函数。
   * 每次请求时按需重新计算（MVP 阶段不做缓存过期，直接实时算）。
   */
  function refreshTemperatures(
    granularity: 'hour' | 'day' = 'hour',
    industryFilter?: (m: ReturnType<typeof industryMappings.values> extends IterableIterator<infer T> ? T : never) => boolean,
  ) {
    let industries = Array.from(industryMappings.values());
    if (industryFilter) industries = industries.filter(industryFilter);
    const allItems = storage.getAll();
    const snapshots = computeTemperatureSnapshots(industries, allItems, granularity, sourceConfigs);
    updateSnapshots(snapshots);
    pushToHistory(snapshots);
    return snapshots;
  }

  /**
   * GET /temperatures
   * 返回行业温度排名列表，按温度降序排列。
   * Query:
   *   granularity  = hour | day（默认 hour）
   *   type         = industry | sector | concept | theme（行业类型过滤）
   *   market       = cn | hk | us（按包含该市场股票过滤）
   *   projectId    = 监测方案 ID（仅返回该方案 targetIds 内的行业）
   */
  router.get('/temperatures', (req, res) => {
    const granularity = req.query.granularity === 'day' ? 'day' : 'hour';
    const type = req.query.type as IndustryType | undefined;
    const market = req.query.market as MarketType | undefined;
    const projectId = req.query.projectId as string | undefined;

    // 确定目标行业 ID 集合（来自监测方案）
    let targetIds: Set<string> | undefined;
    if (projectId) {
      const p = projects.get(projectId);
      if (p && p.targetIds?.length) targetIds = new Set(p.targetIds);
    }

    const industryFilter = (m: { type: string; stocks: Array<{ market: string }>; id: string }) => {
      if (type && m.type !== type) return false;
      if (market && !m.stocks.some((s) => s.market === market)) return false;
      if (targetIds && !targetIds.has(m.id)) return false;
      return true;
    };

    refreshTemperatures(granularity, industryFilter as Parameters<typeof refreshTemperatures>[1]);
    const snapshots = getSnapshotsByGranularity(granularity).filter((s) => {
      if (type) {
        const m = industryMappings.get(s.industryId);
        if (!m || m.type !== type) return false;
      }
      if (targetIds && !targetIds.has(s.industryId)) return false;
      // market 过滤已在 industryFilter 中处理，此处不重复
      return true;
    });

    res.json({
      items: snapshots,
      total: snapshots.length,
      granularity,
    });
  });

  /**
   * GET /temperatures/:industryId
   * 返回单个行业的温度详情（含风险分布和关键驱动内容）。
   * Query: granularity=hour|day（默认 hour）
   */
  router.get('/temperatures/:industryId', (req, res) => {
    const granularity = req.query.granularity === 'day' ? 'day' : 'hour';
    const industry = industryMappings.get(req.params.industryId);
    if (!industry) {
      res.status(404).json({ code: 'NOT_FOUND', message: '行业不存在' });
      return;
    }
    const allItems = storage.getAll();
    const detail = computeTemperatureDetail(industry, allItems, granularity, 5, sourceConfigs);
    // 同步更新快照缓存和历史
    updateSnapshots([detail]);
    pushToHistory([detail]);
    res.json(detail);
  });

  /**
   * GET /temperatures/:industryId/trend
   * 返回单个行业的温度历史趋势。
   * Query:
   *   granularity = hour | day（默认 hour）
   *   limit       = 返回条数，默认 24
   *   startDate   = ISO 日期字符串，过滤起始时间
   *   endDate     = ISO 日期字符串，过滤截止时间
   */
  router.get('/temperatures/:industryId/trend', (req, res) => {
    const { industryId } = req.params;
    if (!industryMappings.has(industryId)) {
      res.status(404).json({ code: 'NOT_FOUND', message: '行业不存在' });
      return;
    }
    const granularity = req.query.granularity === 'day' ? 'day' : 'hour';
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 24, 1), 168);
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // 如果历史为空，先触发一次计算以填充历史
    const history = getHistory(industryId, granularity, limit, startDate, endDate);
    if (history.length === 0) {
      const industry = industryMappings.get(industryId)!;
      const allItems = storage.getAll();
      const detail = computeTemperatureDetail(industry, allItems, granularity);
      updateSnapshots([detail]);
      pushToHistory([detail]);
    }

    const trend = getHistory(industryId, granularity, limit, startDate, endDate);
    res.json({
      industryId,
      industryName: industryMappings.get(industryId)?.name ?? industryId,
      granularity,
      items: trend,
      total: trend.length,
    });
  });

  // ==================== Crawler Management ====================

  router.get('/crawlers/status', (_req, res) => {
    res.json({
      crawlers: scheduler.getStatuses(),
      storageSize: storage.getSize(),
    });
  });

  /**
   * GET /crawlers/logs
   * 查询采集日志，按 crawledAt 降序返回。
   * Query:
   *   source      = 爬虫名称过滤
   *   success     = true|false 过滤
   *   startDate   = ISO 日期字符串
   *   endDate     = ISO 日期字符串
   *   page        = 页码（默认 1）
   *   pageSize    = 每页条数（默认 50，最大 200）
   */
  router.get('/crawlers/logs', (req, res) => {
    const result = queryCrawlLogs({
      source: req.query.source as string | undefined,
      success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    });
    res.json(result);
  });

  /**
   * GET /crawlers/:name/health
   * 返回单个爬虫的健康状态详情。
   */
  router.get('/crawlers/:name/health', (req, res) => {
    const crawler = scheduler.getCrawler(req.params.name);
    if (!crawler) {
      res.status(404).json({ code: 'NOT_FOUND', message: '爬虫不存在' });
      return;
    }
    const status = crawler.getStatus();
    res.json({
      name: status.name,
      sourceName: status.sourceName,
      enabled: status.enabled,
      healthScore: status.healthScore,
      circuitOpen: status.circuitOpen,
      circuitOpenUntil: status.circuitOpenUntil,
      consecutiveFailures: status.consecutiveFailures,
      totalAttempts: status.totalAttempts,
      totalFetched: status.totalFetched,
      lastCrawlAt: status.lastCrawlAt,
      lastSuccess: status.lastSuccess,
      lastError: status.lastError,
      lastItemAt: status.lastItemAt,
      isRunning: status.isRunning,
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

function initDefaultAlerts(alerts: Map<string, Alert>) {
  const defaults: Alert[] = [
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
