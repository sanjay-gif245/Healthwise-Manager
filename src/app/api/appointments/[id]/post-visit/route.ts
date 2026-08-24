import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { getAppointmentById } from '@/db/repositories/appointments';
import { getDoctorProfileByUserId } from '@/db/repositories/doctors';
import { submitPostVisit } from '@/lib/booking';

const prescriptionItem = z.object({
  drug: z.string().min(1).max(160),
  dosage: z.string().max(80).default(''),
  frequency_per_day: z.number().int().min(1).max(6),
  duration_days: z.number().int().min(1).max(90),
  instructions: z.string().max(300).optional(),
});
const schema = z.object({
  notes: z.string().min(3).max(6000),
  prescription: z.array(prescriptionItem).max(20).default([]),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['doctor']);
  if (isResponse(session)) return session;

  const appt = getAppointmentById(params.id);
  if (!appt) return jsonError('Appointment not found', 404, 'not_found');

  const profile = getDoctorProfileByUserId(session.sub);
  if (!profile || profile.id !== appt.doctor_id) return jsonError('Not authorized', 403, 'forbidden');
  if (appt.status !== 'confirmed') return jsonError('Only confirmed appointments can be completed', 409, 'invalid_state');

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400, 'validation');

  try {
    const updated = await submitPostVisit(params.id, parsed.data.notes, parsed.data.prescription);
    return NextResponse.json({ appointment: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
