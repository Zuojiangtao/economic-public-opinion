import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Typography,
  Badge,
  Button,
  Segmented,
  Space,
  Empty,
  Tooltip,
  Progress,
  Alert as AntAlert,
} from 'antd';
import {
  WarningOutlined,
  AlertOutlined,
  FireOutlined,
  ThunderboltOutlined,
  RiseOutlined,
  FallOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ProjectOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/client.ts';
import type {
  Alert,
  TemperatureLevel,
  FinancialEventType,
  ContentItem,
} from '@/api/types.ts';
import ContentDetailDrawer from '@/components/ContentDetailDrawer.tsx';

// ============================================================
// 温度分层展示配置（与 temperature 页保持一致）
// ============================================================
const levelConfig: Record<TemperatureLevel, { label: string; color: string; tagColor: string }> = {
  hot:      { label: '过热', color: '#ff4d4f', tagColor: 'red' },
  warm:     { label: '偏热', color: '#fa8c16', tagColor: 'orange' },
  neutral:  { label: '中性', color: '#1677ff', tagColor: 'blue' },
  cool:     { label: '偏冷', color: '#52c41a', tagColor: 'cyan' },
  freezing: { label: '冰点', color: '#722ed1', tagColor: 'purple' },
};

const riskColorMap: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

const statusMap: Record<string, { text: string; color: string }> = {
  pending:    { text: '待处理', color: 'red' },
  processing: { text: '处理中', color: 'blue' },
  resolved:   { text: '已解决', color: 'green' },
  ignored:    { text: '已忽略', color: 'default' },
};

const sentimentColors: Record<string, string> = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
};
const sentimentLabels: Record<string, string> = {
  positive: '正面',
  neutral: '中性',
  negative: '负面',
};

// H009 事件类型标签
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

// ============================================================
// H005: 时间范围工具函数
// ============================================================
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

// ============================================================
// Dashboard
// ============================================================
export default function Dashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('今日');
  const { startDate, endDate } = useMemo(() => getDateRange(timeRange), [timeRange]);

  // H007: 单路聚合请求替代多路零散请求
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboardSummary', { startDate, endDate }],
    queryFn: () => dashboardApi.getSummary({ startDate, endDate }),
  });

  // H008: 关键内容详情抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);

  // 从聚合数据中解构各模块数据
  const tempTop5 = summary?.temperatureTopList ?? [];
  const risingTop3 = summary?.risingList ?? [];
  const fallingTop3 = summary?.fallingList ?? [];
  const topAlerts = summary?.topAlerts ?? [];
  const keyContents = summary?.keyContents ?? [];
  const eventDist = summary?.eventDistribution;
  const crawlerHealth = summary?.crawlerHealth;
  const projectHits = summary?.monitoringProjectHits ?? [];

  // H004: 预警列表列定义
  const alertColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 90,
      render: (level: string) => <Tag color={riskColorMap[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: string) => {
        const st = statusMap[s];
        return st ? <Tag color={st.color}>{st.text}</Tag> : s;
      },
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 130,
      render: (t: string) =>
        new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: unknown, record: Alert) => (
        <Button size="small" type="link" onClick={() => navigate(`/alerts?openId=${record.id}`)}>
          处置
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* H005: 标题行 + 时间范围筛选 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>工作台</Typography.Title>
        <Segmented
          value={timeRange}
          onChange={(v) => setTimeRange(v as TimeRange)}
          options={['今日', '近24小时', '近7日']}
        />
      </div>

      {/* H002: 6 个异常指标卡 */}
      <Row gutter={[16, 16]}>
        {/* 1. 待处理预警数 */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            hoverable
            onClick={() => navigate('/alerts?status=pending')}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="待处理预警"
              value={summary?.pendingAlertCount ?? 0}
              prefix={<WarningOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>

        {/* 2. 高风险预警数 */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            hoverable
            onClick={() => navigate('/alerts?riskLevel=high')}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="高风险预警"
              value={summary?.highRiskAlertCount ?? 0}
              prefix={<AlertOutlined />}
              styles={{ content: { color: '#fa541c' } }}
            />
          </Card>
        </Col>

        {/* 3. 最热行业 */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            hoverable
            onClick={() => navigate('/temperature')}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="最热行业"
              value={summary?.hotIndustry?.score ?? '-'}
              suffix={summary?.hotIndustry ? '分' : ''}
              prefix={<FireOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
            {summary?.hotIndustry && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{summary.hotIndustry.industryName}</div>
            )}
          </Card>
        </Col>

        {/* 4. 升温最快行业 */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            hoverable
            onClick={() => navigate('/temperature')}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="升温最快行业"
              value={summary?.fastestRisingIndustry?.scoreDelta !== undefined
                ? `+${summary.fastestRisingIndustry.scoreDelta}`
                : '-'}
              prefix={<RiseOutlined />}
              styles={{ content: { color: '#fa8c16' } }}
            />
            {summary?.fastestRisingIndustry && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{summary.fastestRisingIndustry.industryName}</div>
            )}
          </Card>
        </Col>

        {/* 5. 负面占比最高行业 */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            hoverable
            onClick={() => summary?.mostNegativeIndustry &&
              navigate(`/search?sentiment=negative&industryId=${summary.mostNegativeIndustry.industryId}`)
            }
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="负面占比最高"
              value={summary?.mostNegativeIndustry
                ? `${Math.round(summary.mostNegativeIndustry.negativeRatio * 100)}%`
                : '-'}
              prefix={<FallOutlined />}
              styles={{ content: { color: '#722ed1' } }}
            />
            {summary?.mostNegativeIndustry && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{summary.mostNegativeIndustry.industryName}</div>
            )}
          </Card>
        </Col>

        {/* 6. 高风险事件数（受时间范围影响） */}
        <Col xs={24} sm={12} md={8} xl={4}>
          <Card
            loading={isLoading}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Statistic
              title="高风险事件"
              value={summary?.recentHighRiskEventCount ?? 0}
              prefix={<ThunderboltOutlined />}
              styles={{ content: { color: '#cf1322' } }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{timeRange}异常事件</div>
          </Card>
        </Col>
      </Row>

      {/* H003: 行业温度摘要（第二行） */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 左侧：温度 Top 5 */}
        <Col xs={24} lg={14}>
          <Card
            title="行业温度 Top 5"
            loading={isLoading}
            extra={
              <a onClick={() => navigate('/temperature')} style={{ cursor: 'pointer' }}>
                查看全部
              </a>
            }
          >
            {tempTop5.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              tempTop5.map((t, idx) => {
                const cfg = levelConfig[t.level];
                return (
                  <div
                    key={t.industryId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: idx < tempTop5.length - 1 ? '1px solid #f0f0f0' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate('/temperature')}
                  >
                    <span style={{ width: 20, color: '#999', fontSize: 12 }}>{idx + 1}</span>
                    <Tag color={cfg.tagColor} style={{ minWidth: 42, textAlign: 'center', margin: '0 8px' }}>
                      {cfg.label}
                    </Tag>
                    <span style={{ flex: 1, fontWeight: 500 }}>{t.industryName}</span>
                    <Tooltip
                      title={`情绪${t.breakdown.sentimentScore} 声量${t.breakdown.volumeAnomalyScore} 传播${t.breakdown.spreadIntensityScore} 可信度${t.breakdown.sourceCredibilityScore}`}
                    >
                      <span style={{ color: cfg.color, fontWeight: 600, fontSize: 16, minWidth: 36, textAlign: 'right' }}>
                        {t.score}
                      </span>
                    </Tooltip>
                    {t.scoreDelta !== undefined && (
                      <span
                        style={{
                          marginLeft: 12,
                          color: t.scoreDelta > 0 ? '#ff4d4f' : t.scoreDelta < 0 ? '#52c41a' : '#999',
                          minWidth: 40,
                          textAlign: 'right',
                          fontSize: 12,
                        }}
                      >
                        {t.scoreDelta > 0 ? '+' : ''}{t.scoreDelta}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </Col>

        {/* 右侧：升降温前 3 */}
        <Col xs={24} lg={10}>
          <Card
            title="升降温动态"
            loading={isLoading}
            extra={
              <a onClick={() => navigate('/temperature')} style={{ cursor: 'pointer' }}>
                查看全部
              </a>
            }
          >
            {risingTop3.length === 0 && fallingTop3.length === 0 ? (
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <>
                {risingTop3.length > 0 && (
                  <>
                    <div style={{ fontWeight: 500, color: '#ff4d4f', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowUpOutlined /> 升温前 3
                    </div>
                    {risingTop3.map((t, idx) => (
                      <div
                        key={t.industryId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '7px 0',
                          borderBottom: '1px solid #f0f0f0',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate('/temperature')}
                      >
                        <Space size={6}>
                          <span style={{ color: '#999', fontSize: 12 }}>{idx + 1}</span>
                          <span>{t.industryName}</span>
                        </Space>
                        <span style={{ color: '#ff4d4f', fontWeight: 600 }}>+{t.scoreDelta}</span>
                      </div>
                    ))}
                  </>
                )}

                {fallingTop3.length > 0 && (
                  <div style={{ marginTop: risingTop3.length > 0 ? 14 : 0 }}>
                    <div style={{ fontWeight: 500, color: '#52c41a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ArrowDownOutlined /> 降温前 3
                    </div>
                    {fallingTop3.map((t, idx) => (
                      <div
                        key={t.industryId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '7px 0',
                          borderBottom: idx < fallingTop3.length - 1 ? '1px solid #f0f0f0' : 'none',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate('/temperature')}
                      >
                        <Space size={6}>
                          <span style={{ color: '#999', fontSize: 12 }}>{idx + 1}</span>
                          <span>{t.industryName}</span>
                        </Space>
                        <span style={{ color: '#52c41a', fontWeight: 600 }}>{t.scoreDelta}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* H008: 关键驱动内容 + H009: 风险事件分布（第三行） */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* H008: 关键驱动内容 */}
        <Col xs={24} lg={14}>
          <Card
            title="关键驱动内容"
            loading={isLoading}
            extra={
              <a onClick={() => navigate('/search')} style={{ cursor: 'pointer' }}>
                查看全部
              </a>
            }
          >
            {keyContents.length === 0 ? (
              <Empty description="暂无高影响力内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              keyContents.map((item, idx) => {
                const topEvent = item.nlp.events?.sort((a, b) => b.confidence - a.confidence)[0];
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 0',
                      borderBottom: idx < keyContents.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                      <a
                        style={{ flex: 1, fontWeight: 500, fontSize: 14 }}
                        onClick={() => {
                          setSelectedContent(item);
                          setDrawerOpen(true);
                        }}
                      >
                        {item.title.length > 50 ? item.title.slice(0, 50) + '…' : item.title}
                      </a>
                      <Tag color={sentimentColors[item.nlp.sentimentLabel]}>
                        {sentimentLabels[item.nlp.sentimentLabel]}
                      </Tag>
                      <Tag color={riskColorMap[item.nlp.riskLevel]}>
                        {item.nlp.riskLevel.toUpperCase()}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                      {item.sourceName} · {new Date(item.publishedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {item.nlp.summary && (
                      <div style={{ fontSize: 12, color: '#555', marginBottom: topEvent ? 4 : 0 }}>
                        {item.nlp.summary.length > 80 ? item.nlp.summary.slice(0, 80) + '…' : item.nlp.summary}
                      </div>
                    )}
                    {/* H014: 事件类型标签和置信度 */}
                    {topEvent && (
                      <Space size={4} style={{ marginTop: 4 }}>
                        <Tag
                          color={highRiskEventTypes.includes(topEvent.type as FinancialEventType) ? 'red' : 'default'}
                          style={{ fontSize: 11 }}
                        >
                          {eventTypeLabels[topEvent.type as FinancialEventType] ?? topEvent.type}
                        </Tag>
                        <span style={{ fontSize: 11, color: topEvent.confidence < 0.6 ? '#faad14' : '#52c41a' }}>
                          {topEvent.confidence < 0.6 ? '待确认' : `置信度 ${Math.round(topEvent.confidence * 100)}%`}
                        </span>
                      </Space>
                    )}
                  </div>
                );
              })
            )}
          </Card>
        </Col>

        {/* H009: 风险事件分布 */}
        <Col xs={24} lg={10}>
          <Card
            title="风险事件分布"
            loading={isLoading}
          >
            {!eventDist || eventDist.distribution.length === 0 ? (
              <Empty description="暂无事件数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div>
                {eventDist.distribution.map((item) => {
                  const isHighRisk = highRiskEventTypes.includes(item.type as FinancialEventType);
                  const pct = eventDist.total > 0 ? Math.round((item.count / eventDist.total) * 100) : 0;
                  return (
                    <div
                      key={item.type}
                      style={{ marginBottom: 10, cursor: 'pointer' }}
                      onClick={() => navigate(`/search?eventType=${item.type}`)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <Space size={4}>
                          <span style={{ fontSize: 13, fontWeight: isHighRisk ? 600 : 400, color: isHighRisk ? '#ff4d4f' : undefined }}>
                            {eventTypeLabels[item.type as FinancialEventType] ?? item.type}
                          </span>
                          {isHighRisk && <Tag color="red" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>高危</Tag>}
                        </Space>
                        <span style={{ fontSize: 12, color: '#666' }}>{item.count} 条</span>
                      </div>
                      <Progress
                        percent={pct}
                        size="small"
                        strokeColor={isHighRisk ? '#ff4d4f' : '#1677ff'}
                        showInfo={false}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* H004: 高优先级预警列表 + H010 采集健康 + H011 监测方案（第四行） */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 高优先级预警列表 */}
        <Col xs={24} xl={14}>
          <Card
            title={
              <Space>
                <AlertOutlined />
                高优先级预警
                <Badge count={summary?.pendingAlertCount ?? 0} overflowCount={99} />
              </Space>
            }
            extra={
              <a onClick={() => navigate('/alerts')} style={{ cursor: 'pointer' }}>
                查看全部
              </a>
            }
            loading={isLoading}
          >
            {topAlerts.length > 0 ? (
              <Table<Alert>
                columns={alertColumns}
                dataSource={topAlerts}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                description="暂无高风险待处理预警"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>

        {/* 右侧：H010 + H011 */}
        <Col xs={24} xl={10}>
          <Row gutter={[16, 16]}>
            {/* H010: 采集健康摘要 */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    {crawlerHealth?.failedCount === 0
                      ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      : <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                    采集健康摘要
                  </Space>
                }
                loading={isLoading}
                extra={
                  <a onClick={() => navigate('/settings')} style={{ cursor: 'pointer' }}>
                    查看详情
                  </a>
                }
                styles={{ body: { padding: '12px 16px' } }}
              >
                {crawlerHealth ? (
                  <>
                    <Row gutter={16} style={{ marginBottom: 8 }}>
                      <Col span={12}>
                        <Statistic
                          title="可用数据源"
                          value={crawlerHealth.availableCount}
                          suffix={`/ ${crawlerHealth.totalCount}`}
                          valueStyle={{ fontSize: 20, color: crawlerHealth.failedCount === 0 ? '#52c41a' : '#fa8c16' }}
                        />
                      </Col>
                      <Col span={12}>
                        <Statistic
                          title="异常来源"
                          value={crawlerHealth.failedCount}
                          valueStyle={{ fontSize: 20, color: crawlerHealth.failedCount === 0 ? '#52c41a' : '#ff4d4f' }}
                        />
                      </Col>
                    </Row>
                    {crawlerHealth.failedCount === 0 ? (
                      <AntAlert
                        message="采集正常"
                        type="success"
                        showIcon
                        style={{ fontSize: 12 }}
                      />
                    ) : (
                      <div>
                        {crawlerHealth.recentFailures.map((f) => (
                          <div
                            key={f.name}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '4px 0',
                              borderBottom: '1px solid #f0f0f0',
                              fontSize: 12,
                            }}
                          >
                            <Space size={4}>
                              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                              <span>{f.sourceName}</span>
                            </Space>
                            <span style={{ color: '#999' }}>
                              {f.lastFailedAt
                                ? new Date(f.lastFailedAt).toLocaleString('zh-CN', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Card>
            </Col>

            {/* H011: 监测方案命中排行 */}
            <Col xs={24}>
              <Card
                title={
                  <Space>
                    <ProjectOutlined />
                    监测方案命中排行
                  </Space>
                }
                loading={isLoading}
                extra={
                  <a onClick={() => navigate('/monitoring')} style={{ cursor: 'pointer' }}>
                    查看全部
                  </a>
                }
                styles={{ body: { padding: '12px 16px' } }}
              >
                {projectHits.length === 0 ? (
                  <Empty description="暂无命中数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  projectHits.map((p, idx) => (
                    <div
                      key={p.projectId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: idx < projectHits.length - 1 ? '1px solid #f0f0f0' : 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate('/monitoring')}
                    >
                      <span style={{ width: 18, color: '#999', fontSize: 12 }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{p.projectName}</span>
                      {p.hasHighRisk && (
                        <Tag color="red" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', marginRight: 6 }}>
                          高危
                        </Tag>
                      )}
                      <span style={{ color: '#1677ff', fontWeight: 600, fontSize: 14 }}>{p.hitCount}</span>
                    </div>
                  ))
                )}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {/* H008: 关键内容详情抽屉 */}
      <ContentDetailDrawer
        open={drawerOpen}
        item={selectedContent}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedContent(null);
        }}
      />
    </div>
  );
}
