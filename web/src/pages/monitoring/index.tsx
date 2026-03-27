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
  InputNumber,
  Popconfirm,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { monitoringApi } from '../../api/client';
import type { MonitoringProject, MonitoringProjectInput, SourceType } from '../../api/types';

const statusMap: Record<string, { text: string; color: string }> = {
  active: { text: '运行中', color: 'green' },
  paused: { text: '已暂停', color: 'orange' },
  archived: { text: '已归档', color: 'default' },
};

const sourceTypeOptions = [
  { label: '新闻', value: 'news' },
  { label: '论坛', value: 'forums' },
  { label: '社媒', value: 'social' },
  { label: '研报', value: 'broker' },
  { label: 'APP', value: 'app' },
];

const riskOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '极高', value: 'critical' },
];

export default function MonitoringPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<MonitoringProject | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['monitoringProjects'],
    queryFn: () => monitoringApi.list({ page: 1, pageSize: 100 }),
  });

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

  function openCreate() {
    setEditingProject(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(project: MonitoringProject) {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      status: project.status,
      includeKeywords: project.keywords.include?.join(', '),
      excludeKeywords: project.keywords.exclude?.join(', '),
      sourceTypes: project.sourceTypes,
      sentimentThreshold: project.sentimentThreshold,
      riskThreshold: project.riskThreshold,
    });
    setModalOpen(true);
  }

  function handleSubmit() {
    form.validateFields().then((values) => {
      const input: MonitoringProjectInput = {
        name: values.name,
        description: values.description,
        status: values.status || 'active',
        keywords: {
          include: values.includeKeywords
            ? values.includeKeywords.split(/[,，\s]+/).filter(Boolean)
            : [],
          exclude: values.excludeKeywords
            ? values.excludeKeywords.split(/[,，\s]+/).filter(Boolean)
            : [],
        },
        sourceTypes: values.sourceTypes as SourceType[],
        sentimentThreshold: values.sentimentThreshold,
        riskThreshold: values.riskThreshold,
      };

      if (editingProject) {
        updateMutation.mutate({ id: editingProject.id, input });
      } else {
        createMutation.mutate(input);
      }
    });
  }

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
      width: 100,
      render: (status: string) => {
        const st = statusMap[status];
        return st ? <Tag color={st.color}>{st.text}</Tag> : status;
      },
    },
    {
      title: '包含关键词',
      key: 'keywords',
      width: 220,
      render: (_: unknown, record: MonitoringProject) => (
        <div>
          {record.keywords.include?.slice(0, 4).map((kw) => (
            <Tag key={kw} color="blue" style={{ marginBottom: 2 }}>{kw}</Tag>
          ))}
          {(record.keywords.include?.length || 0) > 4 && (
            <Tag>+{record.keywords.include.length - 4}</Tag>
          )}
        </div>
      ),
    },
    {
      title: '来源',
      key: 'sourceTypes',
      width: 150,
      render: (_: unknown, record: MonitoringProject) =>
        record.sourceTypes?.map((s) => {
          const labels: Record<string, string> = { news: '新闻', forums: '论坛', social: '社媒', broker: '研报', app: 'APP' };
          return <Tag key={s}>{labels[s]}</Tag>;
        }),
    },
    {
      title: '命中数',
      dataIndex: 'hitCount',
      key: 'hitCount',
      width: 90,
      render: (count: number) => <span style={{ fontWeight: 500 }}>{count.toLocaleString()}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>监测方案</Typography.Title>
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
        width={640}
        styles={ { body: { maxHeight: '500px', overflowY: 'auto' } } }
        destroyOnHidden
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="方案名称" rules={[{ required: true, message: '请输入方案名称' }]}>
            <Input placeholder="例如：A股市场情绪监测" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="方案描述（可选）" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select options={[{ label: '运行中', value: 'active' }, { label: '暂停', value: 'paused' }]} />
          </Form.Item>
          <Form.Item
            name="includeKeywords"
            label="包含关键词"
            extra="多个关键词用逗号或空格分隔"
            rules={[{ required: true, message: '请输入至少一个关键词' }]}
          >
            <Input.TextArea rows={2} placeholder="A股, 大盘, 沪深300" />
          </Form.Item>
          <Form.Item name="excludeKeywords" label="排除关键词" extra="多个关键词用逗号或空格分隔">
            <Input.TextArea rows={2} placeholder="广告, 推广" />
          </Form.Item>
          <Form.Item name="sourceTypes" label="数据来源">
            <Select mode="multiple" options={sourceTypeOptions} placeholder="选择数据来源" />
          </Form.Item>
          <Form.Item name="sentimentThreshold" label="情感阈值" extra="低于此值触发预警（-1到1）">
            <InputNumber min={-1} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="riskThreshold" label="风险阈值">
            <Select options={riskOptions} placeholder="选择风险阈值" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
