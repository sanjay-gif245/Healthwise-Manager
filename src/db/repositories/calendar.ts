import { q } from '../statementCache';
import { newId } from '@/lib/id';
import { nowIso } from '../db';
import type { CalendarConnection } from '@/types/models';

export function upsertCalendarConnection(input: {
  user_id: string;
  access_token: string;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
}): CalendarConnection {
  q(
    `INSERT INTO calendar_connections (user_id, access_token, refresh_token, expiry_date, scope, connected_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       access_token = excluded.access_token,
       refresh_token = COALESCE(excluded.refresh_token, calendar_connections.refresh_token),
       expiry_date = excluded.expiry_date,
       scope = excluded.scope`
  ).run(
    input.user_id,
    input.access_token,
    input.refresh_token ?? null,
    input.expiry_date ?? null,
    input.scope ?? null,
    nowIso()
  );
  return getCalendarConnection(input.user_id)!;
}

export function getCalendarConnection(userId: string): CalendarConnection | undefined {
  return q('SELECT * FROM calendar_connections WHERE user_id = ?').get(userId) as
    | CalendarConnection
    | undefined;
}

export function deleteCalendarConnection(userId: string): void {
  q('DELETE FROM calendar_connections WHERE user_id = ?').run(userId);
}

export function createOAuthState(userId: string): string {
  const state = newId('state');
  q('INSERT INTO oauth_states (state, user_id, created_at) VALUES (?, ?, ?)').run(state, userId, nowIso());
  return state;
}

export function consumeOAuthState(state: string): string | undefined {
  const row = q('SELECT user_id FROM oauth_states WHERE state = ?').get(state) as
    | { user_id: string }
    | undefined;
  if (row) {
    q('DELETE FROM oauth_states WHERE state = ?').run(state);
  }
  return row?.user_id;
}
