import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Typography,
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { contentsApi, monitoringApi } from '../../api/client';
import ContentDetailDrawer from '../../components/ContentDetailDrawer';
import type { ContentItem, ContentSearchParams, SourceType, SentimentLabel, RiskLevel } from '../../api/types';

const { RangePicker } = DatePicker;

const sourceTypeOptions = [
  { label: '新闻', value: 'news' },
  { label: '论坛', value: 'forums' },
  { label: '社媒', value: 'social' },
  { label: '研报', value: 'broker' },
  { label: 'APP', value: 'app' },
];

const sentimentOptions = [
  { label: '正面', value: 'positive' },
  { label: '中性', value: 'neutral' },
  { label: '负面', value: 'negative' },
];

const riskOptions = [
  { label: '低风险', value: 'low' },
  { label: '中风险', value: 'medium' },
  { label: '高风险', value: 'high' },
  { label: '极高风险', value: 'critical' },
];


const sentimentColors: Record<string, string> = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
};

const riskColors: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

const sourceLabels: Record<string, string> = {
  news: '新闻',
  forums: '论坛',
  social: '社媒',
  broker: '研报',
  app: 'APP',
};

const sentimentLabels: Record<string, string> = {
  positive: '正面',
  neutral: '中性',
  negative: '负面',
};


export default function SearchPage() {
  const [searchParams] = useSearchParams();

  // H009: 支持从 URL query 读取初始筛选参数（如 eventType、sentiment）
  const initKeyword = searchParams.get('keyword') ?? '';
  const initSentiment = (searchParams.get('sentiment') as SentimentLabel | null) ?? undefined;
  const initEventType = searchParams.get('eventType') ?? undefined;

  const [params, setParams] = useState<ContentSearchParams>({
    page: 1,
    pageSize: 15,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    keyword: initKeyword || undefined,
    sentiment: initSentiment,
  });
  const [keyword, setKeyword] = useState(initKeyword);
  const [sourceType, setSourceType] = useState<SourceType | undefined>();
  const [sentiment, setSentiment] = useState<SentimentLabel | undefined>(initSentiment);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | undefined>();

  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [eventTypeFilter, setEventTypeFilter] = useState<string | undefined>(initEventType);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);



  const { data, isLoading } = useQuery({
    queryKey: ['contents', params],
    queryFn: () => contentsApi.search(params),
  });

  const { data: projects } = useQuery({
    queryKey: ['monitoringProjects'],
    queryFn: () => monitoringApi.list({ page: 1, pageSize: 100 }),
  });

  function handleSearch() {
    setParams({
      ...params,
      keyword: keyword || undefined,
      sourceType,
      sentiment,
      riskLevel,

      startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      monitoringProjectId: projectId,
      page: 1,
    });
  }

  function handleReset() {
    setKeyword('');
    setSourceType(undefined);
    setSentiment(undefined);
    setRiskLevel(undefined);

    setDateRange(null);
    setProjectId(undefined);
    setEventTypeFilter(undefined);
    setParams({ page: 1, pageSize: 15, sortBy: 'publishedAt', sortOrder: 'desc' });
  }

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: ContentItem) => (
        <a
          onClick={() => {
            setSelectedItem(record);
            setDrawerOpen(true);
          }}
        >
          {text}
        </a>
      ),
    },

    {
      title: '来源',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 80,
      render: (type: string) => <Tag>{sourceLabels[type]}</Tag>,
    },
    {
      title: '来源名',
      dataIndex: 'sourceName',
      key: 'sourceName',
      width: 120,
      ellipsis: true,
    },
    {
      title: '情感',
      key: 'sentiment',
      width: 80,
      render: (_: unknown, record: ContentItem) => (
        <Tag color={sentimentColors[record.nlp.sentimentLabel]}>
          {sentimentLabels[record.nlp.sentimentLabel]}
        </Tag>
      ),
    },
    {
      title: '风险',
      key: 'riskLevel',
      width: 90,
      render: (_: unknown, record: ContentItem) => (
        <Tag color={riskColors[record.nlp.riskLevel]}>
          {record.nlp.riskLevel.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 170,
      sorter: true,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '互动',
      key: 'metrics',
      width: 100,
      render: (_: unknown, record: ContentItem) => (
        <span style={{ fontSize: 12, color: '#999' }}>
          👍{record.metrics.likes} 💬{record.metrics.comments}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>舆情检索</Typography.Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="搜索关键词..."
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="来源类型"
              options={sourceTypeOptions}
              value={sourceType}
              onChange={setSourceType}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="情感倾向"
              options={sentimentOptions}
              value={sentiment}
              onChange={setSentiment}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="风险等级"
              options={riskOptions}
              value={riskLevel}
              onChange={setRiskLevel}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>

          <Col xs={12} md={4}>
            <Select
              placeholder="监测方案"
              options={projects?.items.map((p) => ({ label: p.name, value: p.id }))}
              value={projectId}
              onChange={setProjectId}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              value={dateRange as [dayjs.Dayjs, dayjs.Dayjs] | null}
              onChange={(vals) => setDateRange(vals)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={4}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
        {/* H009: 从首页跳转来的事件类型过滤标签 */}
        {eventTypeFilter && (
          <div style={{ marginTop: 12 }}>
            <Space>
              <span style={{ color: '#666', fontSize: 13 }}>当前事件类型筛选：</span>
              <Tag
                color="blue"
                closable
                onClose={() => {
                  setEventTypeFilter(undefined);
                }}
              >
                {eventTypeFilter}
              </Tag>
              <span style={{ color: '#999', fontSize: 12 }}>（事件类型过滤为前端展示提示，后端检索以关键词为准）</span>
            </Space>
          </div>
        )}
      </Card>

      <Card>
        <Table<ContentItem>
          columns={columns}
          dataSource={data?.items}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: params.page,
            pageSize: params.pageSize,
            total: data?.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => setParams({ ...params, page, pageSize }),
          }}
          onChange={(_pagination, _filters, sorter) => {
            if (!Array.isArray(sorter) && sorter.field) {
              setParams({
                ...params,
                sortBy: sorter.field as 'publishedAt',
                sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc',
              });
            }
          }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>

      <ContentDetailDrawer
        open={drawerOpen}
        item={selectedItem}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedItem(null);
        }}
      />
    </div>
  );
}
