import { NextResponse } from 'next/server';
import { requireUser, isResponse } from '@/lib/apiHelpers';
import { db } from '@/db/db';
import type { NotificationRow } from '@/types/models';

export async function GET(req: Request) {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status'); // pending | sent | failed

  const rows = (
    status
      ? db.prepare('SELECT * FROM notifications WHERE status = ? ORDER BY created_at DESC LIMIT 200').all(status)
      : db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200').all()
  ) as NotificationRow[];

  const counts = db
    .prepare('SELECT status, COUNT(*) as count FROM notifications GROUP BY status')
    .all() as { status: string; count: number }[];

  return NextResponse.json({ notifications: rows, counts });
}
