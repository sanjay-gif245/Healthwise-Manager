import { NextResponse } from 'next/server';
import { requireUser, isResponse } from '@/lib/apiHelpers';
import { isUserCalendarConnected, isCalendarConfigured } from '@/lib/googleCalendar';

export async function GET() {
  const session = await requireUser();
  if (isResponse(session)) return session;
  return NextResponse.json({
    configured: isCalendarConfigured(),
    connected: isUserCalendarConnected(session.sub),
  });
}
