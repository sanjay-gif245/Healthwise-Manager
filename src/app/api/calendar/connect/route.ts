import { NextResponse } from 'next/server';
import { requireUser, isResponse, jsonError } from '@/lib/apiHelpers';
import { getAuthUrl, isCalendarConfigured } from '@/lib/googleCalendar';
import { createOAuthState } from '@/db/repositories/calendar';

export async function GET() {
  const session = await requireUser();
  if (isResponse(session)) return session;
  if (!isCalendarConfigured()) {
    return jsonError(
      'Google Calendar is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI missing). See README for setup steps.',
      501,
      'not_configured'
    );
  }
  const state = createOAuthState(session.sub);
  const url = getAuthUrl(state);
  return NextResponse.json({ url });
}
