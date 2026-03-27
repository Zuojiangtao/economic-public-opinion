import type { Alert, AlertRule } from '../../api/types';

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    title: '房地产板块负面舆情爆发',
    description: '过去2小时内，房地产相关负面内容激增150%，涉及多家房企债务违约传闻',
    riskLevel: 'critical',
    status: 'pending',
    ruleName: '负面声量突增预警',
    triggeredAt: '2026-03-19T14:30:00Z',
    relatedContentIds: ['content-0012', 'content-0045', 'content-0078'],
    handleRecords: [],
  },
  {
    id: 'alert-002',
    title: '央行政策相关负面情绪上升',
    description: '央行相关内容情绪指数跌破阈值，当前均值-0.65',
    riskLevel: 'high',
    status: 'processing',
    ruleName: '情绪阈值预警',
    triggeredAt: '2026-03-19T10:15:00Z',
    relatedContentIds: ['content-0023', 'content-0056'],
    handleRecords: [
      {
        handler: '管理员',
        action: 'start_processing',
        note: '已开始调查情绪下降原因',
        timestamp: '2026-03-19T10:30:00Z',
      },
    ],
  },
  {
    id: 'alert-003',
    title: '半导体行业风险信息增多',
    description: '检测到多条关于半导体供应链风险的高风险级别内容',
    riskLevel: 'high',
    status: 'pending',
    ruleName: '高风险内容预警',
    triggeredAt: '2026-03-19T09:00:00Z',
    relatedContentIds: ['content-0034'],
    handleRecords: [],
  },
  {
    id: 'alert-004',
    title: '新能源板块异常讨论量',
    description: '新能源相关讨论量在1小时内超过日常均值3倍',
    riskLevel: 'medium',
    status: 'resolved',
    ruleName: '声量异常预警',
    triggeredAt: '2026-03-18T16:00:00Z',
    relatedContentIds: ['content-0089', 'content-0091'],
    handleRecords: [
      {
        handler: '管理员',
        action: 'start_processing',
        note: '开始分析讨论内容',
        timestamp: '2026-03-18T16:15:00Z',
      },
      {
        handler: '管理员',
        action: 'resolve',
        note: '经分析，讨论量激增系比亚迪发布新车型导致，非风险事件',
        timestamp: '2026-03-18T17:00:00Z',
      },
    ],
  },
  {
    id: 'alert-005',
    title: '金融监管新政引发市场讨论',
    description: '金融监管相关关键词命中高风险词库',
    riskLevel: 'medium',
    status: 'ignored',
    ruleName: '风险词命中预警',
    triggeredAt: '2026-03-17T11:00:00Z',
    relatedContentIds: ['content-0102'],
    handleRecords: [
      {
        handler: '管理员',
        action: 'ignore',
        note: '经确认为常规政策解读，无实际风险',
        timestamp: '2026-03-17T11:30:00Z',
      },
    ],
  },
  {
    id: 'alert-006',
    title: '白酒行业负面信息集中',
    description: '白酒行业相关负面内容占比超过60%',
    riskLevel: 'low',
    status: 'resolved',
    ruleName: '负面占比预警',
    triggeredAt: '2026-03-16T08:00:00Z',
    relatedContentIds: ['content-0120'],
    handleRecords: [
      {
        handler: '管理员',
        action: 'resolve',
        note: '已完成分析，系部分媒体对行业库存问题的集中报道',
        timestamp: '2026-03-16T10:00:00Z',
      },
    ],
  },
];

export const mockAlertRules: AlertRule[] = [
  {
    id: 'rule-001',
    name: '负面声量突增预警',
    description: '当负面内容数量在2小时内增长超过100%时触发',
    enabled: true,
    conditions: {
      sentimentBelow: -0.3,
      volumeThreshold: 100,
      sourceTypes: ['news', 'forums', 'social'],
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-002',
    name: '情绪阈值预警',
    description: '当监测方案内平均情绪指数低于设定阈值时触发',
    enabled: true,
    conditions: {
      sentimentBelow: -0.5,
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-003',
    name: '高风险内容预警',
    description: '当出现高风险或极高风险级别内容时立即触发',
    enabled: true,
    conditions: {
      riskLevelAbove: 'high',
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-004',
    name: '风险词命中预警',
    description: '当内容命中风险词库中的关键词时触发',
    enabled: true,
    conditions: {
      keywords: ['暴雷', '违约', '跑路', '崩盘', '做空'],
    },
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'rule-005',
    name: '声量异常预警',
    description: '当某主题讨论量超过日均值3倍时触发',
    enabled: false,
    conditions: {
      volumeThreshold: 300,
      sourceTypes: ['forums', 'social'],
    },
    createdAt: '2026-02-15T00:00:00Z',
  },
];
