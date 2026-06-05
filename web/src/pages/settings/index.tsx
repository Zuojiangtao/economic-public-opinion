import { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Popconfirm,
  Typography,
  Tabs,
  Switch,
  Spin,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lexiconsApi, sourceConfigsApi } from '../../api/client';
import type { LexiconEntry, LexiconCategory, SourceConfig, SourceType } from '../../api/types';

interface CrawlerStatus {
  name: string;
  sourceName: string;
  enabled: boolean;
  lastCrawlAt?: string;
  lastSuccess: boolean;
  lastError?: string;
  totalFetched: number;
  isRunning: boolean;
}

const crawlerApi = {
  getStatus: () =>
    fetch('/api/v1/crawlers/status').then((r) => r.json()) as Promise<{ crawlers: CrawlerStatus[]; storageSize: number }>,
  runAll: () =>
    fetch('/api/v1/crawlers/run-all', { method: 'POST' }).then((r) => r.json()),
  runSingle: (name: string) =>
    fetch(`/api/v1/crawlers/${name}/run`, { method: 'POST' }).then((r) => r.json()),
  toggle: (name: string, enabled: boolean) =>
    fetch(`/api/v1/crawlers/${name}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).then((r) => r.json()),
};

const categoryMap: Record<string, { text: string; color: string }> = {
  brand: { text: '品牌词', color: 'blue' },
  competitor: { text: '竞品词', color: 'purple' },
  risk: { text: '风险词', color: 'red' },
  synonym: { text: '同义词', color: 'green' },
  stop: { text: '停用词', color: 'default' },
};

const categoryOptions = [
  { label: '品牌词', value: 'brand' },
  { label: '竞品词', value: 'competitor' },
  { label: '风险词', value: 'risk' },
  { label: '同义词', value: 'synonym' },
  { label: '停用词', value: 'stop' },
];

function CrawlerManagement() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['crawlerStatus'],
    queryFn: crawlerApi.getStatus,
    refetchInterval: 10000,
    retry: 1,
  });

  const runAllMutation = useMutation({
    mutationFn: crawlerApi.runAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawlerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      queryClient.invalidateQueries({ queryKey: ['contentStats'] });
      message.success('全部爬虫运行完成');
    },
    onError: () => message.error('运行失败'),
  });

  const runSingleMutation = useMutation({
    mutationFn: (name: string) => crawlerApi.runSingle(name),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['crawlerStatus'] });
      queryClient.invalidateQueries({ queryKey: ['contents'] });
      message.success(`${name} 爬取完成`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) =>
      crawlerApi.toggle(name, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crawlerStatus'] });
    },
  });

  if (isError) {
    return (
      <Card>
        <Typography.Paragraph type="secondary">
          爬虫后端未启动。请先在 server/ 目录运行 <Typography.Text code>npm run dev</Typography.Text> 启动爬虫服务（端口 3001）。
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          后端启动后，此页面将自动显示爬虫状态。
        </Typography.Paragraph>
      </Card>
    );
  }

  const crawlerColumns = [
    {
      title: '数据源',
      dataIndex: 'sourceName',
      key: 'sourceName',
      render: (name: string, record: CrawlerStatus) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.name}</div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: unknown, record: CrawlerStatus) => {
        if (record.isRunning) return <Tag icon={<LoadingOutlined />} color="processing">采集中</Tag>;
        if (!record.enabled) return <Tag color="default">已停用</Tag>;
        if (record.lastSuccess) return <Tag icon={<CheckCircleOutlined />} color="success">正常</Tag>;
        return <Tag icon={<CloseCircleOutlined />} color="error">异常</Tag>;
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: CrawlerStatus) => (
        <Switch
          checked={enabled}
          size="small"
          onChange={(checked) => toggleMutation.mutate({ name: record.name, enabled: checked })}
        />
      ),
    },
    {
      title: '已采集',
      dataIndex: 'totalFetched',
      key: 'totalFetched',
      width: 90,
      render: (count: number) => <span style={{ fontWeight: 500 }}>{count}</span>,
    },
    {
      title: '最近采集',
      dataIndex: 'lastCrawlAt',
      key: 'lastCrawlAt',
      width: 170,
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '错误信息',
      dataIndex: 'lastError',
      key: 'lastError',
      ellipsis: true,
      render: (err: string) => err ? <Typography.Text type="danger" ellipsis>{err}</Typography.Text> : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: CrawlerStatus) => (
        <Button
          type="link"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={() => runSingleMutation.mutate(record.name)}
          loading={runSingleMutation.isPending}
          disabled={record.isRunning}
        >
          采集
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Typography.Text>数据总量：<strong>{data?.storageSize ?? 0}</strong> 条</Typography.Text>
          </Space>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['crawlerStatus'] })}
            >
              刷新状态
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => runAllMutation.mutate()}
              loading={runAllMutation.isPending}
            >
              全部采集
            </Button>
          </Space>
        </div>
      </Card>
      <Card>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Table<CrawlerStatus>
            columns={crawlerColumns}
            dataSource={data?.crawlers || []}
            rowKey="name"
            pagination={false}
            size="middle"
          />
        )}
      </Card>
    </>
  );
}

// ============================================================
// 数据源权重管理组件（T006）
// ============================================================

const sourceTypeLabels: Record<SourceType, { text: string; color: string }> = {
  regulatory: { text: '监管', color: 'red' },
  broker: { text: '研报', color: 'purple' },
  news: { text: '新闻', color: 'blue' },
  app: { text: '财经APP', color: 'cyan' },
  forums: { text: '论坛', color: 'orange' },
  social: { text: '社媒', color: 'magenta' },
};

const authStatusLabels: Record<string, { text: string; color: string }> = {
  authorized: { text: '已授权', color: 'success' },
  restricted: { text: '受限', color: 'warning' },
  unauthorized: { text: '未授权', color: 'error' },
};

const antiCrawlLabels: Record<string, { text: string; color: string }> = {
  low: { text: '低', color: 'green' },
  medium: { text: '中', color: 'orange' },
  high: { text: '高', color: 'red' },
};

const availabilityLabels: Record<string, { text: string; color: string }> = {
  available: { text: '正常', color: 'success' },
  unstable: { text: '不稳定', color: 'warning' },
  unavailable: { text: '不可用', color: 'error' },
};

function CredibilityBar({ score }: { score: number }) {
  const color = score >= 80 ? '#52c41a' : score >= 60 ? '#1677ff' : score >= 40 ? '#fa8c16' : '#ff4d4f';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 6, minWidth: 60 }}>
        <div style={{ width: `${score}%`, background: color, height: 6, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontWeight: 600, color, minWidth: 28 }}>{score}</span>
    </div>
  );
}

function SourceConfigManagement() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState<SourceConfig | null>(null);
  const [form] = Form.useForm();
  const [filterType, setFilterType] = useState<SourceType | undefined>();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['sourceConfigs', filterType],
    queryFn: () => sourceConfigsApi.list(filterType),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, val }: { id: string; val: boolean }) =>
      sourceConfigsApi.toggle(id, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceConfigs'] });
      message.success('已更新');
    },
    onError: () => message.error('更新失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof sourceConfigsApi.update>[1] }) =>
      sourceConfigsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sourceConfigs'] });
      message.success('配置已保存');
      setEditingConfig(null);
      form.resetFields();
    },
    onError: () => message.error('保存失败'),
  });

  const columns = [
    {
      title: '数据源',
      key: 'name',
      render: (_: unknown, r: SourceConfig) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{r.sourceName}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 90,
      render: (t: SourceType) => {
        const l = sourceTypeLabels[t];
        return l ? <Tag color={l.color}>{l.text}</Tag> : <Tag>{t}</Tag>;
      },
    },
    {
      title: '可信度',
      dataIndex: 'credibilityScore',
      key: 'credibilityScore',
      width: 140,
      sorter: (a: SourceConfig, b: SourceConfig) => a.credibilityScore - b.credibilityScore,
      render: (score: number) => <CredibilityBar score={score} />,
    },
    {
      title: '纳入温度计算',
      dataIndex: 'includeInTemperature',
      key: 'includeInTemperature',
      width: 110,
      render: (val: boolean, r: SourceConfig) => (
        <Switch
          checked={val}
          size="small"
          onChange={(checked) => toggleMutation.mutate({ id: r.id, val: checked })}
        />
      ),
    },
    {
      title: '授权状态',
      dataIndex: 'authorizationStatus',
      key: 'authorizationStatus',
      width: 90,
      render: (s: string) => {
        const l = authStatusLabels[s];
        return l ? <Tag color={l.color}>{l.text}</Tag> : <Tag>{s}</Tag>;
      },
    },
    {
      title: '反爬风险',
      dataIndex: 'antiCrawlRisk',
      key: 'antiCrawlRisk',
      width: 80,
      render: (s: string) => {
        const l = antiCrawlLabels[s];
        return l ? <Tag color={l.color}>{l.text}</Tag> : <Tag>{s}</Tag>;
      },
    },
    {
      title: '可用状态',
      dataIndex: 'availabilityStatus',
      key: 'availabilityStatus',
      width: 90,
      render: (s: string) => {
        const l = availabilityLabels[s];
        return l ? <Tag color={l.color}>{l.text}</Tag> : <Tag>{s}</Tag>;
      },
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text
        ? <Tooltip title={text}><Typography.Text ellipsis style={{ maxWidth: 200 }}>{text}</Typography.Text></Tooltip>
        : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 70,
      render: (_: unknown, r: SourceConfig) => (
        <Button
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingConfig(r);
            form.setFieldsValue({
              credibilityScore: r.credibilityScore,
              includeInTemperature: r.includeInTemperature,
              authorizationStatus: r.authorizationStatus,
              antiCrawlRisk: r.antiCrawlRisk,
              availabilityStatus: r.availabilityStatus,
              description: r.description,
            });
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  const typeOptions = [
    { label: '全部类型', value: undefined },
    ...Object.entries(sourceTypeLabels).map(([v, l]) => ({ label: l.text, value: v as SourceType })),
  ];

  const enabledCount = configs?.filter((c) => c.includeInTemperature).length ?? 0;
  const totalCount = configs?.length ?? 0;

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Select
              options={typeOptions}
              value={filterType}
              onChange={setFilterType}
              style={{ width: 130 }}
            />
            <Typography.Text type="secondary">
              共 <strong>{totalCount}</strong> 个数据源，
              <strong style={{ color: '#52c41a' }}>{enabledCount}</strong> 个纳入温度计算
            </Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['sourceConfigs'] })}>
            刷新
          </Button>
        </div>
      </Card>
      <Card>
        <Table<SourceConfig>
          columns={columns}
          dataSource={configs ?? []}
          rowKey="id"
          loading={isLoading}
          size="middle"
          pagination={false}
          rowClassName={(r) => (!r.includeInTemperature ? 'ant-table-row-disabled' : '')}
        />
      </Card>

      <Modal
        title={`编辑数据源：${editingConfig?.name}`}
        open={!!editingConfig}
        onOk={() => {
          if (!editingConfig) return;
          form.validateFields().then((values) => {
            updateMutation.mutate({ id: editingConfig.id, data: values });
          });
        }}
        onCancel={() => {
          setEditingConfig(null);
          form.resetFields();
        }}
        confirmLoading={updateMutation.isPending}
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="credibilityScore" label="可信度评分（0-100）" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="includeInTemperature" label="纳入温度计算" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="authorizationStatus" label="授权状态">
            <Select options={[
              { label: '已授权', value: 'authorized' },
              { label: '受限', value: 'restricted' },
              { label: '未授权', value: 'unauthorized' },
            ]} />
          </Form.Item>
          <Form.Item name="antiCrawlRisk" label="反爬风险">
            <Select options={[
              { label: '低', value: 'low' },
              { label: '中', value: 'medium' },
              { label: '高', value: 'high' },
            ]} />
          </Form.Item>
          <Form.Item name="availabilityStatus" label="可用状态">
            <Select options={[
              { label: '正常', value: 'available' },
              { label: '不稳定', value: 'unstable' },
              { label: '不可用', value: 'unavailable' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  const [activeCategory, setActiveCategory] = useState<LexiconCategory | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: lexicons, isLoading } = useQuery({
    queryKey: ['lexicons', activeCategory],
    queryFn: () => lexiconsApi.list(activeCategory),
  });

  const createMutation = useMutation({
    mutationFn: (input: { word: string; category: LexiconCategory; synonyms?: string[] }) =>
      lexiconsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lexicons'] });
      message.success('添加成功');
      setModalOpen(false);
      form.resetFields();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => lexiconsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lexicons'] });
      message.success('删除成功');
    },
  });

  const columns = [
    {
      title: '词条',
      dataIndex: 'word',
      key: 'word',
      render: (word: string) => <Typography.Text strong>{word}</Typography.Text>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => {
        const c = categoryMap[cat];
        return c ? <Tag color={c.color}>{c.text}</Tag> : cat;
      },
    },
    {
      title: '同义词',
      dataIndex: 'synonyms',
      key: 'synonyms',
      render: (synonyms: string[]) =>
        synonyms?.length > 0
          ? synonyms.map((s) => <Tag key={s}>{s}</Tag>)
          : <span style={{ color: '#999' }}>-</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: LexiconEntry) => (
        <Popconfirm
          title="确定删除此词条？"
          onConfirm={() => deleteMutation.mutate(record.id)}
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>系统配置</Typography.Title>

      <Tabs
        items={[
          {
            key: 'lexicons',
            label: '词库管理',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Space>
                      <Select
                        placeholder="词库分类"
                        options={categoryOptions}
                        value={activeCategory}
                        onChange={setActiveCategory}
                        allowClear
                        style={{ width: 140 }}
                      />
                    </Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                      添加词条
                    </Button>
                  </div>
                </Card>
                <Card>
                  <Table<LexiconEntry>
                    columns={columns}
                    dataSource={lexicons || []}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 条` }}
                    size="middle"
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'crawlers',
            label: '爬虫管理',
            children: <CrawlerManagement />,
          },
          {
            key: 'source-configs',
            label: '数据源权重',
            children: <SourceConfigManagement />,
          },
        ]}
      />

      <Modal
        title="添加词条"
        open={modalOpen}
        onOk={() => {
          form.validateFields().then((values) => {
            createMutation.mutate({
              word: values.word,
              category: values.category,
              synonyms: values.synonyms
                ? values.synonyms.split(/[,，\s]+/).filter(Boolean)
                : [],
            });
          });
        }}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="word" label="词条" rules={[{ required: true, message: '请输入词条' }]}>
            <Input placeholder="输入词条" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={categoryOptions} placeholder="选择分类" />
          </Form.Item>
          <Form.Item name="synonyms" label="同义词" extra="多个同义词用逗号分隔">
            <Input placeholder="同义词1, 同义词2" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
