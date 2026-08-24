// The actual work performed by the background job. Deliberately framework
// agnostic (no Next.js imports) so the exact same functions can be driven by
// either:
//   - an in-process node-cron scheduler (src/worker/index.ts) when the app
//     runs on a persistent server (Render, Railway, a VM, `next start`), or
//   - an HTTP endpoint (/api/worker/tick) that an external scheduler (e.g.
//     Vercel Cron, GitHub Actions, cron-job.org) hits periodically when the
//     app runs on a serverless platform with no long-lived process.
//
// See the "Notification failure handling" section of the system design
// write-up for the reasoning behind the retry/backoff approach.

import { retryDueNotifications, queueAndSend, tpl } from './notify';
import { hasNotificationOfType } from '@/db/repositories/notifications';
import { listActiveReminders, markReminderSentToday } from '@/db/repositories/medications';
import { getUserById } from '@/db/repositories/users';
import { addDays } from 'date-fns';
import { purgeExpiredHolds } from '@/db/repositories/slotHolds';
import { listUpcomingConfirmedForReminder } from '@/db/repositories/appointments';
import { getDoctorWithUserById } from '@/db/repositories/doctors';
import { formatInClinicTz } from './slots';

export async function runNotificationRetrySweep() {
  return retryDueNotifications();
}

export function runHoldCleanupSweep() {
  return { purged: purgeExpiredHolds() };
}

/**
 * Fan out one `medication_reminder` notification per (reminder, time-of-day)
 * that is due right now, for every active prescription whose course hasn't
 * ended. Guards against re-sending the same day's batch twice via
 * `last_sent_date`, and against reminding after the course has finished via
 * `duration_days`.
 */
export async function runMedicationReminderSweep() {
  const reminders = listActiveReminders();
  const today = new Date();
  const todayYmd = today.toISOString().slice(0, 10);
  const nowHHMM = today.toISOString().slice(11, 16);

  let sent = 0;
  for (const r of reminders) {
    const start = new Date(r.start_date + 'T00:00:00Z');
    const courseEnd = addDays(start, r.duration_days);
    if (today > courseEnd) continue; // course finished, leave inactive (not auto-deactivated to preserve history)
    if (r.last_sent_date === todayYmd) continue; // already handled today's batch

    const times: string[] = JSON.parse(r.reminder_times);
    // Fire once we're past the *first* configured time for the day, so a
    // sweep that runs e.g. every 15 minutes still catches each patient's
    // schedule without needing per-minute precision.
    const earliestTime = times.slice().sort()[0];
    if (nowHHMM < earliestTime) continue;

    const patient = getUserById(r.patient_id);
    if (!patient) continue;

    await queueAndSend({
      recipient_id: r.patient_id,
      type: 'medication_reminder',
      ...tpl('medication_reminder', { recipientName: patient.name, drugName: r.drug_name, dosage: r.dosage || '' }),
    });
    markReminderSentToday(r.id, todayYmd);
    sent++;
  }
  return { checked: reminders.length, sent };
}

/** Send a single 24h-ahead reminder per confirmed appointment. */
export async function run24hAppointmentReminderSweep() {
  const upcoming = listUpcomingConfirmedForReminder(23.5, 24.5);
  let sent = 0;
  for (const appt of upcoming) {
    const doctor = getDoctorWithUserById(appt.doctor_id);
    const patient = getUserById(appt.patient_id);
    if (!doctor || !patient) continue;
    const dateLabel = formatInClinicTz(appt.slot_start);

    if (!hasNotificationOfType(appt.id, patient.id, 'reminder_24h')) {
      await queueAndSend({
        appointment_id: appt.id,
        recipient_id: patient.id,
        type: 'reminder_24h',
        ...tpl('reminder_24h', { recipientName: patient.name, otherPartyName: doctor.name, dateLabel, perspective: 'patient' }),
      });
      sent++;
    }
    if (!hasNotificationOfType(appt.id, doctor.user_id, 'reminder_24h')) {
      await queueAndSend({
        appointment_id: appt.id,
        recipient_id: doctor.user_id,
        type: 'reminder_24h',
        ...tpl('reminder_24h', { recipientName: doctor.name, otherPartyName: patient.name, dateLabel, perspective: 'doctor' }),
      });
      sent++;
    }
  }
  return { candidates: upcoming.length, sent };
}

export async function runFullSweep() {
  const notifications = await runNotificationRetrySweep();
  const medications = await runMedicationReminderSweep();
  const reminders24h = await run24hAppointmentReminderSweep();
  const holds = runHoldCleanupSweep();
  return { notifications, medications, reminders24h, holds };
}
