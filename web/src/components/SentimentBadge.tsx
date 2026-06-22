import type { FinancialSentimentLabel } from '@/api/types';

export interface SentimentBadgeProps {
  label: FinancialSentimentLabel;
  size?: 'small' | 'default';
  className?: string;
}

const colorMap: Record<FinancialSentimentLabel, string> = {
  strong_positive: '#22C55E',
  weak_positive: '#22C55E',
  neutral: '#94A3B8',
  weak_negative: '#EF4444',
  strong_negative: '#EF4444',
  risk: '#F59E0B',
  rumor: '#3B82F6',
};

const textMap: Record<FinancialSentimentLabel, string> = {
  strong_positive: '强利好',
  weak_positive: '弱利好',
  neutral: '中性',
  weak_negative: '弱利空',
  strong_negative: '强利空',
  risk: '风险',
  rumor: '传闻',
};

export default function SentimentBadge({ label, size = 'default', className }: SentimentBadgeProps) {
  const color = colorMap[label] || '#94A3B8';
  const text = textMap[label] || label;
  const isSmall = size === 'small';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        padding: isSmall ? '1px 6px' : '2px 8px',
        fontSize: isSmall ? 10 : 12,
        fontWeight: 600,
        lineHeight: isSmall ? '16px' : '20px',
        color,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  );
}
