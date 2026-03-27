import { Row, Col, Card, Statistic, Table, Tag, Typography } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  FileTextOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { contentsApi, alertsApi } from '@/api/client.ts';
import type { Alert } from '@/api/types.ts';

const riskColorMap: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

const statusMap: Record<string, { text: string; color: string }> = {
  pending: { text: '待处理', color: 'red' },
  processing: { text: '处理中', color: 'blue' },
  resolved: { text: '已解决', color: 'green' },
  ignored: { text: '已忽略', color: 'default' },
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['contentStats'],
    queryFn: () => contentsApi.getStats(),
  });

  const { data: alertData, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', { page: 1, pageSize: 5 }],
    queryFn: () => alertsApi.list({ page: 1, pageSize: 5 }),
  });

  const trendOption = stats
    ? {
        tooltip: { trigger: 'axis' as const },
        legend: { data: ['正面', '中性', '负面'] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category' as const, data: stats.trendData.map((d) => d.date) },
        yAxis: { type: 'value' as const },
        series: [
          { name: '正面', type: 'line', data: stats.trendData.map((d) => d.positive), smooth: true, itemStyle: { color: '#52c41a' } },
          { name: '中性', type: 'line', data: stats.trendData.map((d) => d.neutral), smooth: true, itemStyle: { color: '#1677ff' } },
          { name: '负面', type: 'line', data: stats.trendData.map((d) => d.negative), smooth: true, itemStyle: { color: '#ff4d4f' } },
        ],
      }
    : {};

  const sentimentOption = stats
    ? {
        tooltip: { trigger: 'item' as const },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            data: [
              { value: stats.sentimentDistribution.positive, name: '正面', itemStyle: { color: '#52c41a' } },
              { value: stats.sentimentDistribution.neutral, name: '中性', itemStyle: { color: '#1677ff' } },
              { value: stats.sentimentDistribution.negative, name: '负面', itemStyle: { color: '#ff4d4f' } },
            ],
          },
        ],
      }
    : {};

  const sourceOption = stats
    ? {
        tooltip: { trigger: 'axis' as const },
        xAxis: {
          type: 'category' as const,
          data: stats.sourceDistribution.map((d) => {
            const labels: Record<string, string> = { news: '新闻', forums: '论坛', social: '社媒', broker: '研报', app: 'APP' };
            return labels[d.sourceType] || d.sourceType;
          }),
        },
        yAxis: { type: 'value' as const },
        series: [{ type: 'bar', data: stats.sourceDistribution.map((d) => d.count), itemStyle: { color: '#1677ff' } }],
      }
    : {};

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
      width: 80,
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
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>工作台</Typography.Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="今日舆情总量"
              value={stats?.totalCount || 0}
              prefix={<FileTextOutlined />}
              styles={{ content: { color: '#1677ff' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="正面舆情"
              value={stats?.sentimentDistribution.positive || 0}
              prefix={<ArrowUpOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={statsLoading}>
            <Statistic
              title="负面舆情"
              value={stats?.sentimentDistribution.negative || 0}
              prefix={<ArrowDownOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card loading={alertsLoading}>
            <Statistic
              title="待处理预警"
              value={alertData?.items.filter((a) => a.status === 'pending').length || 0}
              prefix={<WarningOutlined />}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="舆情趋势" loading={statsLoading}>
            {stats && <ReactECharts option={trendOption} style={{ height: 300 }} />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="情感分布" loading={statsLoading}>
            {stats && <ReactECharts option={sentimentOption} style={{ height: 300 }} />}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="来源分布" loading={statsLoading}>
            {stats && <ReactECharts option={sourceOption} style={{ height: 280 }} />}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={stats?.topKeywords?.length ? '热门关键词' : '热门实体'} loading={statsLoading}>
            {stats && (() => {
              const listData = stats.topKeywords?.length
                ? stats.topKeywords.map((k) => ({ label: k.keyword, count: k.count }))
                : stats.topEntities?.map((e) => ({ label: `${e.name}(${e.type})`, count: e.count })) || [];
              return (
                <div>
                  {listData.slice(0, 10).map((item, index) => (
                    <div
                      key={item.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: index < listData.length - 1 ? '1px solid #f0f0f0' : 'none',
                      }}
                    >
                      <span>
                        <Tag color={index < 3 ? 'red' : 'default'}>{index + 1}</Tag>
                        {item.label}
                      </span>
                      <span style={{ color: '#999' }}>{item.count}次</span>
                    </div>
                  ))}
                  {listData.length === 0 && (
                    <Typography.Text type="secondary">暂无数据</Typography.Text>
                  )}
                </div>
              );
            })()}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={
              <span>
                <AlertOutlined style={{ marginRight: 8 }} />
                最新预警
              </span>
            }
            extra={<a href="/alerts">查看全部</a>}
            loading={alertsLoading}
          >
            <Table<Alert>
              columns={alertColumns}
              dataSource={alertData?.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
