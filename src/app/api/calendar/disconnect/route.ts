import { NextResponse } from 'next/server';
import { requireUser, isResponse } from '@/lib/apiHelpers';
import { disconnectCalendar } from '@/lib/googleCalendar';

export async function POST() {
  const session = await requireUser();
  if (isResponse(session)) return session;
  disconnectCalendar(session.sub);
  return NextResponse.json({ ok: true });
}
