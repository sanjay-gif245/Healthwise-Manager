import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { addMinutes, isBefore } from 'date-fns';
import type { DoctorProfile, WorkingHours } from '@/types/models';
import { isDoctorOnLeave } from '@/db/repositories/doctors';
import { listActiveAppointmentsForDoctorOnDate } from '@/db/repositories/appointments';
import { listActiveHoldsForDoctorOnDate } from '@/db/repositories/slotHolds';

export const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || 'Asia/Kolkata';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface SlotCandidate {
  start: string; // ISO UTC
  end: string; // ISO UTC
  localLabel: string; // e.g. "09:00 AM"
  status: 'available' | 'booked' | 'held';
}

/**
 * Compute the candidate appointment slots for a doctor on a given local
 * clinic date (YYYY-MM-DD), marking each as available / booked / held.
 * "Booked" comes from confirmed/completed appointments; "held" comes from
 * an active (unexpired) slot_hold placed by another patient mid-booking.
 */
export function getSlotsForDate(doctor: DoctorProfile, dateYmd: string): SlotCandidate[] {
  if (isDoctorOnLeave(doctor.id, dateYmd)) return [];

  const workingHours = JSON.parse(doctor.working_hours || '{}') as WorkingHours;
  // Determine weekday in the clinic's local timezone, not the server's.
  const noonUtc = fromZonedTime(`${dateYmd}T12:00:00`, CLINIC_TIMEZONE);
  const weekday = WEEKDAY_KEYS[noonUtc.getUTCDay()];
  const hours = workingHours[weekday];
  if (!hours) return [];

  const dayStartLocal = fromZonedTime(`${dateYmd}T${hours.start}:00`, CLINIC_TIMEZONE);
  const dayEndLocal = fromZonedTime(`${dateYmd}T${hours.end}:00`, CLINIC_TIMEZONE);
  const duration = doctor.slot_duration_minutes;

  const candidates: { start: Date; end: Date }[] = [];
  let cursor = dayStartLocal;
  while (isBefore(cursor, dayEndLocal)) {
    const end = addMinutes(cursor, duration);
    if (end > dayEndLocal) break;
    candidates.push({ start: cursor, end });
    cursor = end;
  }

  const booked = new Set(listActiveAppointmentsForDoctorOnDate(doctor.id, dateYmd).map((a) => a.slot_start));
  const held = new Set(listActiveHoldsForDoctorOnDate(doctor.id, dateYmd).map((h) => h.slot_start));

  const now = new Date();

  return candidates
    .filter((c) => c.start > now) // don't offer slots in the past
    .map((c) => {
      const startIso = c.start.toISOString();
      const status: SlotCandidate['status'] = booked.has(startIso) ? 'booked' : held.has(startIso) ? 'held' : 'available';
      return {
        start: startIso,
        end: c.end.toISOString(),
        localLabel: format(toZonedTime(c.start, CLINIC_TIMEZONE), 'h:mm a', { timeZone: CLINIC_TIMEZONE }),
        status,
      };
    });
}

export function formatInClinicTz(iso: string, fmt = 'EEE, MMM d yyyy, h:mm a'): string {
  return format(toZonedTime(new Date(iso), CLINIC_TIMEZONE), fmt, { timeZone: CLINIC_TIMEZONE });
}
