'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/components/SessionProvider';
import { apiFetch } from '@/lib/apiClient';
import { AppointmentRow } from '@/components/AppointmentRow';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { AppointmentView } from '@/types/client';

const CALENDAR_MESSAGES: Record<string, { kind: 'success' | 'error'; text: string }> = {
  connected: { kind: 'success', text: 'Google Calendar connected. New bookings will sync automatically.' },
  error: { kind: 'error', text: 'Could not connect Google Calendar. Please try again.' },
};

export default function DashboardPage() {
  const { user } = useSession();
  const [appointments, setAppointments] = useState<AppointmentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarBanner, setCalendarBanner] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('calendar');
    if (flag && CALENDAR_MESSAGES[flag]) setCalendarBanner(CALENDAR_MESSAGES[flag]);
  }, []);

  useEffect(() => {
    apiFetch<{ appointments: AppointmentView[] }>('/api/appointments')
      .then((d) => setAppointments(d.appointments))
      .catch((e) => setError(e.message));
  }, []);

  if (!user) return null;

  const upcoming = (appointments || []).filter((a) => a.status === 'confirmed');
  const past = (appointments || []).filter((a) => a.status !== 'confirmed');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {user.role === 'patient' && 'My Appointments'}
            {user.role === 'doctor' && 'My Schedule'}
            {user.role === 'admin' && 'Clinic Overview'}
          </h1>
          <p className="text-sm text-ink-muted">Welcome back, {user.name}.</p>
        </div>
        {user.role === 'patient' && (
          <Link href="/dashboard/doctors">
            <Button>Book Appointment</Button>
          </Link>
        )}
        {user.role === 'admin' && (
          <div className="flex gap-2">
            <Link href="/dashboard/admin/doctors">
              <Button variant="secondary">Manage Doctors</Button>
            </Link>
            <Link href="/dashboard/admin/notifications">
              <Button variant="secondary">Notifications</Button>
            </Link>
          </div>
        )}
      </div>

      {calendarBanner && <Alert kind={calendarBanner.kind}>{calendarBanner.text}</Alert>}
      <CalendarConnectCard />

      {error && <Alert kind="error">{error}</Alert>}

      {!appointments && !error && <p className="text-sm text-ink-muted">Loading appointments…</p>}

      {appointments && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {user.role === 'admin' ? 'Upcoming (confirmed)' : 'Upcoming'}
            </h2>
            {upcoming.length === 0 && (
              <Card>
                <CardBody className="text-sm text-ink-muted">No upcoming appointments.</CardBody>
              </Card>
            )}
            <div className="grid gap-3">
              {upcoming.map((a) => (
                <AppointmentRow key={a.id} appt={a} viewerRole={user.role as 'patient' | 'doctor' | 'admin'} />
              ))}
            </div>
          </section>

          {past.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">History</h2>
              <div className="grid gap-3">
                {past.map((a) => (
                  <AppointmentRow key={a.id} appt={a} viewerRole={user.role as 'patient' | 'doctor' | 'admin'} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CalendarConnectCard() {
  const { user } = useSession();
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ configured: boolean; connected: boolean }>('/api/calendar/status')
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (!status || !status.configured || status.connected || user?.role === 'admin') return null;

  async function connect() {
    setBusy(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/calendar/connect');
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">Connect Google Calendar</p>
          <p className="text-sm text-ink-muted">Automatically add and update appointments on your calendar.</p>
        </div>
        <Button variant="secondary" onClick={connect} loading={busy}>
          Connect
        </Button>
      </CardBody>
    </Card>
  );
}
