import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail, createUser, toPublicUser } from '@/db/repositories/users';
import { hashPassword, createSessionToken, sessionCookieName, sessionMaxAgeSeconds } from '@/lib/auth';
import { jsonError } from '@/lib/apiHelpers';

// Public self-registration is only offered for the "patient" role.
// Doctor accounts are provisioned by an admin (see /api/admin/doctors),
// and there is exactly one admin, seeded ahead of time — this mirrors how a
// real clinic onboards staff vs. patients.
const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  phone: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400, 'validation');
  }
  const { name, email, password, phone } = parsed.data;

  if (getUserByEmail(email)) {
    return jsonError('An account with this email already exists', 409, 'email_taken');
  }

  const password_hash = await hashPassword(password);
  const user = createUser({ role: 'patient', email, password_hash, name, phone: phone ?? null });

  const token = await createSessionToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  const res = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  res.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds(),
  });
  return res;
}
