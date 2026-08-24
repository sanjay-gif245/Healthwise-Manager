import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getUserById, toPublicUser } from '@/db/repositories/users';

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ user: null });
  const user = getUserById(session.sub);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: toPublicUser(user) });
}
