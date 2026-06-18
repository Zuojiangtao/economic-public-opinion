import type { ReactNode } from 'react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  color?: string;
  sparklineData?: number[];
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
}

function getTemperatureColor(score: number): string {
  if (score >= 80) return 'var(--temp-overheated)';
  if (score >= 60) return 'var(--temp-warm)';
  if (score >= 40) return 'var(--temp-neutral)';
  if (score >= 20) return 'var(--temp-cool)';
  return 'var(--temp-freezing)';
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 48;
  const h = 20;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StatCard({
  label,
  value,
  trend,
  trendLabel,
  color,
  sparklineData,
  icon,
  onClick,
  className,
}: StatCardProps) {
  const resolvedColor = color || 'var(--accent-info)';

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s',
        ...(onClick ? { ':hover': { borderColor: 'var(--border-subtle)' } } : {}),
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget.style.borderColor = 'var(--border-subtle)');
      }}
      onMouseLeave={(e) => {
        if (onClick) (e.currentTarget.style.borderColor = 'var(--border-default)');
      }}
    >
      {/* Top row: label + sparkline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
        {sparklineData && <MiniSparkline data={sparklineData} color={resolvedColor} />}
      </div>

      {/* Bottom row: value + trend + icon */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 32,
              color: resolvedColor,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {icon && (
            <span style={{ color: resolvedColor, fontSize: 18, marginBottom: 2 }}>{icon}</span>
          )}
        </div>
        {trend !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: trend > 0 ? 'var(--accent-danger)' : trend < 0 ? 'var(--accent-success)' : 'var(--text-muted)',
            }}
          >
            {trend > 0 ? (
              <ArrowUpOutlined style={{ fontSize: 10 }} />
            ) : trend < 0 ? (
              <ArrowDownOutlined style={{ fontSize: 10 }} />
            ) : null}
            {trend > 0 ? '+' : ''}
            {trend}
            {trendLabel && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export { getTemperatureColor };
