import { NextResponse } from 'next/server';
import { requireUser, isResponse } from '@/lib/apiHelpers';
import { listRemindersForPatient } from '@/db/repositories/medications';

export async function GET() {
  const session = await requireUser(['patient']);
  if (isResponse(session)) return session;
  const reminders = listRemindersForPatient(session.sub).map((r) => ({
    ...r,
    reminder_times: JSON.parse(r.reminder_times),
  }));
  return NextResponse.json({ reminders });
}
