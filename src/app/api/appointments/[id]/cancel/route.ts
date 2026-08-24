import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { getAppointmentById } from '@/db/repositories/appointments';
import { getDoctorProfileByUserId } from '@/db/repositories/doctors';
import { cancelAppointment } from '@/lib/booking';

const schema = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['patient', 'doctor', 'admin']);
  if (isResponse(session)) return session;

  const appt = getAppointmentById(params.id);
  if (!appt) return jsonError('Appointment not found', 404, 'not_found');

  if (session.role === 'patient' && appt.patient_id !== session.sub) return jsonError('Not authorized', 403, 'forbidden');
  if (session.role === 'doctor') {
    const profile = getDoctorProfileByUserId(session.sub);
    if (!profile || profile.id !== appt.doctor_id) return jsonError('Not authorized', 403, 'forbidden');
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const reason = parsed.success && parsed.data.reason ? parsed.data.reason : 'Cancelled by ' + session.role;

  try {
    await cancelAppointment(params.id, reason, session.role as 'patient' | 'doctor' | 'admin');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
