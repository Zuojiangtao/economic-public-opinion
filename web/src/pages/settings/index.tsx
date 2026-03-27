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
  Select,
  Popconfirm,
  Typography,
  Tabs,
  Switch,
  Spin,
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
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lexiconsApi } from '../../api/client';
import type { LexiconEntry, LexiconCategory } from '../../api/types';

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
