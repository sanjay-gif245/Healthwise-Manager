const config: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: '#EFF6FF', text: '#1D4ED8' },
  completed: { bg: '#F0FDF4', text: '#166534' },
  cancelled: { bg: '#F1F5F9', text: '#475569' },
  rescheduled: { bg: '#FFFBEB', text: '#92400E' },
  pending: { bg: '#F1F5F9', text: '#475569' },
  sent: { bg: '#F0FDF4', text: '#166534' },
  failed: { bg: '#FEF2F2', text: '#991B1B' },
  ready: { bg: '#F0FDF4', text: '#166534' },
  simulated: { bg: '#FFFBEB', text: '#92400E' },
  not_submitted: { bg: '#F1F5F9', text: '#475569' },
};

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const c = config[status] || { bg: '#F1F5F9', text: '#475569' };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
