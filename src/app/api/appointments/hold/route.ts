import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { holdSlot } from '@/lib/booking';
import { HOLD_TTL_SECONDS } from '@/db/repositories/slotHolds';

const schema = z.object({
  doctorId: z.string().min(1),
  slotStart: z.string().min(1),
  slotEnd: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await requireUser(['patient']);
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('doctorId, slotStart, slotEnd are required', 400, 'validation');

  try {
    const hold = holdSlot({
      doctorId: parsed.data.doctorId,
      slotStart: parsed.data.slotStart,
      slotEnd: parsed.data.slotEnd,
      patientId: session.sub,
    });
    return NextResponse.json({ hold, ttlSeconds: HOLD_TTL_SECONDS }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
