import { sendMail } from './mailer';
import { createNotification, markNotificationFailed, markNotificationSent, listDueNotifications } from '@/db/repositories/notifications';
import { getUserById } from '@/db/repositories/users';
import type { NotificationType } from '@/types/models';

interface QueueInput {
  appointment_id?: string | null;
  recipient_id: string;
  type: NotificationType;
  subject: string;
  body: string;
}

/**
 * Create a notification row, then make a best-effort immediate send attempt.
 * If the immediate attempt fails, the row is left in a retryable state
 * (status stays 'pending' with a next_retry_at) and the background worker's
 * retry sweep will pick it up — the caller (an API route) never has to wait
 * on retries or fail the user-facing request because email delivery is slow
 * or down.
 */
export async function queueAndSend(input: QueueInput): Promise<void> {
  const notification = createNotification(input);
  const recipient = getUserById(input.recipient_id);
  if (!recipient) {
    markNotificationFailed(notification.id, 'Recipient user not found');
    return;
  }
  try {
    await sendMail({ to: recipient.email, subject: input.subject, text: input.body });
    markNotificationSent(notification.id);
  } catch (err) {
    markNotificationFailed(notification.id, err instanceof Error ? err.message : String(err));
  }
}

/** Retry sweep: called by the background worker on an interval. */
export async function retryDueNotifications(): Promise<{ attempted: number; sent: number; failed: number }> {
  const due = listDueNotifications(50);
  let sent = 0;
  let failed = 0;
  for (const n of due) {
    const recipient = getUserById(n.recipient_id);
    if (!recipient) {
      markNotificationFailed(n.id, 'Recipient user not found');
      failed++;
      continue;
    }
    try {
      await sendMail({ to: recipient.email, subject: n.subject, text: n.body });
      markNotificationSent(n.id);
      sent++;
    } catch (err) {
      markNotificationFailed(n.id, err instanceof Error ? err.message : String(err));
      failed++;
    }
  }
  return { attempted: due.length, sent, failed };
}

// --- Email templates -----------------------------------------------------

export function tpl(type: NotificationType, ctx: Record<string, string>): { subject: string; body: string } {
  switch (type) {
    case 'booking_confirmation':
      return {
        subject: `Appointment confirmed: Dr. ${ctx.doctorName} on ${ctx.dateLabel}`,
        body:
          `Hi ${ctx.recipientName},\n\n` +
          `Your appointment ${ctx.perspective === 'doctor' ? 'with patient ' + ctx.otherPartyName : 'with Dr. ' + ctx.otherPartyName} ` +
          `is confirmed for ${ctx.dateLabel}.\n\n` +
          `Specialisation: ${ctx.specialisation}\n` +
          `${ctx.perspective === 'patient' ? 'If you need to cancel or reschedule, please do so from your dashboard.' : 'Please review the pre-visit summary before the appointment.'}\n\n` +
          `— Healthcare Clinic`,
      };
    case 'reminder_24h':
      return {
        subject: `Reminder: appointment tomorrow with ${ctx.otherPartyName}`,
        body:
          `Hi ${ctx.recipientName},\n\nThis is a reminder that you have an appointment ` +
          `${ctx.perspective === 'patient' ? 'with Dr. ' + ctx.otherPartyName : 'with patient ' + ctx.otherPartyName} ` +
          `on ${ctx.dateLabel}.\n\n— Healthcare Clinic`,
      };
    case 'cancellation':
      return {
        subject: `Appointment cancelled: ${ctx.dateLabel}`,
        body:
          `Hi ${ctx.recipientName},\n\nYour appointment on ${ctx.dateLabel} has been cancelled.` +
          `${ctx.reason ? ` Reason: ${ctx.reason}` : ''}\n\n` +
          `${ctx.perspective === 'patient' ? 'Please book a new slot at your convenience.' : ''}\n\n— Healthcare Clinic`,
      };
    case 'reschedule':
      return {
        subject: `Appointment rescheduled to ${ctx.dateLabel}`,
        body: `Hi ${ctx.recipientName},\n\nYour appointment has been rescheduled to ${ctx.dateLabel}.\n\n— Healthcare Clinic`,
      };
    case 'leave_notice':
      return {
        subject: `Your appointment on ${ctx.dateLabel} needs to be rescheduled`,
        body:
          `Hi ${ctx.recipientName},\n\nDr. ${ctx.otherPartyName} is unavailable on ${ctx.dateLabel} due to leave, ` +
          `so your appointment has been cancelled. We're sorry for the inconvenience — please book a new slot ` +
          `from your dashboard at a time that works for you.\n\n— Healthcare Clinic`,
      };
    case 'medication_reminder':
      return {
        subject: `Medication reminder: ${ctx.drugName}`,
        body: `Hi ${ctx.recipientName},\n\nThis is a reminder to take your medication: ${ctx.drugName}${ctx.dosage ? ` (${ctx.dosage})` : ''}.\n\n— Healthcare Clinic`,
      };
    case 'post_visit_summary_ready':
      return {
        subject: `Your visit summary is ready`,
        body: `Hi ${ctx.recipientName},\n\nYour patient-friendly summary from your recent visit with Dr. ${ctx.otherPartyName} is ready. Log in to your dashboard to view it.\n\n— Healthcare Clinic`,
      };
    default:
      return { subject: 'Notification', body: 'You have a new notification.' };
  }
}
