import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError } from '@/lib/apiHelpers';
import { getDoctorProfileById, updateDoctorProfile } from '@/db/repositories/doctors';

const dayHours = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) });
const schema = z.object({
  specialisation: z.string().min(2).max(120).optional(),
  bio: z.string().max(2000).nullable().optional(),
  slotDurationMinutes: z.number().int().min(5).max(240).optional(),
  workingHours: z.record(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), dayHours).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400, 'validation');

  const existing = getDoctorProfileById(params.id);
  if (!existing) return jsonError('Doctor not found', 404, 'not_found');

  const updated = updateDoctorProfile(params.id, {
    specialisation: parsed.data.specialisation,
    bio: parsed.data.bio,
    slot_duration_minutes: parsed.data.slotDurationMinutes,
    working_hours: parsed.data.workingHours,
  });
  return NextResponse.json({ doctor: updated });
}
