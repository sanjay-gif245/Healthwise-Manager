import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { MedicationReminder } from '@/types/models';

export function createMedicationReminder(input: {
  appointment_id: string;
  patient_id: string;
  drug_name: string;
  dosage?: string | null;
  frequency_per_day: number;
  duration_days: number;
  start_date: string;
  reminder_times: string[];
}): MedicationReminder {
  const id = newId('med');
  q(
    `INSERT INTO medication_reminders
      (id, appointment_id, patient_id, drug_name, dosage, frequency_per_day, duration_days, start_date, reminder_times, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id,
    input.appointment_id,
    input.patient_id,
    input.drug_name,
    input.dosage ?? null,
    input.frequency_per_day,
    input.duration_days,
    input.start_date,
    JSON.stringify(input.reminder_times),
    nowIso()
  );
  return q('SELECT * FROM medication_reminders WHERE id = ?').get(id) as MedicationReminder;
}

export function deleteMedicationRemindersForAppointment(appointmentId: string): void {
  q('DELETE FROM medication_reminders WHERE appointment_id = ?').run(appointmentId);
}

export function listActiveReminders(): MedicationReminder[] {
  return q('SELECT * FROM medication_reminders WHERE active = 1').all() as MedicationReminder[];
}

export function listRemindersForPatient(patientId: string): MedicationReminder[] {
  return q('SELECT * FROM medication_reminders WHERE patient_id = ? ORDER BY created_at DESC').all(
    patientId
  ) as MedicationReminder[];
}

export function markReminderSentToday(id: string, dateYmd: string): void {
  q('UPDATE medication_reminders SET last_sent_date = ? WHERE id = ?').run(dateYmd, id);
}

export function deactivateReminder(id: string): void {
  q('UPDATE medication_reminders SET active = 0 WHERE id = ?').run(id);
}
