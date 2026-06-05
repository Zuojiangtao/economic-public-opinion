import { useState } from 'react';
import {
  Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, Popconfirm,
  message, Divider, Row, Col,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { industryMappingsApi } from '../../api/client';
import type {
  IndustryMapping, IndustryMappingInput, IndustryType, IndustryQueryResult, StockMapping, OverseasMapping,
} from '../../api/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

const INDUSTRY_TYPE_LABELS: Record<IndustryType, string> = {
  industry: '行业',
  sector: '板块',
  concept: '概念',
  theme: '主题',
};

const INDUSTRY_TYPE_COLORS: Record<IndustryType, string> = {
  industry: 'blue',
  sector: 'green',
  concept: 'orange',
  theme: 'purple',
};

function parseMultiValue(val: string): string[] {
  return val.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
}

function formatMultiValue(arr: string[]): string {
  return arr.join(', ');
}

export default function IndustryMappingsPage() {
  const queryClient = useQueryClient();
  const [msgApi, contextHolder] = message.useMessage();

  const [searchName, setSearchName] = useState('');
  const [filterType, setFilterType] = useState<IndustryType | undefined>();

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IndustryMapping | null>(null);
  const [detailItem, setDetailItem] = useState<IndustryMapping | null>(null);

  const [queryText, setQueryText] = useState('');
  const [queryResults, setQueryResults] = useState<IndustryQueryResult[]>([]);
  const [querying, setQuerying] = useState(false);

  const [form] = Form.useForm<{
    name: string;
    type: IndustryType;
    description?: string;
    keywords: string;
    synonyms: string;
    indices: string;
  }>();

  const { data: allMappings = [], isLoading } = useQuery({
    queryKey: ['industry-mappings', filterType],
    queryFn: () => industryMappingsApi.list(filterType),
  });

  const displayed = allMappings.filter((m) =>
    !searchName || m.name.includes(searchName) || m.keywords.some((k) => k.includes(searchName)),
  );

  const createMutation = useMutation({
    mutationFn: (data: IndustryMappingInput) => industryMappingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-mappings'] });
      msgApi.success('创建成功');
      setFormOpen(false);
      form.resetFields();
    },
    onError: () => msgApi.error('创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IndustryMappingInput }) =>
      industryMappingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-mappings'] });
      msgApi.success('更新成功');
      setFormOpen(false);
      setEditingItem(null);
      form.resetFields();
    },
    onError: () => msgApi.error('更新失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => industryMappingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['industry-mappings'] });
      msgApi.success('删除成功');
    },
    onError: () => msgApi.error('删除失败'),
  });

  function openCreate() {
    setEditingItem(null);
    form.resetFields();
    setFormOpen(true);
  }

  function openEdit(item: IndustryMapping) {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      type: item.type,
      description: item.description,
      keywords: formatMultiValue(item.keywords),
      synonyms: formatMultiValue(item.synonyms),
      indices: formatMultiValue(item.indices),
    });
    setFormOpen(true);
  }

  function openDetail(item: IndustryMapping) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  function handleFormSubmit() {
    form.validateFields().then((values) => {
      const data: IndustryMappingInput = {
        name: values.name,
        type: values.type,
        description: values.description,
        keywords: parseMultiValue(values.keywords),
        synonyms: parseMultiValue(values.synonyms),
        indices: parseMultiValue(values.indices),
        relatedConcepts: editingItem?.relatedConcepts || [],
        stocks: editingItem?.stocks || [],
        overseasMappings: editingItem?.overseasMappings || [],
      };
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data });
      } else {
        createMutation.mutate(data);
      }
    });
  }

  async function handleQuery() {
    if (!queryText.trim()) {
      msgApi.warning('请输入查询关键词');
      return;
    }
    setQuerying(true);
    try {
      const keywords = parseMultiValue(queryText);
      const results = await industryMappingsApi.query({ keywords, text: queryText });
      setQueryResults(results);
      if (results.length === 0) msgApi.info('未找到匹配的行业');
    } catch {
      msgApi.error('查询失败');
    } finally {
      setQuerying(false);
    }
  }

  const stockColumns = [
    { title: '代码', dataIndex: 'code', key: 'code', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '简称', dataIndex: 'shortName', key: 'shortName' },
    {
      title: '市场', dataIndex: 'market', key: 'market', width: 80,
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: '产业链', dataIndex: 'chainPosition', key: 'chainPosition', width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { upstream: '上游', midstream: '中游', downstream: '下游' };
        return v ? <Tag>{map[v] || v}</Tag> : '-';
      },
    },
  ];

  const overseasColumns = [
    { title: '代码', dataIndex: 'code', key: 'code', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '市场', dataIndex: 'market', key: 'market', width: 80,
      render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
    },
    {
      title: '映射主题', dataIndex: 'mappedThemes', key: 'mappedThemes',
      render: (themes: string[]) => themes.map((t) => <Tag key={t} color="cyan">{t}</Tag>),
    },
  ];

  const mainColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: IndustryMapping) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => openDetail(record)}>{name}</Button>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: IndustryType) => (
        <Tag color={INDUSTRY_TYPE_COLORS[t]}>{INDUSTRY_TYPE_LABELS[t]}</Tag>
      ),
    },
    {
      title: '关键词',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (kws: string[]) => (
        <Space size={4} wrap>
          {kws.slice(0, 5).map((k) => <Tag key={k}>{k}</Tag>)}
          {kws.length > 5 && <Tag>+{kws.length - 5}</Tag>}
        </Space>
      ),
    },
    {
      title: '股票数',
      dataIndex: 'stocks',
      key: 'stocks',
      width: 80,
      render: (stocks: StockMapping[]) => stocks.length,
    },
    {
      title: '海外映射',
      dataIndex: 'overseasMappings',
      key: 'overseasMappings',
      width: 90,
      render: (oms: OverseasMapping[]) => oms.length,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: IndustryMapping) => (
        <Space>
          <Button size="small" onClick={() => openDetail(record)}>详情</Button>
          <Button size="small" type="primary" ghost onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除此行业映射？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {contextHolder}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>行业映射管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建行业映射</Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="搜索名称或关键词"
            prefix={<SearchOutlined />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            placeholder="筛选类型"
            allowClear
            value={filterType}
            onChange={setFilterType}
            style={{ width: 140 }}
            options={Object.entries(INDUSTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
          />
        </Space>
      </Card>

      <Card>
        <Table
          dataSource={displayed}
          columns={mainColumns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Card title="测试查询" style={{ marginTop: 16 }}>
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            placeholder="输入关键词，逗号或空格分隔，如：NVDA, 芯片, 比亚迪"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onPressEnter={handleQuery}
          />
          <Button type="primary" loading={querying} onClick={handleQuery}>查询匹配行业</Button>
        </Space.Compact>
        {queryResults.length > 0 && (
          <div>
            <Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
              共匹配 {queryResults.length} 个行业：
            </Text>
            <Row gutter={[12, 12]}>
              {queryResults.map((r) => (
                <Col key={r.industry.id} xs={24} sm={12} md={8}>
                  <Card size="small" bordered>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text strong>{r.industry.name}</Text>
                      <Tag color="blue">相关度 {r.relevanceScore}</Tag>
                    </div>
                    <Tag color={INDUSTRY_TYPE_COLORS[r.industry.type]}>{INDUSTRY_TYPE_LABELS[r.industry.type]}</Tag>
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>匹配词：</Text>
                      {r.matchedTerms.map((t) => <Tag key={t} color="green" style={{ fontSize: 11 }}>{t}</Tag>)}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingItem ? '编辑行业映射' : '新建行业映射'}
        open={formOpen}
        onCancel={() => { setFormOpen(false); setEditingItem(null); form.resetFields(); }}
        onOk={handleFormSubmit}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：人工智能" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select
              options={Object.entries(INDUSTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              placeholder="选择类型"
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选，描述该行业/板块的主要特征" />
          </Form.Item>
          <Form.Item name="keywords" label="关键词" rules={[{ required: true, message: '请输入至少一个关键词' }]}>
            <TextArea rows={3} placeholder="多个关键词用逗号或换行分隔，如：AI, 人工智能, 大模型" />
          </Form.Item>
          <Form.Item name="synonyms" label="同义词">
            <TextArea rows={2} placeholder="同义词，逗号分隔" />
          </Form.Item>
          <Form.Item name="indices" label="相关指数">
            <TextArea rows={2} placeholder="相关指数，逗号分隔，如：科创50, 中证人工智能" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={`行业详情：${detailItem?.name}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={<Button onClick={() => setDetailOpen(false)}>关闭</Button>}
        width={800}
      >
        {detailItem && (
          <div>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={6}><Text type="secondary">类型：</Text><Tag color={INDUSTRY_TYPE_COLORS[detailItem.type]}>{INDUSTRY_TYPE_LABELS[detailItem.type]}</Tag></Col>
              <Col span={18}><Text type="secondary">描述：</Text>{detailItem.description || '-'}</Col>
            </Row>
            <div style={{ marginBottom: 8 }}>
              <Text strong>关键词：</Text>
              {detailItem.keywords.map((k) => <Tag key={k} style={{ marginBottom: 4 }}>{k}</Tag>)}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>同义词：</Text>
              {detailItem.synonyms.length > 0
                ? detailItem.synonyms.map((s) => <Tag key={s} color="cyan" style={{ marginBottom: 4 }}>{s}</Tag>)
                : <Text type="secondary">-</Text>}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>相关概念：</Text>
              {detailItem.relatedConcepts.length > 0
                ? detailItem.relatedConcepts.map((c) => <Tag key={c} color="geekblue">{c}</Tag>)
                : <Text type="secondary">-</Text>}
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>相关指数：</Text>
              {detailItem.indices.length > 0
                ? detailItem.indices.map((i) => <Tag key={i} color="gold">{i}</Tag>)
                : <Text type="secondary">-</Text>}
            </div>
            {detailItem.stocks.length > 0 && (
              <>
                <Divider>A股/港股/美股标的</Divider>
                <Table
                  dataSource={detailItem.stocks}
                  columns={stockColumns}
                  rowKey="code"
                  size="small"
                  pagination={false}
                />
              </>
            )}
            {detailItem.overseasMappings.length > 0 && (
              <>
                <Divider>海外映射</Divider>
                <Table
                  dataSource={detailItem.overseasMappings}
                  columns={overseasColumns}
                  rowKey="code"
                  size="small"
                  pagination={false}
                />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
