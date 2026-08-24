import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { confirmBooking } from '@/lib/booking';

const schema = z.object({
  holdId: z.string().min(1),
  symptomText: z.string().min(3).max(4000),
});

export async function POST(req: Request) {
  const session = await requireUser(['patient']);
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || 'holdId and symptomText are required', 400, 'validation');
  }

  try {
    const appointment = await confirmBooking({
      holdId: parsed.data.holdId,
      patientId: session.sub,
      symptomText: parsed.data.symptomText,
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
