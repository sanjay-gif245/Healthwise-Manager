import { NextResponse } from 'next/server';
import { getSessionUser, type SessionPayload } from './auth';
import type { Role } from '@/types/models';
import { BookingError } from './booking';

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function requireUser(roles?: Role[]): Promise<SessionPayload | NextResponse> {
  const user = await getSessionUser();
  if (!user) return jsonError('Not authenticated', 401, 'unauthenticated');
  if (roles && !roles.includes(user.role)) return jsonError('Not authorized', 403, 'forbidden');
  return user;
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export function handleApiError(err: unknown) {
  if (err instanceof BookingError) {
    const status = { doctor_not_found: 404, not_found: 404, forbidden: 403 }[err.code] || 409;
    return jsonError(err.message, status, err.code);
  }
  console.error('[api] unhandled error', err);
  return jsonError('Something went wrong. Please try again.', 500, 'internal_error');
}
