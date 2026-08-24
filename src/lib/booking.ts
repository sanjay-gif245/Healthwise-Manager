import { withTransaction } from '@/db/db';
import { getDoctorProfileById, getDoctorWithUserById, isDoctorOnLeave } from '@/db/repositories/doctors';
import { tryAcquireHold, getHoldById, releaseHold } from '@/db/repositories/slotHolds';
import {
  insertConfirmedAppointment,
  getAppointmentById,
  setAppointmentStatus,
  setPreVisitSummary,
  setDoctorNotesAndPrescription,
  setPostVisitSummary,
  setCalendarEventIds,
  listActiveAppointmentsForDoctorOnDate,
} from '@/db/repositories/appointments';
import { getUserById } from '@/db/repositories/users';
import { addLeaveDay } from '@/db/repositories/doctors';
import { createMedicationReminder, deleteMedicationRemindersForAppointment } from '@/db/repositories/medications';
import { generatePreVisitSummary, generatePostVisitSummary } from './llm';
import { queueAndSend, tpl } from './notify';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, isUserCalendarConnected } from './googleCalendar';
import { formatInClinicTz } from './slots';
import type { Appointment, PrescriptionItem } from '@/types/models';

export class BookingError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function holdSlot(input: { doctorId: string; slotStart: string; slotEnd: string; patientId: string }) {
  const doctor = getDoctorProfileById(input.doctorId);
  if (!doctor) throw new BookingError('doctor_not_found', 'Doctor not found');

  const slotDate = input.slotStart.slice(0, 10);
  if (isDoctorOnLeave(doctor.id, slotDate)) {
    throw new BookingError('doctor_on_leave', 'Doctor is on leave on this date');
  }
  if (new Date(input.slotStart).getTime() <= Date.now()) {
    throw new BookingError('slot_in_past', 'Cannot book a slot in the past');
  }

  const hold = tryAcquireHold({
    doctor_id: input.doctorId,
    slot_start: input.slotStart,
    slot_end: input.slotEnd,
    patient_id: input.patientId,
  });
  if (!hold) {
    throw new BookingError('slot_unavailable', 'This slot is currently being booked by someone else. Please pick another slot.');
  }
  return hold;
}

/**
 * Convert an active hold into a confirmed appointment. The hold lookup,
 * ownership/expiry checks, appointment insert, and hold release all happen
 * inside a single SQLite transaction — either the whole thing lands, or
 * none of it does. The partial UNIQUE INDEX on appointments is the final
 * backstop in case of an exotic race.
 */
export async function confirmBooking(input: { holdId: string; patientId: string; symptomText: string }): Promise<Appointment> {
  let appointment: Appointment;
  try {
    appointment = withTransaction(() => {
      const hold = getHoldById(input.holdId);
      if (!hold) throw new BookingError('hold_expired', 'Your slot hold has expired. Please select a slot again.');
      if (hold.patient_id !== input.patientId) {
        throw new BookingError('forbidden', 'This hold does not belong to you.');
      }
      if (new Date(hold.expires_at).getTime() < Date.now()) {
        releaseHold(hold.id);
        throw new BookingError('hold_expired', 'Your slot hold has expired. Please select a slot again.');
      }

      const created = insertConfirmedAppointment({
        patient_id: input.patientId,
        doctor_id: hold.doctor_id,
        slot_start: hold.slot_start,
        slot_end: hold.slot_end,
        symptom_text: input.symptomText,
      });
      releaseHold(hold.id);
      return created;
    });
  } catch (err) {
    if (err instanceof BookingError) throw err;
    // Partial-unique-index violation: someone else confirmed this exact slot
    // in the tiny window between hold-acquire and confirm (extremely rare
    // given the hold, but the DB constraint is the real source of truth).
    throw new BookingError('slot_taken', 'This slot was just booked by someone else. Please pick another slot.');
  }

  // Side effects run best-effort and must never fail the booking itself.
  await runPreVisitSummary(appointment.id).catch((e) => console.error('[booking] pre-visit summary error', e));
  await sendBookingConfirmations(appointment.id).catch((e) => console.error('[booking] confirmation notify error', e));
  await syncCalendarOnBooking(appointment.id).catch((e) => console.error('[booking] calendar sync error', e));

  return getAppointmentById(appointment.id)!;
}

async function runPreVisitSummary(appointmentId: string): Promise<void> {
  const appt = getAppointmentById(appointmentId);
  if (!appt || !appt.symptom_text) return;
  const result = await generatePreVisitSummary(appt.symptom_text);
  setPreVisitSummary(appointmentId, {
    urgency_level: result.urgency_level,
    chief_complaint: result.chief_complaint,
    suggested_questions: result.suggested_questions,
    status: result.status,
    error: result.error,
  });
}

async function sendBookingConfirmations(appointmentId: string): Promise<void> {
  const appt = getAppointmentById(appointmentId);
  if (!appt) return;
  const doctor = getDoctorWithUserById(appt.doctor_id);
  const patient = getUserById(appt.patient_id);
  if (!doctor || !patient) return;
  const dateLabel = formatInClinicTz(appt.slot_start);

  await queueAndSend({
    appointment_id: appt.id,
    recipient_id: patient.id,
    type: 'booking_confirmation',
    ...tpl('booking_confirmation', {
      recipientName: patient.name,
      otherPartyName: doctor.name,
      doctorName: doctor.name,
      dateLabel,
      specialisation: doctor.specialisation,
      perspective: 'patient',
    }),
  });
  await queueAndSend({
    appointment_id: appt.id,
    recipient_id: doctor.user_id,
    type: 'booking_confirmation',
    ...tpl('booking_confirmation', {
      recipientName: doctor.name,
      otherPartyName: patient.name,
      doctorName: doctor.name,
      dateLabel,
      specialisation: doctor.specialisation,
      perspective: 'doctor',
    }),
  });
}

async function syncCalendarOnBooking(appointmentId: string): Promise<void> {
  const appt = getAppointmentById(appointmentId);
  if (!appt) return;
  const doctor = getDoctorWithUserById(appt.doctor_id);
  const patient = getUserById(appt.patient_id);
  if (!doctor || !patient) return;

  const summary = `Appointment: ${patient.name} with Dr. ${doctor.name}`;
  const description = `Specialisation: ${doctor.specialisation}\nBooked via Healthcare Appointment Manager.`;

  let patientEventId: string | null = null;
  let doctorEventId: string | null = null;

  if (isUserCalendarConnected(patient.id)) {
    patientEventId = await createCalendarEvent(patient.id, {
      summary,
      description,
      startIso: appt.slot_start,
      endIso: appt.slot_end,
    });
  }
  if (isUserCalendarConnected(doctor.user_id)) {
    doctorEventId = await createCalendarEvent(doctor.user_id, {
      summary,
      description,
      startIso: appt.slot_start,
      endIso: appt.slot_end,
    });
  }
  if (patientEventId || doctorEventId) {
    setCalendarEventIds(appointmentId, {
      patient_calendar_event_id: patientEventId,
      doctor_calendar_event_id: doctorEventId,
    });
  }
}

export async function cancelAppointment(appointmentId: string, reason: string, cancelledBy: 'patient' | 'doctor' | 'admin'): Promise<void> {
  const appt = getAppointmentById(appointmentId);
  if (!appt) throw new BookingError('not_found', 'Appointment not found');
  if (appt.status !== 'confirmed') throw new BookingError('invalid_state', 'Only confirmed appointments can be cancelled');

  setAppointmentStatus(appointmentId, 'cancelled', { cancel_reason: reason });
  deleteMedicationRemindersForAppointment(appointmentId);

  const doctor = getDoctorWithUserById(appt.doctor_id);
  const patient = getUserById(appt.patient_id);
  const dateLabel = formatInClinicTz(appt.slot_start);

  if (doctor && patient) {
    await queueAndSend({
      appointment_id: appt.id,
      recipient_id: patient.id,
      type: 'cancellation',
      ...tpl('cancellation', { recipientName: patient.name, dateLabel, reason, perspective: 'patient' }),
    });
    await queueAndSend({
      appointment_id: appt.id,
      recipient_id: doctor.user_id,
      type: 'cancellation',
      ...tpl('cancellation', { recipientName: doctor.name, dateLabel, reason, perspective: 'doctor' }),
    });

    if (appt.patient_calendar_event_id) {
      await deleteCalendarEvent(patient.id, appt.patient_calendar_event_id).catch(() => false);
    }
    if (appt.doctor_calendar_event_id) {
      await deleteCalendarEvent(doctor.user_id, appt.doctor_calendar_event_id).catch(() => false);
    }
  }
}

/**
 * Mark a doctor on leave for a date. Any confirmed appointments already on
 * that date are cancelled and both sides are notified (and calendar events
 * removed) so nobody shows up to a visit that can't happen.
 */
export async function markDoctorOnLeave(doctorId: string, date: string, reason: string | null): Promise<{ affected: number }> {
  addLeaveDay(doctorId, date, reason);
  const affected = listActiveAppointmentsForDoctorOnDate(doctorId, date);

  for (const appt of affected) {
    setAppointmentStatus(appt.id, 'cancelled', { cancel_reason: `Doctor on leave${reason ? `: ${reason}` : ''}` });
    deleteMedicationRemindersForAppointment(appt.id);

    const doctor = getDoctorWithUserById(appt.doctor_id);
    const patient = getUserById(appt.patient_id);
    if (!doctor || !patient) continue;
    const dateLabel = formatInClinicTz(appt.slot_start);

    await queueAndSend({
      appointment_id: appt.id,
      recipient_id: patient.id,
      type: 'leave_notice',
      ...tpl('leave_notice', { recipientName: patient.name, otherPartyName: doctor.name, dateLabel }),
    }).catch((e) => console.error('[leave] notify patient failed', e));

    if (appt.patient_calendar_event_id) {
      await deleteCalendarEvent(patient.id, appt.patient_calendar_event_id).catch(() => false);
    }
    if (appt.doctor_calendar_event_id) {
      await deleteCalendarEvent(doctor.user_id, appt.doctor_calendar_event_id).catch(() => false);
    }
  }

  return { affected: affected.length };
}

export async function submitPostVisit(
  appointmentId: string,
  notes: string,
  prescription: PrescriptionItem[]
): Promise<Appointment> {
  const appt = getAppointmentById(appointmentId);
  if (!appt) throw new BookingError('not_found', 'Appointment not found');

  setDoctorNotesAndPrescription(appointmentId, { doctor_notes: notes, prescription });
  setAppointmentStatus(appointmentId, 'completed');

  const result = await generatePostVisitSummary(notes, prescription);
  setPostVisitSummary(appointmentId, { status: result.status, text: result.summary_text, error: result.error });

  deleteMedicationRemindersForAppointment(appointmentId);
  const today = new Date().toISOString().slice(0, 10);
  for (const item of prescription) {
    if (!item.drug || item.frequency_per_day <= 0) continue;
    const times = defaultReminderTimes(item.frequency_per_day);
    createMedicationReminder({
      appointment_id: appointmentId,
      patient_id: appt.patient_id,
      drug_name: item.drug,
      dosage: item.dosage,
      frequency_per_day: item.frequency_per_day,
      duration_days: item.duration_days,
      start_date: today,
      reminder_times: times,
    });
  }

  const patient = getUserById(appt.patient_id);
  const doctor = getDoctorWithUserById(appt.doctor_id);
  if (patient && doctor) {
    await queueAndSend({
      appointment_id: appt.id,
      recipient_id: patient.id,
      type: 'post_visit_summary_ready',
      ...tpl('post_visit_summary_ready', { recipientName: patient.name, otherPartyName: doctor.name }),
    }).catch((e) => console.error('[post-visit] notify failed', e));
  }

  return getAppointmentById(appointmentId)!;
}

function defaultReminderTimes(frequencyPerDay: number): string[] {
  const presets: Record<number, string[]> = {
    1: ['09:00'],
    2: ['09:00', '21:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
  };
  return presets[frequencyPerDay] || Array.from({ length: frequencyPerDay }, (_, i) => `${(8 + i * 4) % 24}`.padStart(2, '0') + ':00');
}
