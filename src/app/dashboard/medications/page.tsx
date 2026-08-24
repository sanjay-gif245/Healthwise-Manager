'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';

interface ReminderView {
  id: string;
  drug_name: string;
  dosage: string | null;
  frequency_per_day: number;
  duration_days: number;
  start_date: string;
  reminder_times: string[];
  last_sent_date: string | null;
  active: 0 | 1;
}

export default function MedicationsPage() {
  const [reminders, setReminders] = useState<ReminderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ reminders: ReminderView[] }>('/api/medications')
      .then((d) => setReminders(d.reminders))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Medication Reminders</h1>
        <p className="text-sm text-ink-muted">
          Generated automatically from prescriptions your doctor submits after a visit.
        </p>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {!reminders && !error && <p className="text-sm text-ink-muted">Loading…</p>}
      {reminders && reminders.length === 0 && (
        <Card>
          <CardBody className="text-sm text-ink-muted">No active medication reminders.</CardBody>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {reminders?.map((r) => (
          <Card key={r.id}>
            <CardBody>
              <p className="font-semibold text-ink">
                {r.drug_name} {r.dosage ? `(${r.dosage})` : ''}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {r.frequency_per_day}x/day for {r.duration_days} day(s), starting {r.start_date}
              </p>
              <p className="mt-2 text-xs text-ink-muted">Reminder times: {r.reminder_times.join(', ')}</p>
              {r.last_sent_date && <p className="mt-1 text-xs text-ink-muted">Last reminded: {r.last_sent_date}</p>}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
