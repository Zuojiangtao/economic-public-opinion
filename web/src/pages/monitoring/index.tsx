import { useState, useMemo } from 'react';
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
  InputNumber,
  Popconfirm,
  Typography,
  message,
  Divider,
  Switch,
  Tooltip,
  Radio,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { monitoringApi, industryMappingsApi } from '../../api/client';
import type {
  MonitoringProject,
  MonitoringProjectInput,
  SourceType,
  SourceWeightConfig,
  MonitorTargetType,
  OutputCycle,
} from '../../api/types';

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '运行中', color: 'green' },
  paused: { text: '已暂停', color: 'orange' },
  archived: { text: '已归档', color: 'default' },
};

const targetTypeOptions = [
  { label: '行业', value: 'industry' },
  { label: '板块', value: 'sector' },
  { label: '概念', value: 'concept' },
  { label: '股票池', value: 'stock_pool' },
  { label: '指数', value: 'index' },
];

const outputCycleOptions = [
  { label: '实时', value: 'realtime' },
  { label: '小时级', value: 'hourly' },
  { label: '日级', value: 'daily' },
];

const SOURCE_DEFS: { key: SourceType; label: string }[] = [
  { key: 'news', label: '新闻' },
  { key: 'broker', label: '研报' },
  { key: 'forums', label: '论坛' },
  { key: 'social', label: '社媒' },
  { key: 'app', label: 'APP' },
];

const DEFAULT_SOURCE_WEIGHTS: SourceWeightConfig[] = [
  { sourceType: 'news', weight: 0.8, enabled: true },
  { sourceType: 'broker', weight: 1.0, enabled: true },
  { sourceType: 'forums', weight: 0.5, enabled: true },
  { sourceType: 'social', weight: 0.4, enabled: false },
  { sourceType: 'app', weight: 0.6, enabled: false },
];

function normalizeSourceWeights(project: MonitoringProject): SourceWeightConfig[] {
  if (project.sourceWeights?.length) return project.sourceWeights;
  // fallback for legacy data
  return DEFAULT_SOURCE_WEIGHTS.map((d) => ({
    ...d,
    enabled: project.sourceTypes?.includes(d.sourceType) ?? d.enabled,
  }));
}

export default function MonitoringPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<MonitoringProject | null>(null);
  const [sourceWeights, setSourceWeights] = useState<SourceWeightConfig[]>(DEFAULT_SOURCE_WEIGHTS);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['monitoringProjects'],
    queryFn: () => monitoringApi.list({ page: 1, pageSize: 100 }),
  });

  const { data: industries } = useQuery({
    queryKey: ['industryMappings'],
    queryFn: () => industryMappingsApi.list(),
  });

  const industryOptions = useMemo(
    () => (industries ?? []).map((ind) => ({ label: ind.name, value: ind.id })),
    [industries],
  );

  const industryMap = useMemo(
    () => new Map((industries ?? []).map((ind) => [ind.id, ind.name])),
    [industries],
  );

  const createMutation = useMutation({
    mutationFn: (input: MonitoringProjectInput) => monitoringApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoringProjects'] });
      message.success('创建成功');
      setModalOpen(false);
      form.resetFields();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: MonitoringProjectInput }) =>
      monitoringApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoringProjects'] });
      message.success('更新成功');
      setModalOpen(false);
      setEditingProject(null);
      form.resetFields();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => monitoringApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoringProjects'] });
      message.success('删除成功');
    },
  });

  function updateSourceWeight(sourceType: SourceType, patch: Partial<SourceWeightConfig>) {
    setSourceWeights((prev) =>
      prev.map((sw) => (sw.sourceType === sourceType ? { ...sw, ...patch } : sw)),
    );
  }

  function openCreate() {
    setEditingProject(null);
    setSourceWeights(DEFAULT_SOURCE_WEIGHTS);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(project: MonitoringProject) {
    setEditingProject(project);
    setSourceWeights(normalizeSourceWeights(project));
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      status: project.status,
      targetType: project.targetType || 'industry',
      targetIds: project.targetIds || [],
      coreKeywords: (project.keywords.core ?? project.keywords.include ?? []).join(', '),
      extendedKeywords: (project.keywords.extended ?? []).join(', '),
      excludeKeywords: (project.keywords.exclude ?? []).join(', '),
      temperatureThreshold: project.temperatureThreshold ?? 70,
      alertThreshold: project.alertThreshold ?? 80,
      outputCycle: project.outputCycle || 'hourly',
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      const enabledSources = sourceWeights.filter((sw) => sw.enabled).map((sw) => sw.sourceType);
      const input: MonitoringProjectInput = {
        name: values.name,
        description: values.description,
        status: values.status || 'active',
        targetType: values.targetType as MonitorTargetType,
        targetIds: values.targetIds || [],
        keywords: {
          core: values.coreKeywords
            ? values.coreKeywords.split(/[,，\s]+/).filter(Boolean)
            : [],
          extended: values.extendedKeywords
            ? values.extendedKeywords.split(/[,，\s]+/).filter(Boolean)
            : [],
          exclude: values.excludeKeywords
            ? values.excludeKeywords.split(/[,，\s]+/).filter(Boolean)
            : [],
        },
        sourceTypes: enabledSources,
        sourceWeights,
        temperatureThreshold: values.temperatureThreshold ?? 70,
        alertThreshold: values.alertThreshold ?? 80,
        outputCycle: values.outputCycle as OutputCycle,
      };

      if (editingProject) {
        updateMutation.mutate({ id: editingProject.id, input });
      } else {
        createMutation.mutate(input);
      }
    });
  }

  const targetTypeLabel: Record<string, string> = {
    industry: '行业',
    sector: '板块',
    concept: '概念',
    stock_pool: '股票池',
    index: '指数',
  };

  const outputCycleLabel: Record<string, string> = {
    realtime: '实时',
    hourly: '小时级',
    daily: '日级',
  };

  const columns = [
    {
      title: '方案名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: MonitoringProject) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const st = statusMap[status];
        return st ? <Tag color={st.color}>{st.text}</Tag> : status;
      },
    },
    {
      title: '监测对象',
      key: 'target',
      width: 200,
      render: (_: unknown, record: MonitoringProject) => (
        <div>
          <Tag color="purple">{targetTypeLabel[record.targetType] ?? record.targetType}</Tag>
          {record.targetIds?.map((id) => (
            <Tag key={id} color="blue">
              {industryMap.get(id) ?? id}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '核心词',
      key: 'keywords',
      width: 200,
      render: (_: unknown, record: MonitoringProject) => {
        const core = record.keywords?.core ?? record.keywords?.include ?? [];
        return (
          <div>
            {core.slice(0, 3).map((kw) => (
              <Tag key={kw} color="blue" style={{ marginBottom: 2 }}>
                {kw}
              </Tag>
            ))}
            {core.length > 3 && <Tag>+{core.length - 3}</Tag>}
          </div>
        );
      },
    },
    {
      title: '输出周期',
      key: 'outputCycle',
      width: 90,
      render: (_: unknown, record: MonitoringProject) => (
        <Tag>{outputCycleLabel[record.outputCycle] ?? record.outputCycle ?? '-'}</Tag>
      ),
    },
    {
      title: '温度/预警阈值',
      key: 'thresholds',
      width: 120,
      render: (_: unknown, record: MonitoringProject) => (
        <div style={{ fontSize: 12 }}>
          <div>温度 ≥ {record.temperatureThreshold ?? '-'}</div>
          <div>预警 ≥ {record.alertThreshold ?? '-'}</div>
        </div>
      ),
    },
    {
      title: '命中数',
      dataIndex: 'hitCount',
      key: 'hitCount',
      width: 80,
      render: (count: number) => <span style={{ fontWeight: 500 }}>{count.toLocaleString()}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 160,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: MonitoringProject) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此方案？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Typography.Title level={4} style={{ margin: 0 }}>
          监测方案
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建方案
        </Button>
      </div>

      <Card>
        <Table<MonitoringProject>
          columns={columns}
          dataSource={data?.items}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="middle"
          scroll={{ x: 1100 }}
        />
      </Card>

      <Modal
        title={editingProject ? '编辑方案' : '新建方案'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => {
          setModalOpen(false);
          setEditingProject(null);
          form.resetFields();
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={720}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        destroyOnHidden
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          {/* ── 基本信息 ── */}
          <Divider orientation="left" style={{ marginTop: 0 }}>
            基本信息
          </Divider>
          <Form.Item
            name="name"
            label="方案名称"
            rules={[{ required: true, message: '请输入方案名称' }]}
          >
            <Input placeholder="例如：AI科技情绪监测" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="方案描述（可选）" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select
              options={[
                { label: '运行中', value: 'active' },
                { label: '暂停', value: 'paused' },
              ]}
            />
          </Form.Item>

          {/* ── 监测对象 ── */}
          <Divider orientation="left">监测对象</Divider>
          <Form.Item
            name="targetType"
            label="监测类型"
            initialValue="sector"
            rules={[{ required: true, message: '请选择监测类型' }]}
          >
            <Select options={targetTypeOptions} />
          </Form.Item>
          <Form.Item
            name="targetIds"
            label={
              <span>
                关联行业/板块&nbsp;
                <Tooltip title="从已配置的行业映射中选择，温度计算将与所选行业打通">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </span>
            }
          >
            <Select
              mode="multiple"
              options={industryOptions}
              placeholder="选择关联的行业或板块（可多选）"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          {/* ── 关键词配置 ── */}
          <Divider orientation="left">关键词配置</Divider>
          <Form.Item
            name="coreKeywords"
            label={
              <span>
                核心词&nbsp;
                <Tooltip title="必须命中的核心关键词，权重最高">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </span>
            }
            rules={[{ required: true, message: '请输入至少一个核心关键词' }]}
            extra="多个关键词用逗号或空格分隔"
          >
            <Input.TextArea rows={2} placeholder="AI, 人工智能, 大模型" />
          </Form.Item>
          <Form.Item
            name="extendedKeywords"
            label={
              <span>
                扩展词&nbsp;
                <Tooltip title="辅助扩展匹配范围的关键词，权重次于核心词">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </span>
            }
            extra="多个关键词用逗号或空格分隔"
          >
            <Input.TextArea rows={2} placeholder="deepseek, 科创, 算力（可选）" />
          </Form.Item>
          <Form.Item
            name="excludeKeywords"
            label="排除词"
            extra="多个关键词用逗号或空格分隔"
          >
            <Input.TextArea rows={1} placeholder="广告, 招聘（可选）" />
          </Form.Item>

          {/* ── 数据源配置 ── */}
          <Divider orientation="left">数据源配置</Divider>
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 80px',
                gap: '0 8px',
                fontSize: 12,
                color: '#999',
                marginBottom: 6,
                paddingLeft: 4,
              }}
            >
              <span>启用</span>
              <span>来源 / 可信度权重</span>
              <span style={{ textAlign: 'right' }}>权重值</span>
            </div>
            {SOURCE_DEFS.map(({ key, label }) => {
              const sw = sourceWeights.find((w) => w.sourceType === key) ?? {
                sourceType: key,
                weight: 0.5,
                enabled: false,
              };
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 80px',
                    alignItems: 'center',
                    gap: '0 8px',
                    marginBottom: 10,
                    paddingLeft: 4,
                  }}
                >
                  <Switch
                    size="small"
                    checked={sw.enabled}
                    onChange={(v) => updateSourceWeight(key, { enabled: v })}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 36, flexShrink: 0 }}>{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(sw.weight * 100)}
                      disabled={!sw.enabled}
                      onChange={(e) =>
                        updateSourceWeight(key, { weight: Number(e.target.value) / 100 })
                      }
                      style={{ flex: 1, accentColor: sw.enabled ? '#1677ff' : '#d9d9d9' }}
                    />
                  </div>
                  <span
                    style={{
                      textAlign: 'right',
                      color: sw.enabled ? '#1677ff' : '#bbb',
                      fontWeight: 500,
                    }}
                  >
                    {Math.round(sw.weight * 100)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── 阈值与输出周期 ── */}
          <Divider orientation="left">阈值与输出周期</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              name="temperatureThreshold"
              label={
                <span>
                  温度预警阈值&nbsp;
                  <Tooltip title="行业温度超过此值时触发预警（0-100）">
                    <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                </span>
              }
              initialValue={70}
            >
              <InputNumber min={0} max={100} step={5} addonAfter="分" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="alertThreshold"
              label={
                <span>
                  紧急预警阈值&nbsp;
                  <Tooltip title="行业温度超过此值时触发高优先级预警（0-100）">
                    <InfoCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                </span>
              }
              initialValue={80}
            >
              <InputNumber min={0} max={100} step={5} addonAfter="分" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="outputCycle" label="输出周期" initialValue="hourly">
            <Radio.Group>
              {outputCycleOptions.map((opt) => (
                <Radio.Button key={opt.value} value={opt.value}>
                  {opt.label}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

