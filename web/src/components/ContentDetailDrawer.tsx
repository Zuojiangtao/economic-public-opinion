import { Drawer, Descriptions, Tag, Typography, Space, Divider, Progress, Alert, Tooltip } from 'antd';
import {
  LikeOutlined,
  MessageOutlined,
  ShareAltOutlined,
  EyeOutlined,
  LinkOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import type { ContentItem, FinancialSentimentLabel } from '../api/types';

const sourceTypeLabels: Record<string, string> = {
  news: '新闻',
  forums: '论坛',
  social: '社媒',
  broker: '研报',
  app: 'APP',
};

const sentimentColors: Record<string, string> = {
  positive: '#52c41a',
  neutral: '#1677ff',
  negative: '#ff4d4f',
};

const sentimentLabels: Record<string, string> = {
  positive: '正面',
  neutral: '中性',
  negative: '负面',
};

const riskLabels: Record<string, { text: string; color: string }> = {
  low: { text: '低风险', color: 'green' },
  medium: { text: '中风险', color: 'gold' },
  high: { text: '高风险', color: 'orange' },
  critical: { text: '极高风险', color: 'red' },
};

// T011: 精细情绪标签展示配置
const financialLabelConfig: Record<FinancialSentimentLabel, { text: string; color: string; alertType?: 'success' | 'warning' | 'error' | 'info' }> = {
  strong_positive: { text: '强利好', color: '#00a854', alertType: 'success' },
  weak_positive: { text: '弱利好', color: '#52c41a', alertType: 'success' },
  neutral: { text: '中性', color: '#1677ff', alertType: 'info' },
  weak_negative: { text: '弱利空', color: '#fa8c16', alertType: 'warning' },
  strong_negative: { text: '强利空', color: '#f5222d', alertType: 'error' },
  risk: { text: '风险', color: '#cf1322', alertType: 'error' },
  rumor: { text: '传闻', color: '#722ed1', alertType: 'warning' },
};

interface ContentDetailDrawerProps {
  open: boolean;
  item: ContentItem | null;
  onClose: () => void;
}

export default function ContentDetailDrawer({ open, item, onClose }: ContentDetailDrawerProps) {
  if (!item) return null;

  const sentimentPercent = Math.round(((item.nlp.sentiment + 1) / 2) * 100);

  return (
    <Drawer
      title={item.title}
      open={open}
      onClose={onClose}
      width={640}
      destroyOnHidden
    >
      <Descriptions column={2} size="small" bordered>
        <Descriptions.Item label="来源类型">
          <Tag>{sourceTypeLabels[item.sourceType]}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="来源名称">{item.sourceName}</Descriptions.Item>
        <Descriptions.Item label="作者">{item.author}</Descriptions.Item>
        <Descriptions.Item label="发布时间">
          {new Date(item.publishedAt).toLocaleString('zh-CN')}
        </Descriptions.Item>
        <Descriptions.Item label="抓取时间">
          {new Date(item.fetchedAt).toLocaleString('zh-CN')}
        </Descriptions.Item>
        <Descriptions.Item label="原文链接">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> 查看原文
          </a>
        </Descriptions.Item>
      </Descriptions>

      <Divider>互动数据</Divider>
      <Space size="large">
        <span><LikeOutlined /> {item.metrics.likes ?? 0}</span>
        <span><MessageOutlined /> {item.metrics.comments ?? 0}</span>
        <span><ShareAltOutlined /> {item.metrics.shares ?? 0}</span>
        <span><EyeOutlined /> {item.metrics.views ?? 0}</span>
      </Space>

      <Divider>NLP 分析</Divider>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>情感倾向</span>
          <Tag color={sentimentColors[item.nlp.sentimentLabel]}>
            {sentimentLabels[item.nlp.sentimentLabel]} ({item.nlp.sentiment})
          </Tag>
        </div>
        <Progress
          percent={sentimentPercent}
          strokeColor={sentimentColors[item.nlp.sentimentLabel]}
          showInfo={false}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <span>风险等级：</span>
        <Tag color={riskLabels[item.nlp.riskLevel].color}>
          {riskLabels[item.nlp.riskLevel].text}
        </Tag>
      </div>
      {item.nlp.summary && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">AI摘要：</Typography.Text>
          <Typography.Paragraph>{item.nlp.summary}</Typography.Paragraph>
        </div>
      )}
      {item.nlp.entities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">识别实体：</Typography.Text>
          <div style={{ marginTop: 4 }}>
            {item.nlp.entities.map((e) => (
              <Tag key={e.name} color="blue">{e.name}({e.type})</Tag>
            ))}
          </div>
        </div>
      )}

      {/* T011: 增强情绪分析展示 */}
      {item.nlp.enhanced && (() => {
        const en = item.nlp.enhanced!;
        const cfg = financialLabelConfig[en.label];
        return (
          <>
            <Divider>
              <RobotOutlined style={{ marginRight: 4 }} />
              金融语义情绪分析
              <Tooltip title={`分析来源：${en.modelSource === 'llm' ? '大模型' : '词典模型'}`}>
                <Tag style={{ marginLeft: 8, cursor: 'default' }} color="geekblue">
                  {en.modelSource === 'llm' ? '大模型' : '词典'}
                </Tag>
              </Tooltip>
            </Divider>
            <Alert
              type={cfg.alertType ?? 'info'}
              message={
                <Space>
                  <Tag color={cfg.color} style={{ fontSize: 13, padding: '2px 8px' }}>{cfg.text}</Tag>
                  <Typography.Text type="secondary">
                    置信度：{Math.round(en.confidence * 100)}%
                    {en.secondaryAnalysis && <Tag color="volcano" style={{ marginLeft: 8 }}>高影响内容</Tag>}
                  </Typography.Text>
                </Space>
              }
              description={<Typography.Text type="secondary" style={{ fontSize: 12 }}>{en.reasoning}</Typography.Text>}
              style={{ marginBottom: 12 }}
            />
            {(en.positiveSignals.length > 0 || en.negativeSignals.length > 0 || en.riskSignals.length > 0 || en.rumorSignals.length > 0) && (
              <Space wrap style={{ marginBottom: 8 }}>
                {en.positiveSignals.map((s) => <Tag key={s} color="success">{s}</Tag>)}
                {en.negativeSignals.map((s) => <Tag key={s} color="error">{s}</Tag>)}
                {en.riskSignals.map((s) => <Tag key={s} color="volcano">⚠ {s}</Tag>)}
                {en.rumorSignals.map((s) => <Tag key={s} color="purple">传闻: {s}</Tag>)}
              </Space>
            )}
          </>
        );
      })()}

      <Divider>命中方案</Divider>
      {item.matches.map((m) => (
        <div key={m.projectId} style={{ marginBottom: 8 }}>
          <Tag color="purple">{m.projectName}</Tag>
          {m.keywords.map((kw) => (
            <Tag key={kw}>{kw}</Tag>
          ))}
          {m.tags.map((t) => (
            <Tag key={t} color="cyan">{t}</Tag>
          ))}
        </div>
      ))}

      {item.dedup.similarCount > 0 && (
        <>
          <Divider>相似内容</Divider>
          <Typography.Text type="secondary">
            共 {item.dedup.similarCount} 篇相似文章 (簇ID: {item.dedup.clusterId})
          </Typography.Text>
        </>
      )}

      <Divider>正文内容</Divider>
      <Typography.Paragraph>{item.content}</Typography.Paragraph>
    </Drawer>
  );
}
