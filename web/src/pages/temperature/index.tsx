import { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Progress,
  Tooltip,
  Segmented,
  Drawer,
  Descriptions,
  Statistic,
  Empty,
  List,
  Badge,
} from 'antd';
import {
  FireOutlined,
  ThunderboltOutlined,
  MinusCircleOutlined,
  ArrowDownOutlined,
  SnippetsOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { temperaturesApi } from '@/api/client.ts';
import type { TemperatureSnapshot, TemperatureLevel, TemperatureDetail } from '@/api/types.ts';

// ============================================================
// 温度分层展示配置
// ============================================================
const levelConfig: Record<
  TemperatureLevel,
  { label: string; color: string; tagColor: string; icon: React.ReactNode }
> = {
  hot:      { label: '过热', color: '#ff4d4f', tagColor: 'red',    icon: <FireOutlined /> },
  warm:     { label: '偏热', color: '#fa8c16', tagColor: 'orange', icon: <ThunderboltOutlined /> },
  neutral:  { label: '中性', color: '#1677ff', tagColor: 'blue',   icon: <MinusCircleOutlined /> },
  cool:     { label: '偏冷', color: '#52c41a', tagColor: 'cyan',   icon: <ArrowDownOutlined /> },
  freezing: { label: '冰点', color: '#722ed1', tagColor: 'purple', icon: <SnippetsOutlined /> },
};

// 温度进度条颜色
function getProgressColor(score: number) {
  if (score >= 80) return '#ff4d4f';
  if (score >= 60) return '#fa8c16';
  if (score >= 40) return '#1677ff';
  if (score >= 20) return '#52c41a';
  return '#722ed1';
}

// ============================================================
// 单行业温度卡片
// ============================================================
function TemperatureCard({
  snap,
  onClick,
}: {
  snap: TemperatureSnapshot;
  onClick: (snap: TemperatureSnapshot) => void;
}) {
  const cfg = levelConfig[snap.level];
  return (
    <Card
      hoverable
      size="small"
      onClick={() => onClick(snap)}
      style={{ cursor: 'pointer' }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong style={{ fontSize: 15 }}>
          {snap.industryName}
        </Typography.Text>
        <Tag color={cfg.tagColor} icon={cfg.icon}>
          {cfg.label}
        </Tag>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <Typography.Title
          level={2}
          style={{ margin: 0, color: cfg.color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
        >
          {snap.score}
        </Typography.Title>
        <div style={{ flex: 1 }}>
          <Progress
            percent={snap.score}
            showInfo={false}
            strokeColor={getProgressColor(snap.score)}
            size="small"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#999' }}>
        <Tooltip title="情绪得分">
          <span>情绪 {snap.breakdown.sentimentScore}</span>
        </Tooltip>
        <Tooltip title="声量异动">
          <span>声量 {snap.breakdown.volumeAnomalyScore}</span>
        </Tooltip>
        <Tooltip title="传播热度">
          <span>传播 {snap.breakdown.spreadIntensityScore}</span>
        </Tooltip>
        <span style={{ marginLeft: 'auto' }}>
          {snap.contentCount} 条
        </span>
      </div>
    </Card>
  );
}

// ============================================================
// 情绪/风险标签颜色
// ============================================================
const sentimentColor: Record<string, string> = { positive: 'green', neutral: 'blue', negative: 'red' };
const sentimentLabel: Record<string, string> = { positive: '正面', neutral: '中性', negative: '负面' };
const riskColor: Record<string, string> = { low: 'green', medium: 'orange', high: 'red', critical: 'volcano' };
const riskLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '极高' };

// ============================================================
// 详情抽屉
// ============================================================
function TemperatureDetailDrawer({
  snap,
  granularity,
  onClose,
}: {
  snap: TemperatureSnapshot | null;
  granularity: 'hour' | 'day';
  onClose: () => void;
}) {
  // 拉取详情（含风险分布 + 关键内容）
  const { data: detail } = useQuery<TemperatureDetail>({
    queryKey: ['temperature-detail', snap?.industryId, granularity],
    queryFn: () => temperaturesApi.getDetail(snap!.industryId, granularity),
    enabled: !!snap,
  });

  // 拉取历史趋势
  const { data: trend } = useQuery({
    queryKey: ['temperature-trend', snap?.industryId, granularity],
    queryFn: () => temperaturesApi.getTrend(snap!.industryId, { granularity, limit: 24 }),
    enabled: !!snap,
  });

  if (!snap) return null;
  const cfg = levelConfig[snap.level];
  const d = detail ?? snap as Partial<TemperatureDetail>;

  const breakdownOption = {
    tooltip: { trigger: 'axis' as const },
    radar: {
      indicator: [
        { name: '情绪得分\n(×35%)', max: 100 },
        { name: '声量异动\n(×25%)', max: 100 },
        { name: '传播热度\n(×20%)', max: 100 },
        { name: '来源可信度\n(×20%)', max: 100 },
      ],
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [
              snap.breakdown.sentimentScore,
              snap.breakdown.volumeAnomalyScore,
              snap.breakdown.spreadIntensityScore,
              snap.breakdown.sourceCredibilityScore,
            ],
            name: snap.industryName,
            areaStyle: { color: `${cfg.color}33` },
            lineStyle: { color: cfg.color },
            itemStyle: { color: cfg.color },
          },
        ],
      },
    ],
  };

  const sentimentPieOption = {
    tooltip: { trigger: 'item' as const },
    series: [
      {
        type: 'pie',
        radius: ['40%', '65%'],
        data: [
          { value: snap.sentimentDistribution.positive, name: '正面', itemStyle: { color: '#52c41a' } },
          { value: snap.sentimentDistribution.neutral,  name: '中性', itemStyle: { color: '#1677ff' } },
          { value: snap.sentimentDistribution.negative, name: '负面', itemStyle: { color: '#ff4d4f' } },
        ],
      },
    ],
  };

  const riskPieOption = d.riskDistribution
    ? {
        tooltip: { trigger: 'item' as const },
        series: [
          {
            type: 'pie',
            radius: ['40%', '65%'],
            data: [
              { value: d.riskDistribution.low,      name: '低风险',  itemStyle: { color: '#52c41a' } },
              { value: d.riskDistribution.medium,   name: '中风险',  itemStyle: { color: '#fa8c16' } },
              { value: d.riskDistribution.high,     name: '高风险',  itemStyle: { color: '#ff4d4f' } },
              { value: d.riskDistribution.critical, name: '极高风险',itemStyle: { color: '#820014' } },
            ],
          },
        ],
      }
    : null;

  const trendItems = trend?.items ?? [];
  const trendLineOption = trendItems.length > 1
    ? {
        tooltip: { trigger: 'axis' as const },
        grid: { left: 40, right: 16, top: 20, bottom: 40 },
        xAxis: {
          type: 'category' as const,
          data: trendItems.map((s) =>
            new Date(s.snapshotAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          ),
          axisLabel: { rotate: 40, fontSize: 10 },
        },
        yAxis: { type: 'value' as const, min: 0, max: 100 },
        series: [
          {
            type: 'line',
            smooth: true,
            data: trendItems.map((s) => s.score),
            lineStyle: { color: cfg.color },
            itemStyle: { color: cfg.color },
            areaStyle: { color: `${cfg.color}22` },
          },
        ],
      }
    : null;

  return (
    <Drawer
      title={
        <span>
          {snap.industryName}&nbsp;
          <Tag color={cfg.tagColor} icon={cfg.icon}>{cfg.label}</Tag>
        </span>
      }
      width={520}
      open={!!snap}
      onClose={onClose}
      destroyOnHidden
    >
      <Row gutter={[12, 12]}>
        <Col span={8}>
          <Statistic title="综合温度" value={snap.score} suffix="/ 100"
            valueStyle={{ color: cfg.color, fontWeight: 700 }} />
        </Col>
        <Col span={8}>
          <Statistic title="命中内容" value={snap.contentCount} suffix="条" />
        </Col>
        <Col span={8}>
          <Statistic title="快照粒度" value={snap.granularity === 'hour' ? '小时级' : '日级'} />
        </Col>
      </Row>

      {/* 历史趋势折线图 */}
      {trendLineOption && (
        <>
          <Typography.Title level={5} style={{ marginTop: 20 }}>温度历史趋势</Typography.Title>
          <ReactECharts option={trendLineOption} style={{ height: 180 }} />
        </>
      )}

      <Typography.Title level={5} style={{ marginTop: 16 }}>分项雷达图</Typography.Title>
      <ReactECharts option={breakdownOption} style={{ height: 240 }} />

      <Row gutter={12}>
        <Col span={12}>
          <Typography.Title level={5} style={{ marginTop: 8 }}>情绪分布</Typography.Title>
          <ReactECharts option={sentimentPieOption} style={{ height: 180 }} />
        </Col>
        {riskPieOption && (
          <Col span={12}>
            <Typography.Title level={5} style={{ marginTop: 8 }}>风险分布</Typography.Title>
            <ReactECharts option={riskPieOption} style={{ height: 180 }} />
          </Col>
        )}
      </Row>

      <Typography.Title level={5} style={{ marginTop: 8 }}>分项明细</Typography.Title>
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="情绪得分 (×35%)">
          <Progress percent={snap.breakdown.sentimentScore} size="small" strokeColor="#52c41a" />
        </Descriptions.Item>
        <Descriptions.Item label="声量异动 (×25%)">
          <Progress percent={snap.breakdown.volumeAnomalyScore} size="small" strokeColor="#1677ff" />
        </Descriptions.Item>
        <Descriptions.Item label="传播热度 (×20%)">
          <Progress percent={snap.breakdown.spreadIntensityScore} size="small" strokeColor="#fa8c16" />
        </Descriptions.Item>
        <Descriptions.Item label="来源可信度 (×20%)">
          <Progress percent={snap.breakdown.sourceCredibilityScore} size="small" strokeColor="#722ed1" />
        </Descriptions.Item>
      </Descriptions>

      {/* 关键驱动内容 */}
      {d.topContents && d.topContents.length > 0 && (
        <>
          <Typography.Title level={5} style={{ marginTop: 16 }}>关键驱动内容</Typography.Title>
          <List
            size="small"
            dataSource={d.topContents}
            renderItem={(item) => (
              <List.Item style={{ padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Typography.Text style={{ flex: 1, marginRight: 8, fontSize: 13 }} ellipsis>
                      <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                        <LinkOutlined style={{ marginRight: 4, opacity: 0.5 }} />
                        {item.title}
                      </a>
                    </Typography.Text>
                    <Badge color={riskColor[item.riskLevel]} text={riskLabel[item.riskLevel]} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#999' }}>
                    <Tag style={{ fontSize: 11, margin: 0 }} color={sentimentColor[item.sentiment]}>
                      {sentimentLabel[item.sentiment]}
                    </Tag>
                    <span>{item.sourceName}</span>
                    <span>{new Date(item.publishedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </>
      )}

      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
        快照时间：{new Date(snap.snapshotAt).toLocaleString('zh-CN')}
      </Typography.Text>
    </Drawer>
  );
}

// ============================================================
// 主页面
// ============================================================
export default function TemperaturePage() {
  const [granularity, setGranularity] = useState<'hour' | 'day'>('hour');
  const [selectedSnap, setSelectedSnap] = useState<TemperatureSnapshot | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['temperatures', granularity],
    queryFn: () => temperaturesApi.list({ granularity }),
  });

  const items = data?.items ?? [];

  // 分组：过热/偏热、中性、偏冷/冰点
  const hotItems  = items.filter((s) => s.level === 'hot' || s.level === 'warm');
  const coldItems = items.filter((s) => s.level === 'cool' || s.level === 'freezing');

  // 行业温度排行横向柱状图
  const rankOption = items.length
    ? {
        tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
        grid: { left: 90, right: 20, top: 10, bottom: 10 },
        xAxis: { type: 'value' as const, max: 100 },
        yAxis: {
          type: 'category' as const,
          data: [...items].reverse().map((s) => s.industryName),
        },
        series: [
          {
            type: 'bar',
            data: [...items].reverse().map((s) => ({
              value: s.score,
              itemStyle: { color: getProgressColor(s.score) },
            })),
            label: { show: true, position: 'right' as const, formatter: '{c}' },
          },
        ],
      }
    : {};

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>行业温度指数</Typography.Title>
        <Segmented
          value={granularity}
          onChange={(v) => setGranularity(v as 'hour' | 'day')}
          options={[
            { label: '小时级', value: 'hour' },
            { label: '日级',   value: 'day'  },
          ]}
        />
      </div>

      {/* 温度排行榜 */}
      <Card title="行业温度排行" loading={isLoading} style={{ marginBottom: 16 }}>
        {items.length > 0 ? (
          <ReactECharts option={rankOption} style={{ height: 260 }} />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>

      {/* 过热 / 偏热 */}
      {hotItems.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="danger" strong style={{ display: 'block', marginBottom: 8 }}>
            <FireOutlined /> 高温板块
          </Typography.Text>
          <Row gutter={[12, 12]}>
            {hotItems.map((s) => (
              <Col key={s.id} xs={24} sm={12} md={8} lg={6}>
                <TemperatureCard snap={s} onClick={setSelectedSnap} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* 全部行业卡片 */}
      <Typography.Text type="secondary" strong style={{ display: 'block', marginBottom: 8 }}>
        全部行业
      </Typography.Text>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Col key={i} xs={24} sm={12} md={8} lg={6}>
                <Card loading size="small" />
              </Col>
            ))
          : items.map((s) => (
              <Col key={s.id} xs={24} sm={12} md={8} lg={6}>
                <TemperatureCard snap={s} onClick={setSelectedSnap} />
              </Col>
            ))}
      </Row>

      {/* 偏冷 / 冰点 */}
      {coldItems.length > 0 && (
        <div>
          <Typography.Text style={{ color: '#722ed1' }} strong style={{ display: 'block', marginBottom: 8 }}>
            <ArrowDownOutlined /> 低温板块
          </Typography.Text>
          <Row gutter={[12, 12]}>
            {coldItems.map((s) => (
              <Col key={s.id} xs={24} sm={12} md={8} lg={6}>
                <TemperatureCard snap={s} onClick={setSelectedSnap} />
              </Col>
            ))}
          </Row>
        </div>
      )}

      <TemperatureDetailDrawer snap={selectedSnap} granularity={granularity} onClose={() => setSelectedSnap(null)} />
    </div>
  );
}
