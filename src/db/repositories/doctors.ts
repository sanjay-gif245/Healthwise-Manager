import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { DoctorProfile, DoctorProfileWithUser, DoctorLeaveDay, WorkingHours } from '@/types/models';

export function createDoctorProfile(input: {
  user_id: string;
  specialisation: string;
  bio?: string | null;
  slot_duration_minutes: number;
  working_hours: WorkingHours;
}): DoctorProfile {
  const id = newId('doc');
  q(
    `INSERT INTO doctor_profiles (id, user_id, specialisation, bio, slot_duration_minutes, working_hours, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.user_id,
    input.specialisation,
    input.bio ?? null,
    input.slot_duration_minutes,
    JSON.stringify(input.working_hours),
    nowIso()
  );
  return getDoctorProfileById(id)!;
}

export function updateDoctorProfile(
  id: string,
  input: Partial<{
    specialisation: string;
    bio: string | null;
    slot_duration_minutes: number;
    working_hours: WorkingHours;
  }>
): DoctorProfile | undefined {
  const existing = getDoctorProfileById(id);
  if (!existing) return undefined;
  const specialisation = input.specialisation ?? existing.specialisation;
  const bio = input.bio !== undefined ? input.bio : existing.bio;
  const slot_duration_minutes = input.slot_duration_minutes ?? existing.slot_duration_minutes;
  const working_hours = input.working_hours ? JSON.stringify(input.working_hours) : existing.working_hours;
  q(
    `UPDATE doctor_profiles SET specialisation = ?, bio = ?, slot_duration_minutes = ?, working_hours = ? WHERE id = ?`
  ).run(specialisation, bio, slot_duration_minutes, working_hours, id);
  return getDoctorProfileById(id);
}

export function getDoctorProfileById(id: string): DoctorProfile | undefined {
  return q('SELECT * FROM doctor_profiles WHERE id = ?').get(id) as DoctorProfile | undefined;
}

export function getDoctorProfileByUserId(userId: string): DoctorProfile | undefined {
  return q('SELECT * FROM doctor_profiles WHERE user_id = ?').get(userId) as DoctorProfile | undefined;
}

export function listDoctorsWithUser(specialisation?: string): DoctorProfileWithUser[] {
  if (specialisation && specialisation.trim()) {
    return q(
      `SELECT dp.*, u.name as name, u.email as email, u.phone as phone
       FROM doctor_profiles dp JOIN users u ON u.id = dp.user_id
       WHERE dp.specialisation LIKE ?
       ORDER BY u.name ASC`
    ).all(`%${specialisation.trim()}%`) as DoctorProfileWithUser[];
  }
  return q(
    `SELECT dp.*, u.name as name, u.email as email, u.phone as phone
     FROM doctor_profiles dp JOIN users u ON u.id = dp.user_id
     ORDER BY u.name ASC`
  ).all() as DoctorProfileWithUser[];
}

export function listSpecialisations(): string[] {
  const rows = q('SELECT DISTINCT specialisation FROM doctor_profiles ORDER BY specialisation ASC').all() as {
    specialisation: string;
  }[];
  return rows.map((r) => r.specialisation);
}

export function getDoctorWithUserById(id: string): DoctorProfileWithUser | undefined {
  return q(
    `SELECT dp.*, u.name as name, u.email as email, u.phone as phone
     FROM doctor_profiles dp JOIN users u ON u.id = dp.user_id
     WHERE dp.id = ?`
  ).get(id) as DoctorProfileWithUser | undefined;
}

// --- Leave days ---

export function addLeaveDay(doctorId: string, date: string, reason?: string | null): DoctorLeaveDay {
  const id = newId('leave');
  q(
    `INSERT INTO doctor_leave_days (id, doctor_id, leave_date, reason, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(doctor_id, leave_date) DO UPDATE SET reason = excluded.reason`
  ).run(id, doctorId, date, reason ?? null, nowIso());
  return q('SELECT * FROM doctor_leave_days WHERE doctor_id = ? AND leave_date = ?').get(
    doctorId,
    date
  ) as DoctorLeaveDay;
}

export function removeLeaveDay(doctorId: string, date: string): void {
  q('DELETE FROM doctor_leave_days WHERE doctor_id = ? AND leave_date = ?').run(doctorId, date);
}

export function listLeaveDays(doctorId: string): DoctorLeaveDay[] {
  return q('SELECT * FROM doctor_leave_days WHERE doctor_id = ? ORDER BY leave_date ASC').all(
    doctorId
  ) as DoctorLeaveDay[];
}

export function isDoctorOnLeave(doctorId: string, date: string): boolean {
  const row = q('SELECT 1 as x FROM doctor_leave_days WHERE doctor_id = ? AND leave_date = ?').get(
    doctorId,
    date
  );
  return !!row;
}
