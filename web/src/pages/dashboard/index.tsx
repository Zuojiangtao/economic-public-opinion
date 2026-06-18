import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Tag,
  Typography,
  Badge,
  Segmented,
  Space,
  Empty,
  Tooltip,
} from 'antd';
import {
  WarningOutlined,
  AlertOutlined,
  FireOutlined,
  RiseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client.ts';
import type {
  Alert,
  TemperatureLevel,
  ContentItem,
  FinancialEventType,
} from '@/api/types.ts';
import ContentDetailDrawer from '@/components/ContentDetailDrawer.tsx';
import Panel from '@/components/Panel.tsx';
import StatCard, { getTemperatureColor } from '@/components/StatCard.tsx';
import ProgressBar from '@/components/ProgressBar.tsx';
import SentimentBadge from '@/components/SentimentBadge.tsx';
import StatusDot from '@/components/StatusDot.tsx';

// ============================================================
// Temperature level config (CSS variables)
// ============================================================
const levelConfig: Record<TemperatureLevel, { label: string; color: string }> = {
  hot:      { label: '过热', color: 'var(--temp-overheated)' },
  warm:     { label: '偏热', color: 'var(--temp-warm)' },
  neutral:  { label: '中性', color: 'var(--temp-neutral)' },
  cool:     { label: '偏冷', color: 'var(--temp-cool)' },
  freezing: { label: '冰点', color: 'var(--temp-freezing)' },
};

const riskColorMap: Record<string, string> = {
  low: 'var(--accent-success)',
  medium: 'var(--accent-warning)',
  high: '#F97316',
  critical: 'var(--accent-danger)',
};

const statusMap: Record<string, { text: string; color: string }> = {
  pending:    { text: '待处理', color: 'var(--accent-danger)' },
  processing: { text: '处理中', color: 'var(--accent-info)' },
  resolved:   { text: '已解决', color: 'var(--accent-success)' },
  ignored:    { text: '已忽略', color: 'var(--text-muted)' },
};

const eventTypeLabels: Partial<Record<FinancialEventType, string>> = {
  policy_change:       '政策变化',
  earnings_forecast:   '业绩预告',
  shareholding_change: '增减持',
  merger_acquisition:  '并购重组',
  regulatory_penalty:  '监管处罚',
  debt_default:        '债务违约',
  industry_prosperity: '产业景气',
  rating_change:       '评级变化',
};

const highRiskEventTypes: FinancialEventType[] = ['regulatory_penalty', 'debt_default'];

type TimeRange = '今日' | '近24小时' | '近7日';

function getDateRange(range: TimeRange): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate: string;
  if (range === '今日') {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    startDate = today.toISOString();
  } else if (range === '近24小时') {
    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  } else {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  return { startDate, endDate };
}

function getTempBarColor(score: number): string {
  return getTemperatureColor(score);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('今日');
  const { startDate, endDate } = useMemo(() => getDateRange(timeRange), [timeRange]);

  const { data: summary } = useQuery({
    queryKey: ['dashboardSummary', { startDate, endDate }],
    queryFn: () => dashboardApi.getSummary({ startDate, endDate }),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  const tempTop5 = summary?.temperatureTopList ?? [];
  const topAlerts = summary?.topAlerts ?? [];
  const keyContents = summary?.keyContents ?? [];
  const eventDist = summary?.eventDistribution;
  const crawlerHealth = summary?.crawlerHealth;

  const kpiCards = [
    {
      label: '待处理预警',
      value: summary?.pendingAlertCount ?? 0,
      color: 'var(--accent-danger)',
      icon: <WarningOutlined />,
      onClick: () => navigate('/alerts?status=pending'),
    },
    {
      label: '高风险预警',
      value: summary?.highRiskAlertCount ?? 0,
      color: '#F97316',
      icon: <AlertOutlined />,
      onClick: () => navigate('/alerts?riskLevel=high'),
    },
    {
      label: '最热行业',
      value: summary?.hotIndustry?.score ?? '-',
      color: summary?.hotIndustry ? getTemperatureColor(summary.hotIndustry.score) : undefined,
      icon: <FireOutlined />,
      trendLabel: summary?.hotIndustry?.industryName,
      onClick: () => navigate('/temperature'),
    },
    {
      label: '升温最快',
      value: summary?.fastestRisingIndustry?.scoreDelta !== undefined
        ? '+' + summary.fastestRisingIndustry.scoreDelta
        : '-',
      color: '#F97316',
      icon: <RiseOutlined />,
      trendLabel: summary?.fastestRisingIndustry?.industryName,
      onClick: () => navigate('/temperature'),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Typography.Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>工作台</Typography.Title>
        <Segmented
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
          options={['今日', '近24小时', '近7日']}
        />
      </div>

      {/* Row 1: KPI Cards */}
      <Row gutter={[12, 12]}>
        {kpiCards.map((kpi, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <StatCard
              label={kpi.label}
              value={kpi.value}
              color={kpi.color}
              icon={kpi.icon}
              trendLabel={kpi.trendLabel}
              onClick={kpi.onClick}
            />
          </Col>
        ))}
      </Row>

      {/* Row 2: Temperature Ranking + Alert List */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={14}>
          <Panel
            title="行业温度排行"
            extra={
              <a onClick={() => navigate('/temperature')} style={{ cursor: 'pointer', color: 'var(--accent-info)', fontSize: 12 }}>
                查看全部 →
              </a>
            }
          >
            {tempTop5.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {tempTop5.map((t, idx) => {
                  const cfg = levelConfig[t.level];
                  return (
                    <div
                      key={t.industryId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: idx < tempTop5.length - 1 ? '1px solid var(--border-default)' : 'none',
                        cursor: 'pointer',
                        gap: 10,
                      }}
                      onClick={() => navigate('/temperature')}
                    >
                      <span style={{ width: 20, color: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                        {idx + 1}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500, fontSize: 14, color: 'var(--text-primary)' }}>
                        {t.industryName}
                      </span>
                      <Tooltip
                        title={
                          '情绪' + t.breakdown.sentimentScore +
                          ' 声量' + t.breakdown.volumeAnomalyScore +
                          ' 传播' + t.breakdown.spreadIntensityScore +
                          ' 可信度' + t.breakdown.sourceCredibilityScore
                        }
                      >
                        <span style={{ color: cfg.color, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-mono)', minWidth: 36, textAlign: 'right' }}>
                          {t.score}
                        </span>
                      </Tooltip>
                      {t.scoreDelta !== undefined && (
                        <span style={{
                          color: t.scoreDelta > 0 ? 'var(--accent-danger)' : t.scoreDelta < 0 ? 'var(--accent-success)' : 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          fontSize: 12,
                          minWidth: 40,
                          textAlign: 'right',
                        }}>
                          {t.scoreDelta > 0 ? '+' : ''}{t.scoreDelta}
                        </span>
                      )}
                      <div style={{ width: 80, flexShrink: 0 }}>
                        <ProgressBar value={t.score} color={getTempBarColor(t.score)} height={4} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8, borderTop: '1px solid var(--border-default)' }}>
              {Object.entries(levelConfig).map(([key, cfg]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cfg.label}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Col>

        <Col xs={24} lg={10}>
          <Panel
            title={
              <Space size={8}>
                预警列表
                {summary?.pendingAlertCount ? (
                  <Badge count={summary.pendingAlertCount} overflowCount={99} style={{ backgroundColor: 'var(--accent-danger)' }} />
                ) : null}
              </Space>
            }
            extra={
              <a onClick={() => navigate('/alerts')} style={{ cursor: 'pointer', color: 'var(--accent-info)', fontSize: 12 }}>
                查看全部 →
              </a>
            }
          >
            {topAlerts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topAlerts.map((alert, idx) => (
                  <div
                    key={alert.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: idx < topAlerts.length - 1 ? '1px solid var(--border-default)' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/alerts?openId=' + alert.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        flex: 1,
                        fontWeight: 500,
                        fontSize: 13,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {alert.title}
                      </span>
                      <Tag
                        style={{
                          background: alert.riskLevel === 'critical'
                            ? 'var(--accent-danger-bg)'
                            : alert.riskLevel === 'high'
                              ? 'var(--accent-warning-bg)'
                              : 'var(--bg-input)',
                          color: riskColorMap[alert.riskLevel] || 'var(--text-muted)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 10,
                          fontWeight: 600,
                          lineHeight: '16px',
                          padding: '0 6px',
                          flexShrink: 0,
                        }}
                      >
                        {alert.riskLevel.toUpperCase()}
                      </Tag>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(alert.triggeredAt).toLocaleString('zh-CN', {
                        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="暂无预警" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Panel>
        </Col>
      </Row>

      {/* Row 3: Risk Distribution + Key Content */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={10}>
          <Panel title="风险分布">
            {!eventDist || eventDist.distribution.length === 0 ? (
              <Empty description="暂无事件数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {eventDist.distribution.map((item) => {
                  const isHighRisk = highRiskEventTypes.includes(item.type as FinancialEventType);
                  const pct = eventDist.total > 0 ? Math.round((item.count / eventDist.total) * 100) : 0;
                  return (
                    <div key={item.type} style={{ cursor: 'pointer' }} onClick={() => navigate('/search?eventType=' + item.type)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 13,
                            fontWeight: isHighRisk ? 600 : 400,
                            color: isHighRisk ? 'var(--accent-danger)' : 'var(--text-primary)',
                          }}>
                            {eventTypeLabels[item.type as FinancialEventType] ?? item.type}
                          </span>
                          {isHighRisk && (
                            <span style={{
                              fontSize: 10,
                              background: 'var(--accent-danger-bg)',
                              color: 'var(--accent-danger)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0 4px',
                              lineHeight: '16px',
                              fontWeight: 600,
                            }}>
                              高危
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {item.count} 条
                        </span>
                      </div>
                      <ProgressBar value={pct} color={isHighRisk ? 'var(--accent-danger)' : 'var(--accent-info)'} height={4} />
                    </div>
                  );
                })}
              </div>
            )}

            {crawlerHealth && (
              <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border-default)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  {crawlerHealth.failedCount === 0 ? (
                    <CheckCircleOutlined style={{ color: 'var(--accent-success)' }} />
                  ) : (
                    <ExclamationCircleOutlined style={{ color: 'var(--accent-warning)' }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>采集健康摘要</span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>可用数据源</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: crawlerHealth.failedCount === 0 ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                      {crawlerHealth.availableCount}
                      <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> / {crawlerHealth.totalCount}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>异常来源</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 18, color: crawlerHealth.failedCount === 0 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                      {crawlerHealth.failedCount}
                    </div>
                  </div>
                </div>
                {crawlerHealth.failedCount > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {crawlerHealth.recentFailures.map((f) => (
                      <div key={f.name} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '4px 0',
                        borderBottom: '1px solid var(--border-default)',
                        fontSize: 12,
                      }}>
                        <Space size={4}>
                          <StatusDot status="异常" />
                          <span style={{ color: 'var(--text-primary)' }}>{f.sourceName}</span>
                        </Space>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {f.lastFailedAt
                            ? new Date(f.lastFailedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </Col>

        <Col xs={24} lg={14}>
          <Panel
            title="关键内容"
            extra={
              <a onClick={() => navigate('/search')} style={{ cursor: 'pointer', color: 'var(--accent-info)', fontSize: 12 }}>
                查看全部 →
              </a>
            }
          >
            {keyContents.length === 0 ? (
              <Empty description="暂无高影响力内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {keyContents.map((item, idx) => (
                  <div key={item.id} style={{
                    padding: '10px 0',
                    borderBottom: idx < keyContents.length - 1 ? '1px solid var(--border-default)' : 'none',
                  }}>
                    <a
                      style={{ display: 'block', fontWeight: 500, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}
                      onClick={() => { setSelectedContent(item); setDrawerOpen(true); }}
                    >
                      {item.title.length > 50 ? item.title.slice(0, 50) + '…' : item.title}
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {item.sourceName} · {new Date(item.publishedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <SentimentBadge
                        label={item.nlp.enhanced?.label || (item.nlp.sentimentLabel === 'positive' ? 'strong_positive' : item.nlp.sentimentLabel === 'negative' ? 'weak_negative' : 'neutral')}
                        size="small"
                      />
                      {item.matches.map((m) => (
                        <Tag key={m.projectId} style={{
                          background: 'var(--bg-input)',
                          color: 'var(--text-secondary)',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 10,
                          lineHeight: '16px',
                          padding: '0 4px',
                        }}>
                          {m.projectName}
                        </Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </Col>
      </Row>

      <ContentDetailDrawer
        open={drawerOpen}
        item={selectedContent}
        onClose={() => { setDrawerOpen(false); setSelectedContent(null); }}
      />
    </div>
  );
}
