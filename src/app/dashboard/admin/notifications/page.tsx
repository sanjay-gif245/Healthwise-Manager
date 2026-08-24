'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { Card, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Alert';

interface NotificationRow {
  id: string;
  type: string;
  subject: string;
  status: string;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export default function AdminNotificationsPage() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [counts, setCounts] = useState<{ status: string; count: number }[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = filter ? `?status=${filter}` : '';
    apiFetch<{ notifications: NotificationRow[]; counts: { status: string; count: number }[] }>(`/api/admin/notifications${qs}`)
      .then((d) => {
        setRows(d.notifications);
        setCounts(d.counts);
      })
      .catch((e) => setError(e.message));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-ink-muted">Email delivery log, including retries and failures.</p>
        </div>
        <div className="w-44">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {counts.map((c) => (
          <Card key={c.status} className="min-w-[120px]">
            <CardBody className="py-3">
              <p className="text-xs uppercase text-ink-muted">{c.status}</p>
              <p className="text-xl font-semibold text-ink">{c.count}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {error && <Alert kind="error">{error}</Alert>}

      <Card>
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last error</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 capitalize text-ink">{r.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.subject}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{r.attempts}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-red-700">{r.last_error || '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">{new Date(r.created_at).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows?.length === 0 && <p className="p-4 text-sm text-ink-muted">No notifications yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
