import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { NotificationRow, NotificationType } from '@/types/models';

export function createNotification(input: {
  appointment_id?: string | null;
  recipient_id: string;
  type: NotificationType;
  subject: string;
  body: string;
}): NotificationRow {
  const id = newId('ntf');
  q(
    `INSERT INTO notifications (id, appointment_id, recipient_id, type, channel, subject, body, status, attempts, created_at)
     VALUES (?, ?, ?, ?, 'email', ?, ?, 'pending', 0, ?)`
  ).run(id, input.appointment_id ?? null, input.recipient_id, input.type, input.subject, input.body, nowIso());
  return q('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRow;
}

export function markNotificationSent(id: string): void {
  q(`UPDATE notifications SET status = 'sent', sent_at = ?, attempts = attempts + 1 WHERE id = ?`).run(nowIso(), id);
}

const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 240]; // exponential-ish backoff, caps at 4h
const MAX_ATTEMPTS = RETRY_BACKOFF_MINUTES.length;

export function markNotificationFailed(id: string, error: string): void {
  const row = q('SELECT attempts FROM notifications WHERE id = ?').get(id) as { attempts: number } | undefined;
  const attempts = (row?.attempts ?? 0) + 1;
  const isFinal = attempts >= MAX_ATTEMPTS;
  const backoffMin = RETRY_BACKOFF_MINUTES[Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  const nextRetry = isFinal ? null : new Date(Date.now() + backoffMin * 60_000).toISOString();
  q(
    `UPDATE notifications SET status = ?, attempts = ?, last_error = ?, next_retry_at = ? WHERE id = ?`
  ).run(isFinal ? 'failed' : 'pending', attempts, error.slice(0, 2000), nextRetry, id);
}

export function listDueNotifications(limit = 25): NotificationRow[] {
  return q(
    `SELECT * FROM notifications
     WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC LIMIT ?`
  ).all(nowIso(), limit) as NotificationRow[];
}

export function listNotificationsForAppointment(appointmentId: string): NotificationRow[] {
  return q('SELECT * FROM notifications WHERE appointment_id = ? ORDER BY created_at DESC').all(
    appointmentId
  ) as NotificationRow[];
}

export function listNotificationsForUser(userId: string, limit = 50): NotificationRow[] {
  return q('SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ?').all(
    userId,
    limit
  ) as NotificationRow[];
}

/** Used to dedupe recurring sweeps (e.g. don't send the 24h reminder twice). */
export function hasNotificationOfType(appointmentId: string, recipientId: string, type: NotificationType): boolean {
  const row = q(
    `SELECT 1 as x FROM notifications WHERE appointment_id = ? AND recipient_id = ? AND type = ? LIMIT 1`
  ).get(appointmentId, recipientId, type);
  return !!row;
}

export function listFailedNotifications(limit = 100): NotificationRow[] {
  return q(`SELECT * FROM notifications WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?`).all(
    limit
  ) as NotificationRow[];
}
