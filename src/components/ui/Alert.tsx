type Kind = 'info' | 'success' | 'warning' | 'error';

const config: Record<Kind, { bg: string; text: string; border: string }> = {
  info: { bg: '#F8FAFC', text: '#334155', border: '#E2E8F0' },
  success: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  warning: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  error: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

export function Alert({ kind = 'info', children }: { kind?: Kind; children: React.ReactNode }) {
  const c = config[kind];
  return (
    <div
      className="rounded-lg border px-3.5 py-2.5 text-sm"
      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}
    >
      {children}
    </div>
  );
}
