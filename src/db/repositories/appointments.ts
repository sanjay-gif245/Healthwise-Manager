import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { Appointment, AppointmentStatus, SummaryStatus, PostVisitStatus, UrgencyLevel } from '@/types/models';

export function insertConfirmedAppointment(input: {
  patient_id: string;
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  symptom_text: string;
}): Appointment {
  const id = newId('apt');
  const now = nowIso();
  // The partial UNIQUE INDEX uq_appointments_active_slot (doctor_id, slot_start)
  // WHERE status IN ('confirmed','completed') is the final, DB-enforced guard
  // against double-booking. If two requests somehow race past the slot-hold
  // check, this INSERT throws for the loser and the caller treats it as a
  // conflict rather than corrupting data.
  q(
    `INSERT INTO appointments
      (id, patient_id, doctor_id, slot_start, slot_end, status, symptom_text,
       pre_visit_summary_status, post_visit_summary_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'confirmed', ?, 'pending', 'not_submitted', ?, ?)`
  ).run(id, input.patient_id, input.doctor_id, input.slot_start, input.slot_end, input.symptom_text, now, now);
  return getAppointmentById(id)!;
}

export function getAppointmentById(id: string): Appointment | undefined {
  return q('SELECT * FROM appointments WHERE id = ?').get(id) as Appointment | undefined;
}

export function listAppointmentsForPatient(patientId: string): Appointment[] {
  return q('SELECT * FROM appointments WHERE patient_id = ? ORDER BY slot_start DESC').all(
    patientId
  ) as Appointment[];
}

export function listAppointmentsForDoctor(doctorId: string): Appointment[] {
  return q('SELECT * FROM appointments WHERE doctor_id = ? ORDER BY slot_start ASC').all(doctorId) as Appointment[];
}

export function listActiveAppointmentsForDoctorOnDate(doctorId: string, dateYmd: string): Appointment[] {
  return q(
    `SELECT * FROM appointments
     WHERE doctor_id = ? AND status IN ('confirmed','completed')
       AND slot_start >= ? AND slot_start < ?`
  ).all(doctorId, `${dateYmd}T00:00:00.000Z`, `${dateYmd}T23:59:59.999Z`) as Appointment[];
}

export function listActiveAppointmentsForDoctorInRange(
  doctorId: string,
  fromIso: string,
  toIso: string
): Appointment[] {
  return q(
    `SELECT * FROM appointments
     WHERE doctor_id = ? AND status IN ('confirmed','completed')
       AND slot_start >= ? AND slot_start < ?
     ORDER BY slot_start ASC`
  ).all(doctorId, fromIso, toIso) as Appointment[];
}

export function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extra?: { cancel_reason?: string | null; rescheduled_to_id?: string | null }
): void {
  q(
    `UPDATE appointments SET status = ?, cancel_reason = COALESCE(?, cancel_reason),
       rescheduled_to_id = COALESCE(?, rescheduled_to_id), updated_at = ?
     WHERE id = ?`
  ).run(status, extra?.cancel_reason ?? null, extra?.rescheduled_to_id ?? null, nowIso(), id);
}

export function setPreVisitSummary(
  id: string,
  data: {
    urgency_level: UrgencyLevel | null;
    chief_complaint: string | null;
    suggested_questions: string[] | null;
    status: SummaryStatus;
    error?: string | null;
  }
): void {
  q(
    `UPDATE appointments SET urgency_level = ?, chief_complaint = ?, suggested_questions = ?,
       pre_visit_summary_status = ?, pre_visit_summary_error = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    data.urgency_level,
    data.chief_complaint,
    data.suggested_questions ? JSON.stringify(data.suggested_questions) : null,
    data.status,
    data.error ?? null,
    nowIso(),
    id
  );
}

export function setDoctorNotesAndPrescription(
  id: string,
  data: { doctor_notes: string; prescription: unknown[] }
): void {
  q(
    `UPDATE appointments SET doctor_notes = ?, prescription = ?, post_visit_summary_status = 'pending', updated_at = ?
     WHERE id = ?`
  ).run(data.doctor_notes, JSON.stringify(data.prescription), nowIso(), id);
}

export function setPostVisitSummary(
  id: string,
  data: { status: PostVisitStatus; text: string | null; error?: string | null }
): void {
  q(
    `UPDATE appointments SET post_visit_summary_status = ?, post_visit_summary_text = ?,
       post_visit_summary_error = ?, updated_at = ?
     WHERE id = ?`
  ).run(data.status, data.text, data.error ?? null, nowIso(), id);
}

export function setCalendarEventIds(
  id: string,
  data: { patient_calendar_event_id?: string | null; doctor_calendar_event_id?: string | null }
): void {
  const existing = getAppointmentById(id);
  if (!existing) return;
  q(
    `UPDATE appointments SET patient_calendar_event_id = ?, doctor_calendar_event_id = ?, updated_at = ? WHERE id = ?`
  ).run(
    data.patient_calendar_event_id !== undefined ? data.patient_calendar_event_id : existing.patient_calendar_event_id,
    data.doctor_calendar_event_id !== undefined ? data.doctor_calendar_event_id : existing.doctor_calendar_event_id,
    nowIso(),
    id
  );
}

export function listUpcomingConfirmedForReminder(withinHoursFrom: number, withinHoursTo: number): Appointment[] {
  const from = new Date(Date.now() + withinHoursFrom * 3600_000).toISOString();
  const to = new Date(Date.now() + withinHoursTo * 3600_000).toISOString();
  return q(
    `SELECT * FROM appointments WHERE status = 'confirmed' AND slot_start >= ? AND slot_start < ?`
  ).all(from, to) as Appointment[];
}
