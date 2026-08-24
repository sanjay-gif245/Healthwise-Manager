import { NextResponse } from 'next/server';
import { getDoctorProfileById } from '@/db/repositories/doctors';
import { getSlotsForDate } from '@/lib/slots';
import { requireUser, isResponse, jsonError } from '@/lib/apiHelpers';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser();
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError('Query param "date" (YYYY-MM-DD) is required', 400, 'validation');
  }
  const doctor = getDoctorProfileById(params.id);
  if (!doctor) return jsonError('Doctor not found', 404, 'not_found');

  const slots = getSlotsForDate(doctor, date);
  return NextResponse.json({ slots });
}
