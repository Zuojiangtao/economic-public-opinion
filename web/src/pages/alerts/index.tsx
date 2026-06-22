import { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Select,
  Modal,
  Typography,
  Timeline,
  Descriptions,
  Tabs,
  message,
} from 'antd';
import Panel from '../../components/Panel';
import StatusDot from '../../components/StatusDot';
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

const statusDotMap: Record<string, { text: string; dotStatus: '异常' | '延迟' | '正常' | '离线' }> = {
  pending: { text: '待处理', dotStatus: '异常' },
  processing: { text: '处理中', dotStatus: '延迟' },
  resolved: { text: '已解决', dotStatus: '正常' },
  ignored: { text: '已忽略', dotStatus: '离线' },
};

const riskStyles: Record<string, { color: string; bg: string }> = {
  low: { color: 'var(--accent-success)', bg: 'var(--accent-success-bg)' },
  medium: { color: 'var(--accent-warning)', bg: 'var(--accent-warning-bg)' },
  high: { color: 'var(--accent-danger)', bg: 'var(--accent-danger-bg)' },
  critical: { color: 'var(--accent-danger)', bg: 'var(--accent-danger-bg)' },
};



export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | undefined>();
  const [riskFilter, setRiskFilter] = useState<RiskLevel | undefined>();
  const [detailModal, setDetailModal] = useState<Alert | null>(null);
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
      message.success('已阅');
    },
  });

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
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: '20px',
            color: riskStyles[level]?.color || 'var(--text-secondary)',
            background: riskStyles[level]?.bg || 'transparent',
          }}
        >
          {level.toUpperCase()}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const st = statusDotMap[status];
        return st ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <StatusDot status={st.dotStatus} />
            <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{st.text}</span>
          </span>
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
          {(record.status === 'pending' || record.status === 'processing') && (
            <Button
              type="link"
              size="small"
              onClick={() => handleMutation.mutate({ id: record.id, action: 'resolve' })}
            >
              已阅
            </Button>
          )}
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
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: '20px',
            color: enabled ? 'var(--accent-success)' : 'var(--text-muted)',
            background: enabled ? 'var(--accent-success-bg)' : 'var(--bg-input)',
          }}
        >
          {enabled ? '启用' : '停用'}
        </span>
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
                <Panel style={{ marginBottom: 16 }}>
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
                </Panel>
                <Panel>
                  <Table<Alert>
                    columns={columns}
                    dataSource={data?.items}
                    rowKey="id"
                    loading={isLoading}
                    pagination={false}
                    size="middle"
                  />
                </Panel>
              </>
            ),
          },
          {
            key: 'rules',
            label: '预警规则',
            children: (
              <Panel>
                <Table<AlertRule>
                  columns={ruleColumns}
                  dataSource={rules || []}
                  rowKey="id"
                  loading={rulesLoading}
                  pagination={false}
                  size="middle"
                />
              </Panel>
            ),
          },
        ]}
      />

      <Modal
        title="预警详情"
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={detailModal && (detailModal.status === 'pending' || detailModal.status === 'processing') ? [
          <Button key="close" onClick={() => setDetailModal(null)}>
            关闭
          </Button>,
          <Button
            key="ack"
            type="primary"
            onClick={() => {
              handleMutation.mutate({ id: detailModal.id, action: 'resolve' });
              setDetailModal(null);
            }}
          >
            已阅
          </Button>,
        ] : [
          <Button key="close" onClick={() => setDetailModal(null)}>
            关闭
          </Button>,
        ]}
        width={640}
      >
        {detailModal && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="风险等级">
                <span
                  style={{
                    display: 'inline-block',
                    padding: '1px 6px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: '20px',
                    color: riskStyles[detailModal.riskLevel]?.color || 'var(--text-secondary)',
                    background: riskStyles[detailModal.riskLevel]?.bg || 'transparent',
                  }}
                >
                  {detailModal.riskLevel.toUpperCase()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <StatusDot status={statusDotMap[detailModal.status].dotStatus} />
                  <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                    {statusDotMap[detailModal.status].text}
                  </span>
                </span>
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
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '1px 6px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              lineHeight: '20px',
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-input)',
                            }}
                          >
                            {r.action}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
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
    </div>
  );
}
