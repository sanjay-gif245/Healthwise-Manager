'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea, Label } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Alert';

interface DoctorDetail {
  id: string;
  name: string;
  specialisation: string;
  bio: string | null;
  slotDurationMinutes: number;
}
interface SlotCandidate {
  start: string;
  end: string;
  localLabel: string;
  status: 'available' | 'booked' | 'held';
}

function nextDays(n: number): { ymd: string; label: string }[] {
  const out: { ymd: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
    out.push({ ymd, label });
  }
  return out;
}

export default function DoctorBookingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const doctorId = params.id;

  const days = useMemo(() => nextDays(14), []);
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [selectedDate, setSelectedDate] = useState(days[0].ymd);
  const [slots, setSlots] = useState<SlotCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [hold, setHold] = useState<{ id: string; slotStart: string; ttlSeconds: number } | null>(null);
  const [symptomText, setSymptomText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    apiFetch<{ doctor: DoctorDetail }>(`/api/doctors/${doctorId}`)
      .then((d) => setDoctor(d.doctor))
      .catch((e) => setError(e.message));
  }, [doctorId]);

  useEffect(() => {
    setSlotsLoading(true);
    setError(null);
    apiFetch<{ slots: SlotCandidate[] }>(`/api/doctors/${doctorId}/slots?date=${selectedDate}`)
      .then((d) => setSlots(d.slots))
      .catch((e) => setError(e.message))
      .finally(() => setSlotsLoading(false));
  }, [doctorId, selectedDate]);

  useEffect(() => {
    if (!hold) return;
    setSecondsLeft(hold.ttlSeconds);
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          setHold(null);
          setConfirmError('Your hold on this slot expired. Please select a slot again.');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.id]);

  async function selectSlot(slot: SlotCandidate) {
    setConfirmError(null);
    try {
      const res = await apiFetch<{ hold: { id: string; slot_start: string }; ttlSeconds: number }>('/api/appointments/hold', {
        method: 'POST',
        body: JSON.stringify({ doctorId, slotStart: slot.start, slotEnd: slot.end }),
      });
      setHold({ id: res.hold.id, slotStart: res.hold.slot_start, ttlSeconds: res.ttlSeconds });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Could not hold this slot';
      setConfirmError(msg);
      // Refresh slots since this one is likely now held/booked by someone else.
      apiFetch<{ slots: SlotCandidate[] }>(`/api/doctors/${doctorId}/slots?date=${selectedDate}`).then((d) => setSlots(d.slots));
    }
  }

  async function confirm() {
    if (!hold) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await apiFetch<{ appointment: { id: string } }>('/api/appointments/confirm', {
        method: 'POST',
        body: JSON.stringify({ holdId: hold.id, symptomText }),
      });
      router.push(`/dashboard/appointments/${res.appointment.id}?justBooked=1`);
    } catch (e) {
      setConfirmError(e instanceof ApiError ? e.message : 'Could not confirm booking');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      {doctor && (
        <div>
          <h1 className="text-2xl font-semibold text-ink">Dr. {doctor.name}</h1>
          <p className="text-sm text-ink-muted">
            {doctor.specialisation} · {doctor.slotDurationMinutes}-minute slots
          </p>
          {doctor.bio && <p className="mt-2 max-w-2xl text-sm text-ink-muted">{doctor.bio}</p>}
        </div>
      )}

      {error && <Alert kind="error">{error}</Alert>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d.ymd}
            onClick={() => setSelectedDate(d.ymd)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium ${
              selectedDate === d.ymd
                ? 'border-brand bg-teal-50 text-brand'
                : 'border-border bg-white text-navtext hover:border-brand'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody>
          {slotsLoading && <p className="text-sm text-ink-muted">Loading slots…</p>}
          {!slotsLoading && slots?.length === 0 && (
            <p className="text-sm text-ink-muted">No slots available on this date (doctor may be on leave or fully booked).</p>
          )}
          {!slotsLoading && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {slots.map((s) => (
                <button
                  key={s.start}
                  disabled={s.status !== 'available'}
                  onClick={() => selectSlot(s)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    s.status === 'available'
                      ? 'border-brand text-brand hover:bg-teal-50'
                      : 'cursor-not-allowed border-border bg-slate-50 text-slate-400'
                  }`}
                  title={s.status !== 'available' ? `Slot ${s.status}` : undefined}
                >
                  {s.localLabel}
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {hold && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">Confirm your symptoms to book this slot</p>
              <span className="text-xs text-ink-muted">Hold expires in {secondsLeft}s</span>
            </div>
            {confirmError && <Alert kind="error">{confirmError}</Alert>}
            <div>
              <Label htmlFor="symptoms">Describe your symptoms</Label>
              <Textarea
                id="symptoms"
                rows={4}
                placeholder="e.g. Fever for 2 days, mild headache, sore throat…"
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
              />
              <p className="mt-1 text-xs text-ink-muted">
                This is sent to an AI assistant to prepare a pre-visit summary and urgency level for your doctor.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={confirm} loading={confirming} disabled={symptomText.trim().length < 3}>
                Confirm Booking
              </Button>
              <Button variant="ghost" onClick={() => setHold(null)} disabled={confirming}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
