import { google } from 'googleapis';
import {
  getCalendarConnection,
  upsertCalendarConnection,
  deleteCalendarConnection,
} from '@/db/repositories/calendar';

// Google Calendar sync is entirely optional per-user: a patient or doctor
// who never connects their calendar simply never gets events created, and
// nothing else in the app depends on it. All functions below fail soft —
// they log and return null/false instead of throwing, so a Calendar API
// hiccup never breaks a booking/cancellation request.

function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function isCalendarConfigured(): boolean {
  return isConfigured();
}

export function getAuthUrl(state: string): string | null {
  if (!isConfigured()) return null;
  const client = oauthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  });
}

export async function handleOAuthCallback(userId: string, code: string): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) return false;
    upsertCalendarConnection({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
    });
    return true;
  } catch (err) {
    console.error('[google-calendar] OAuth callback failed', err);
    return false;
  }
}

async function clientForUser(userId: string) {
  const conn = getCalendarConnection(userId);
  if (!conn || !isConfigured()) return null;
  const client = oauthClient();
  client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token || undefined,
    expiry_date: conn.expiry_date || undefined,
  });
  client.on('tokens', (tokens) => {
    // Persist refreshed access tokens so future calls don't need a fresh OAuth dance.
    if (tokens.access_token) {
      upsertCalendarConnection({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || conn.refresh_token,
        expiry_date: tokens.expiry_date ?? null,
        scope: tokens.scope || conn.scope,
      });
    }
  });
  return client;
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
}

export async function createCalendarEvent(userId: string, input: CalendarEventInput): Promise<string | null> {
  try {
    const client = await clientForUser(userId);
    if (!client) return null;
    const calendar = google.calendar({ version: 'v3', auth: client });
    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error('[google-calendar] createCalendarEvent failed (continuing without calendar sync)', err);
    return null;
  }
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  input: CalendarEventInput
): Promise<boolean> {
  try {
    const client = await clientForUser(userId);
    if (!client) return false;
    const calendar = google.calendar({ version: 'v3', auth: client });
    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startIso },
        end: { dateTime: input.endIso },
      },
    });
    return true;
  } catch (err) {
    console.error('[google-calendar] updateCalendarEvent failed (continuing without calendar sync)', err);
    return false;
  }
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  try {
    const client = await clientForUser(userId);
    if (!client) return false;
    const calendar = google.calendar({ version: 'v3', auth: client });
    await calendar.events.delete({ calendarId: 'primary', eventId });
    return true;
  } catch (err) {
    console.error('[google-calendar] deleteCalendarEvent failed (continuing without calendar sync)', err);
    return false;
  }
}

export function disconnectCalendar(userId: string): void {
  deleteCalendarConnection(userId);
}

export function isUserCalendarConnected(userId: string): boolean {
  return !!getCalendarConnection(userId);
}
