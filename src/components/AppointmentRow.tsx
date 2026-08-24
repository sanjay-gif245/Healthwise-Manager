'use client';

import Link from 'next/link';
import { formatDateLabel } from '@/lib/format';
import { StatusBadge } from './ui/StatusBadge';
import { UrgencyBadge } from './ui/UrgencyBadge';
import type { AppointmentView } from '@/types/client';

export function AppointmentRow({ appt, viewerRole }: { appt: AppointmentView; viewerRole: 'patient' | 'doctor' | 'admin' }) {
  const counterpart =
    viewerRole === 'patient'
      ? appt.doctorName
        ? `Dr. ${appt.doctorName}`
        : '—'
      : viewerRole === 'doctor'
      ? appt.patientName || '—'
      : `${appt.patientName || '—'} → Dr. ${appt.doctorName || '—'}`;

  return (
    <Link
      href={`/dashboard/appointments/${appt.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 transition-colors hover:border-brand sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-semibold text-ink">{counterpart}</p>
        <p className="text-sm text-ink-muted">
          {formatDateLabel(appt.slot_start)}
          {appt.doctorSpecialisation && viewerRole !== 'doctor' ? ` · ${appt.doctorSpecialisation}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {appt.urgency_level && <UrgencyBadge level={appt.urgency_level} />}
        <StatusBadge status={appt.status} />
      </div>
    </Link>
  );
}
