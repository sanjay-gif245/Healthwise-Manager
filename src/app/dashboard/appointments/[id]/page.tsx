'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { useSession } from '@/components/SessionProvider';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { UrgencyBadge } from '@/components/ui/UrgencyBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateLabel } from '@/lib/format';
import { PostVisitForm } from '@/components/PostVisitForm';
import type { AppointmentView } from '@/types/client';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justBooked = searchParams.get('justBooked') === '1';

  const [appt, setAppt] = useState<AppointmentView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = () => {
    apiFetch<{ appointment: AppointmentView }>(`/api/appointments/${id}`)
      .then((d) => setAppt(d.appointment))
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pre-visit summary generation happens synchronously during booking, but
  // poll briefly in case it's still finishing up right after a fresh booking.
  useEffect(() => {
    if (!appt || appt.pre_visit_summary_status !== 'pending') return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appt?.pre_visit_summary_status]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!appt || !user) return <p className="text-sm text-ink-muted">Loading…</p>;

  const isDoctor = user.role === 'doctor';
  const isPatient = user.role === 'patient';
  const canCancel = appt.status === 'confirmed';

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await apiFetch(`/api/appointments/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
      load();
    } catch (e) {
      setCancelError(e instanceof ApiError ? e.message : 'Could not cancel appointment');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {justBooked && <Alert kind="success">Your appointment is booked! We&apos;re preparing an AI summary for your doctor.</Alert>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">
            {isPatient ? `Dr. ${appt.doctorName}` : appt.patientName}
          </h1>
          <p className="text-sm text-ink-muted">
            {formatDateLabel(appt.slot_start)}
            {appt.doctorSpecialisation ? ` · ${appt.doctorSpecialisation}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {appt.urgency_level && <UrgencyBadge level={appt.urgency_level} />}
          <StatusBadge status={appt.status} />
        </div>
      </div>

      {appt.status === 'cancelled' && appt.cancel_reason && <Alert kind="warning">Cancelled: {appt.cancel_reason}</Alert>}

      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold text-ink">Symptoms reported by patient</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{appt.symptom_text || '—'}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">AI pre-visit summary</h2>
            <SummaryStatusNote status={appt.pre_visit_summary_status} />
          </div>
          {appt.pre_visit_summary_status === 'pending' && <p className="text-sm text-ink-muted">Generating summary…</p>}
          {appt.pre_visit_summary_status !== 'pending' && (
            <div className="space-y-3">
              {appt.urgency_level && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink-muted">Urgency:</span>
                  <UrgencyBadge level={appt.urgency_level} />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-navtext">Chief complaint</p>
                <p className="text-sm text-ink-muted">{appt.chief_complaint || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-navtext">Suggested questions for the doctor</p>
                <ul className="mt-1 list-inside list-disc text-sm text-ink-muted">
                  {(appt.suggested_questions || []).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {isDoctor && appt.status === 'confirmed' && <PostVisitForm appointmentId={appt.id} onSubmitted={load} />}

      {appt.status === 'completed' && (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">{isPatient ? 'Your visit summary' : "Doctor's notes"}</h2>
              <SummaryStatusNote status={appt.post_visit_summary_status} />
            </div>
            {isDoctor && (
              <div>
                <p className="text-sm font-medium text-navtext">Clinical notes</p>
                <p className="whitespace-pre-wrap text-sm text-ink-muted">{appt.doctor_notes}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-navtext">Patient-friendly summary</p>
              <p className="whitespace-pre-wrap text-sm text-ink-muted">{appt.post_visit_summary_text}</p>
            </div>
            {appt.prescription && appt.prescription.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-navtext">Prescription</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-ink-muted">
                        <th className="pb-1 pr-4">Medicine</th>
                        <th className="pb-1 pr-4">Dosage</th>
                        <th className="pb-1 pr-4">Frequency</th>
                        <th className="pb-1">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appt.prescription.map((p, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="py-1.5 pr-4 text-ink">{p.drug}</td>
                          <td className="py-1.5 pr-4 text-ink-muted">{p.dosage || '—'}</td>
                          <td className="py-1.5 pr-4 text-ink-muted">{p.frequency_per_day}x/day</td>
                          <td className="py-1.5 text-ink-muted">{p.duration_days} day(s)</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {canCancel && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">Need to cancel? Both patient and doctor will be notified by email.</p>
            {cancelError && <Alert kind="error">{cancelError}</Alert>}
            <Button variant="danger" onClick={cancel} loading={cancelling}>
              Cancel appointment
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SummaryStatusNote({ status }: { status: string }) {
  if (status === 'ready') return null;
  if (status === 'simulated') {
    return <span className="text-xs font-medium text-amber-700">Simulated (no LLM API key configured)</span>;
  }
  if (status === 'failed') {
    return <span className="text-xs font-medium text-red-700">AI generation failed — showing fallback</span>;
  }
  return null;
}
