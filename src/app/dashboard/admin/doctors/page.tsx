'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label, Input, Textarea } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Alert';
import { WorkingHoursEditor } from '@/components/WorkingHoursEditor';
import type { WorkingHours } from '@/types/models';

interface AdminDoctor {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  specialisation: string;
  bio: string | null;
  slotDurationMinutes: number;
  workingHours: WorkingHours;
}

const DEFAULT_HOURS: WorkingHours = {
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: { start: '09:00', end: '17:00' },
};

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'add'>('view');
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    apiFetch<{ doctors: AdminDoctor[] }>('/api/admin/doctors')
      .then((d) => setDoctors(d.doctors))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const selected = doctors?.find((d) => d.id === selectedId) || null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-ink">Doctors</h1>
          <Button size="sm" onClick={() => { setMode('add'); setSelectedId(null); }}>
            + Add
          </Button>
        </div>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="space-y-2">
          {doctors?.map((d) => (
            <button
              key={d.id}
              onClick={() => { setSelectedId(d.id); setMode('view'); }}
              className={`block w-full rounded-lg border p-3 text-left ${
                selectedId === d.id ? 'border-brand bg-teal-50' : 'border-border bg-white hover:border-brand'
              }`}
            >
              <p className="font-medium text-ink">Dr. {d.name}</p>
              <p className="text-xs text-ink-muted">{d.specialisation}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        {mode === 'add' && <AddDoctorForm onCreated={() => { load(); setMode('view'); }} />}
        {mode === 'view' && selected && <DoctorManagePanel doctor={selected} onUpdated={load} />}
        {mode === 'view' && !selected && (
          <Card>
            <CardBody className="text-sm text-ink-muted">Select a doctor from the list, or add a new one.</CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function AddDoctorForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', specialisation: '', bio: '', slotDurationMinutes: 30 });
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_HOURS);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temporaryPassword?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ doctor: { email: string }; temporaryPassword?: string }>('/api/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({ ...form, workingHours }),
      });
      setResult({ email: res.doctor.email, temporaryPassword: res.temporaryPassword });
      onCreated();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'Could not create doctor');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <h2 className="font-semibold text-ink">Add a doctor</h2>
        {error && <Alert kind="error">{error}</Alert>}
        {result && (
          <Alert kind="success">
            Doctor account created for {result.email}.
            {result.temporaryPassword && <> Temporary password: <strong>{result.temporaryPassword}</strong></>}
          </Alert>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Full name</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Specialisation</Label>
              <Input required value={form.specialisation} onChange={(e) => setForm({ ...form, specialisation: e.target.value })} />
            </div>
            <div>
              <Label>Slot duration (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={240}
                required
                value={form.slotDurationMinutes}
                onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <Label>Bio (optional)</Label>
            <Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <Label>Working hours</Label>
            <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />
          </div>
          <Button type="submit" loading={submitting}>
            Create doctor account
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

interface LeaveDay {
  id: string;
  leave_date: string;
  reason: string | null;
}

function DoctorManagePanel({ doctor, onUpdated }: { doctor: AdminDoctor; onUpdated: () => void }) {
  const [form, setForm] = useState({
    specialisation: doctor.specialisation,
    bio: doctor.bio || '',
    slotDurationMinutes: doctor.slotDurationMinutes,
  });
  const [workingHours, setWorkingHours] = useState<WorkingHours>(doctor.workingHours);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [leave, setLeave] = useState<LeaveDay[] | null>(null);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm({ specialisation: doctor.specialisation, bio: doctor.bio || '', slotDurationMinutes: doctor.slotDurationMinutes });
    setWorkingHours(doctor.workingHours);
    loadLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctor.id]);

  function loadLeave() {
    apiFetch<{ leave: LeaveDay[] }>(`/api/admin/doctors/${doctor.id}/leave`).then((d) => setLeave(d.leave));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      await apiFetch(`/api/admin/doctors/${doctor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, workingHours }),
      });
      setSaveMsg('Saved.');
      onUpdated();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  async function addLeave(e: React.FormEvent) {
    e.preventDefault();
    setLeaveBusy(true);
    setLeaveMsg(null);
    try {
      const res = await apiFetch<{ affectedAppointments: number }>(`/api/admin/doctors/${doctor.id}/leave`, {
        method: 'POST',
        body: JSON.stringify({ date: leaveDate, reason: leaveReason || undefined }),
      });
      setLeaveMsg(
        res.affectedAppointments > 0
          ? `Leave added. ${res.affectedAppointments} existing appointment(s) were cancelled and patients notified.`
          : 'Leave day added.'
      );
      setLeaveDate('');
      setLeaveReason('');
      loadLeave();
    } catch (e2) {
      setLeaveMsg(e2 instanceof ApiError ? e2.message : 'Could not add leave day');
    } finally {
      setLeaveBusy(false);
    }
  }

  async function removeLeave(date: string) {
    await apiFetch(`/api/admin/doctors/${doctor.id}/leave?date=${date}`, { method: 'DELETE' });
    loadLeave();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-semibold text-ink">Dr. {doctor.name}</h2>
          <p className="text-sm text-ink-muted">{doctor.email}</p>
          {error && <Alert kind="error">{error}</Alert>}
          {saveMsg && <Alert kind="success">{saveMsg}</Alert>}
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Specialisation</Label>
                <Input value={form.specialisation} onChange={(e) => setForm({ ...form, specialisation: e.target.value })} />
              </div>
              <div>
                <Label>Slot duration (minutes)</Label>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={form.slotDurationMinutes}
                  onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </div>
            <div>
              <Label>Working hours</Label>
              <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />
            </div>
            <Button type="submit" loading={saving}>
              Save changes
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <h2 className="font-semibold text-ink">Leave days</h2>
          <p className="text-sm text-ink-muted">
            Marking a date as leave automatically cancels any existing confirmed appointments on that date and emails
            the affected patients.
          </p>
          {leaveMsg && <Alert kind="info">{leaveMsg}</Alert>}
          <form onSubmit={addLeave} className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" required value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label>Reason (optional)</Label>
              <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} placeholder="Conference, personal leave…" />
            </div>
            <Button type="submit" loading={leaveBusy}>
              Add leave day
            </Button>
          </form>
          <div className="space-y-2">
            {leave?.length === 0 && <p className="text-sm text-ink-muted">No leave days scheduled.</p>}
            {leave?.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-ink">{l.leave_date}</p>
                  {l.reason && <p className="text-xs text-ink-muted">{l.reason}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeLeave(l.leave_date)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
