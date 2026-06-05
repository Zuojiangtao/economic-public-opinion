import { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Modal,
  Form,
  Input,
  Typography,
  Timeline,
  Descriptions,
  Tabs,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, alertRulesApi } from '../../api/client';
import type { Alert, AlertStatus, AlertAction, RiskLevel, AlertRule } from '../../api/types';

const statusMap: Record<string, { text: string; color: string; icon: React.ReactNode }> = {
  pending: { text: '待处理', color: 'red', icon: <ExclamationCircleOutlined /> },
  processing: { text: '处理中', color: 'blue', icon: <ClockCircleOutlined /> },
  resolved: { text: '已解决', color: 'green', icon: <CheckCircleOutlined /> },
  ignored: { text: '已忽略', color: 'default', icon: <StopOutlined /> },
};

const riskColorMap: Record<string, string> = {
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
};

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | undefined>();
  const [riskFilter, setRiskFilter] = useState<RiskLevel | undefined>();
  const [detailModal, setDetailModal] = useState<Alert | null>(null);
  const [handleModal, setHandleModal] = useState<Alert | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', { status: statusFilter, riskLevel: riskFilter }],
    queryFn: () => alertsApi.list({ status: statusFilter, riskLevel: riskFilter, page: 1, pageSize: 50 }),
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['alertRules'],
    queryFn: () => alertRulesApi.list(),
  });

  const handleMutation = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      alertsApi.handle(id, { action: action as AlertAction, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      message.success('操作成功');
      setHandleModal(null);
      form.resetFields();
    },
  });

  function getAvailableActions(status: AlertStatus) {
    switch (status) {
      case 'pending':
        return [
          { label: '开始处理', value: 'start_processing' },
          { label: '忽略', value: 'ignore' },
        ];
      case 'processing':
        return [
          { label: '标记解决', value: 'resolve' },
          { label: '忽略', value: 'ignore' },
        ];
      case 'resolved':
      case 'ignored':
        return [{ label: '重新打开', value: 'reopen' }];
      default:
        return [];
    }
  }

  const columns = [
    {
      title: '预警标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record: Alert) => (
        <a onClick={() => setDetailModal(record)}>{text}</a>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 100,
      render: (level: string) => (
        <Tag color={riskColorMap[level]}>{level.toUpperCase()}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const st = statusMap[status];
        return st ? (
          <Tag color={st.color} icon={st.icon}>
            {st.text}
          </Tag>
        ) : (
          status
        );
      },
    },
    {
      title: '触发规则',
      dataIndex: 'ruleName',
      key: 'ruleName',
      width: 160,
      ellipsis: true,
    },
    {
      title: '触发时间',
      dataIndex: 'triggeredAt',
      key: 'triggeredAt',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record: Alert) => (
        <Space>
          <Button type="link" size="small" onClick={() => setDetailModal(record)}>
            详情
          </Button>
          <Button type="link" size="small" onClick={() => setHandleModal(record)}>
            处置
          </Button>
        </Space>
      ),
    },
  ];

  const ruleColumns = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '停用'}</Tag>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 16 }}>预警中心</Typography.Title>

      <Tabs
        items={[
          {
            key: 'alerts',
            label: '预警列表',
            children: (
              <>
                <Card style={{ marginBottom: 16 }}>
                  <Space>
                    <Select
                      placeholder="状态筛选"
                      options={[
                        { label: '待处理', value: 'pending' },
                        { label: '处理中', value: 'processing' },
                        { label: '已解决', value: 'resolved' },
                        { label: '已忽略', value: 'ignored' },
                      ]}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      allowClear
                      style={{ width: 140 }}
                    />
                    <Select
                      placeholder="风险等级"
                      options={[
                        { label: '低', value: 'low' },
                        { label: '中', value: 'medium' },
                        { label: '高', value: 'high' },
                        { label: '极高', value: 'critical' },
                      ]}
                      value={riskFilter}
                      onChange={setRiskFilter}
                      allowClear
                      style={{ width: 120 }}
                    />
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => {
                        setStatusFilter(undefined);
                        setRiskFilter(undefined);
                      }}
                    >
                      重置
                    </Button>
                  </Space>
                </Card>
                <Card>
                  <Table<Alert>
                    columns={columns}
                    dataSource={data?.items}
                    rowKey="id"
                    loading={isLoading}
                    pagination={false}
                    size="middle"
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'rules',
            label: '预警规则',
            children: (
              <Card>
                <Table<AlertRule>
                  columns={ruleColumns}
                  dataSource={rules || []}
                  rowKey="id"
                  loading={rulesLoading}
                  pagination={false}
                  size="middle"
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="预警详情"
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={[
          <Button key="close" onClick={() => setDetailModal(null)}>
            关闭
          </Button>,
          <Button
            key="handle"
            type="primary"
            onClick={() => {
              if (detailModal) {
                setHandleModal(detailModal);
                setDetailModal(null);
              }
            }}
          >
            处置
          </Button>,
        ]}
        width={640}
      >
        {detailModal && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="风险等级">
                <Tag color={riskColorMap[detailModal.riskLevel]}>
                  {detailModal.riskLevel.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[detailModal.status].color}>
                  {statusMap[detailModal.status].text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发规则" span={2}>
                {detailModal.ruleName}
              </Descriptions.Item>
              <Descriptions.Item label="触发时间" span={2}>
                {new Date(detailModal.triggeredAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {detailModal.description}
              </Descriptions.Item>
            </Descriptions>

            {detailModal.handleRecords.length > 0 && (
              <>
                <Typography.Title level={5}>处置记录</Typography.Title>
                <Timeline
                  items={detailModal.handleRecords.map((r) => ({
                    children: (
                      <div>
                        <div>
                          <Tag>{r.action}</Tag>
                          <span style={{ fontSize: 12, color: '#999' }}>
                            {r.handler} - {new Date(r.timestamp).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {r.note && <div style={{ marginTop: 4 }}>{r.note}</div>}
                      </div>
                    ),
                  }))}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="处置预警"
        open={!!handleModal}
        onCancel={() => {
          setHandleModal(null);
          form.resetFields();
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            if (handleModal) {
              handleMutation.mutate({
                id: handleModal.id,
                action: values.action,
                note: values.note,
              });
            }
          });
        }}
        confirmLoading={handleMutation.isPending}
      >
        {handleModal && (
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Form.Item
              name="action"
              label="操作"
              rules={[{ required: true, message: '请选择操作' }]}
            >
              <Select
                options={getAvailableActions(handleModal.status)}
                placeholder="选择操作"
              />
            </Form.Item>
            <Form.Item name="note" label="处置说明">
              <Input.TextArea rows={3} placeholder="输入处置说明（可选）" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
