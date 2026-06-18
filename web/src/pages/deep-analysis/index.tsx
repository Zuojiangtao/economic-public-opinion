import { useState } from 'react';
import {
  Button,
  DatePicker,
  Space,
  Typography,
  Tag,
  Timeline,
  Spin,
  Alert,
  Collapse,
  Empty,
  Divider,
  message,
  List,
  Badge,
} from 'antd';
import Panel from '../../components/Panel';
import {
  ThunderboltOutlined,
  HistoryOutlined,
  WarningOutlined,
  BulbOutlined,
  FireOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { deepAnalysisApi } from '../../api/client';
import type { DeepAnalysisRecord } from '../../api/types';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export default function DeepAnalysisPage() {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    dayjs().subtract(3, 'day'),
    dayjs(),
  ]);
  const [selectedRecord, setSelectedRecord] = useState<DeepAnalysisRecord | null>(null);
  const queryClient = useQueryClient();

  // Historical records list
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['deep-analysis-history'],
    queryFn: () => deepAnalysisApi.list(20),
  });

  // Run analysis mutation
  const runMutation = useMutation({
    mutationFn: () => {
      if (!dateRange[0] || !dateRange[1]) {
        throw new Error('请选择时间范围');
      }
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      return deepAnalysisApi.run(startDate, endDate);
    },
    onSuccess: (data) => {
      if (data.record) {
        setSelectedRecord(data.record);
        message.success(data.message);
      } else {
        message.info(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ['deep-analysis-history'] });
    },
    onError: (err: Error) => {
      message.error(`分析失败: ${err.message}`);
    },
  });

  const handleViewRecord = async (id: string) => {
    try {
      const record = await deepAnalysisApi.getById(id);
      setSelectedRecord(record);
    } catch {
      message.error('加载记录失败');
    }
  };

  const renderSummary = (record: DeepAnalysisRecord) => {
    const { summary } = record;
    return (
      <div>
        <Panel style={{ marginBottom: 16, background: 'var(--accent-success-bg)', borderColor: 'var(--accent-success)' }}>
          <Text strong>综合情绪: </Text>
          <Text>{summary.overallSentiment}</Text>
        </Panel>

        <Collapse
          defaultActiveKey={['events', 'risks', 'sectors', 'insights']}
          items={[
            {
              key: 'events',
              label: <Space><ThunderboltOutlined />关键事件 ({summary.keyEvents.length})</Space>,
              children: summary.keyEvents.length > 0 ? (
                <Timeline
                  items={summary.keyEvents.map((e) => ({
                    color: 'blue',
                    children: e,
                  }))}
                />
              ) : <Text type="secondary">无关键事件</Text>,
            },
            {
              key: 'risks',
              label: <Space><WarningOutlined style={{ color: 'var(--accent-danger)' }} />风险预警 ({summary.riskWarnings.length})</Space>,
              children: summary.riskWarnings.length > 0 ? (
                <Timeline
                  items={summary.riskWarnings.map((r) => ({
                    color: 'red',
                    children: r,
                  }))}
                />
              ) : <Text type="secondary">无风险预警</Text>,
            },
            {
              key: 'sectors',
              label: <Space><FireOutlined style={{ color: 'var(--accent-warning)' }} />行业/板块影响 ({summary.sectorImpact.length})</Space>,
              children: summary.sectorImpact.length > 0 ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {summary.sectorImpact.map((s, i) => (
                    <Tag key={i} color="orange">{s}</Tag>
                  ))}
                </Space>
              ) : <Text type="secondary">无行业影响分析</Text>,
            },
            {
              key: 'insights',
              label: <Space><BulbOutlined style={{ color: 'var(--accent-success)' }} />分析洞察 ({summary.actionableInsights.length})</Space>,
              children: summary.actionableInsights.length > 0 ? (
                <Timeline
                  items={summary.actionableInsights.map((insight) => ({
                    color: 'green',
                    children: insight,
                  }))}
                />
              ) : <Text type="secondary">无洞察</Text>,
            },
          ]}
        />

        <Divider />

        <Title level={5}>完整分析报告</Title>
        <Paragraph style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-input)', padding: 16, borderRadius: 8 }}>
          {record.analysis}
        </Paragraph>
      </div>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>
        <ExperimentOutlined style={{ marginRight: 8 }} />
        DeepSeek 深度分析
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        手动触发，抓取指定时间段的高影响舆情内容，统一交由 DeepSeek 进行综合分析并存档。
      </Text>

      {/* Trigger Panel */}
      <Panel title="发起分析" style={{ marginBottom: 24 }}>
        <Space size="large" align="end">
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>分析时间范围</Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              format="YYYY-MM-DD"
              allowClear={false}
            />
          </div>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            size="large"
            loading={runMutation.isPending}
            onClick={() => runMutation.mutate()}
          >
            {runMutation.isPending ? '分析中...' : '开始深度分析'}
          </Button>
        </Space>
        {runMutation.isPending && (
          <Alert
            style={{ marginTop: 16 }}
            message="DeepSeek 正在分析中，通常需要 30-90 秒，请耐心等待..."
            type="info"
            showIcon
            icon={<Spin size="small" />}
          />
        )}
      </Panel>

      {/* Result Panel */}
      {selectedRecord && (
        <Panel
          title={
            <Space>
              <span>分析结果</span>
              <Tag color="purple">{selectedRecord.model}</Tag>
              <Tag>{selectedRecord.contentCount} 条内容</Tag>
              <Tag>{selectedRecord.startDate} ~ {selectedRecord.endDate}</Tag>
            </Space>
          }
          extra={
            <Space>
              {selectedRecord.tokensUsed && <Text type="secondary">Tokens: {selectedRecord.tokensUsed}</Text>}
              <Text type="secondary">{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          {renderSummary(selectedRecord)}
        </Panel>
      )}

      {/* History Panel */}
      <Panel
        title={
          <Space>
            <HistoryOutlined />
            历史分析记录
            <Badge count={historyData?.total ?? 0} style={{ backgroundColor: 'var(--accent-info)' }} />
          </Space>
        }
      >
        {historyLoading ? (
          <Spin />
        ) : historyData && historyData.records.length > 0 ? (
          <List
            dataSource={historyData.records}
            renderItem={(record) => (
              <List.Item
                style={{ cursor: 'pointer' }}
                onClick={() => handleViewRecord(record.id)}
                actions={[
                  <Button key="view" type="link" onClick={(e) => { e.stopPropagation(); handleViewRecord(record.id); }}>
                    查看详情
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>{record.startDate} ~ {record.endDate}</span>
                      <Tag color="purple">{record.model}</Tag>
                    </Space>
                  }
                  description={
                    <Space>
                      <span>分析 {record.contentCount} 条高影响内容</span>
                      <span>|</span>
                      <span>{dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                      {record.tokensUsed && <span>| Tokens: {record.tokensUsed}</span>}
                    </Space>
                  }
                />
                <div style={{ maxWidth: 400 }}>
                  <Text type="secondary" ellipsis>{record.summary.overallSentiment}</Text>
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无分析记录" />
        )}
      </Panel>
    </div>
  );
}
