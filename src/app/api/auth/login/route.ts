import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, toPublicUser } from '@/db/repositories/users';
import { verifyPassword, createSessionToken, sessionCookieName, sessionMaxAgeSeconds } from '@/lib/auth';
import { jsonError } from '@/lib/apiHelpers';

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('Email and password are required', 400, 'validation');

  const user = getUserByEmail(parsed.data.email);
  if (!user) return jsonError('Invalid email or password', 401, 'invalid_credentials');

  const ok = await verifyPassword(parsed.data.password, user.password_hash);
  if (!ok) return jsonError('Invalid email or password', 401, 'invalid_credentials');

  const token = await createSessionToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const res = NextResponse.json({ user: toPublicUser(user) });
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds(),
  });
  return res;
}
