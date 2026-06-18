import type { ReactNode } from 'react';

export interface PanelProps {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function Panel({ title, extra, children, className, style }: PanelProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-2xl)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        ...style,
      }}
    >
      {(title || extra) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {title && (
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </span>
          )}
          {extra && <span>{extra}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
