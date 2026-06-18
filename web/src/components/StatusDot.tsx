export interface StatusDotProps {
  status: '正常' | '延迟' | '异常' | '需授权' | '离线';
  className?: string;
}

const statusColorMap: Record<string, string> = {
  '正常': 'var(--accent-success)',
  '延迟': 'var(--accent-warning)',
  '异常': 'var(--accent-danger)',
  '需授权': 'var(--accent-info)',
  '离线': 'var(--text-disabled)',
};

export default function StatusDot({ status, className }: StatusDotProps) {
  const color = statusColorMap[status] || 'var(--text-muted)';
  return (
    <span
      className={className}
      title={status}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
      }}
    />
  );
}
