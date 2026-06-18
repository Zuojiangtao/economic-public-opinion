export interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function ProgressBar({
  value,
  color = 'var(--accent-info)',
  height = 4,
  className,
  style,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={className}
      style={{
        background: 'var(--bg-input)',
        borderRadius: height / 2,
        overflow: 'hidden',
        height,
        width: '100%',
        ...style,
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: '100%',
          background: color,
          borderRadius: height / 2,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}
