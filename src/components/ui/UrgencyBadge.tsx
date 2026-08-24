import type { UrgencyLevel } from '@/types/models';

const config: Record<UrgencyLevel, { bg: string; text: string; dot: string; label: string; emoji: string }> = {
  Low: { bg: '#F0FDF4', text: '#166534', dot: '#16A34A', label: 'Low urgency', emoji: '🟢' },
  Medium: { bg: '#FFFBEB', text: '#92400E', dot: '#D97706', label: 'Medium urgency', emoji: '🟠' },
  High: { bg: '#FEF2F2', text: '#991B1B', dot: '#DC2626', label: 'High urgency', emoji: '🔴' },
};

export function UrgencyBadge({ level, className = '' }: { level: UrgencyLevel; className?: string }) {
  const c = config[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {level}
    </span>
  );
}
