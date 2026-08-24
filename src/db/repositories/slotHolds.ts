import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { SlotHold } from '@/types/models';

export const HOLD_TTL_SECONDS = 5 * 60; // 5 minutes to fill the symptom form + confirm

export function purgeExpiredHolds(): number {
  const res = q('DELETE FROM slot_holds WHERE expires_at < ?').run(nowIso());
  return Number(res.changes);
}

export function getActiveHold(doctorId: string, slotStart: string): SlotHold | undefined {
  purgeExpiredHolds();
  return q('SELECT * FROM slot_holds WHERE doctor_id = ? AND slot_start = ?').get(
    doctorId,
    slotStart
  ) as SlotHold | undefined;
}

/**
 * Attempt to place a hold on (doctorId, slotStart). Returns the hold on
 * success, or `null` if another hold is already active for that exact slot
 * (i.e. someone else is mid-booking it right now). Relies on the UNIQUE
 * (doctor_id, slot_start) index in slot_holds — this INSERT is what makes
 * concurrent booking attempts safe even under a race, since SQLite resolves
 * the UNIQUE conflict atomically.
 */
export function tryAcquireHold(input: {
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  patient_id: string;
}): SlotHold | null {
  purgeExpiredHolds();
  const id = newId('hold');
  const expires_at = new Date(Date.now() + HOLD_TTL_SECONDS * 1000).toISOString();
  try {
    q(
      `INSERT INTO slot_holds (id, doctor_id, slot_start, slot_end, patient_id, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.doctor_id, input.slot_start, input.slot_end, input.patient_id, expires_at, nowIso());
  } catch (err) {
    // UNIQUE constraint violation -> slot is currently held by someone else.
    return null;
  }
  return q('SELECT * FROM slot_holds WHERE id = ?').get(id) as SlotHold;
}

export function getHoldById(id: string): SlotHold | undefined {
  return q('SELECT * FROM slot_holds WHERE id = ?').get(id) as SlotHold | undefined;
}

export function releaseHold(id: string): void {
  q('DELETE FROM slot_holds WHERE id = ?').run(id);
}

export function releaseHoldForSlot(doctorId: string, slotStart: string, patientId: string): void {
  q('DELETE FROM slot_holds WHERE doctor_id = ? AND slot_start = ? AND patient_id = ?').run(
    doctorId,
    slotStart,
    patientId
  );
}

export function listActiveHoldsForDoctorOnDate(doctorId: string, dateYmd: string): SlotHold[] {
  purgeExpiredHolds();
  return q(
    `SELECT * FROM slot_holds WHERE doctor_id = ? AND slot_start >= ? AND slot_start < ?`
  ).all(doctorId, `${dateYmd}T00:00:00.000Z`, `${dateYmd}T23:59:59.999Z`) as SlotHold[];
}
