import { NextResponse } from 'next/server';
import { getDoctorWithUserById } from '@/db/repositories/doctors';
import { requireUser, isResponse, jsonError } from '@/lib/apiHelpers';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser();
  if (isResponse(session)) return session;

  const doctor = getDoctorWithUserById(params.id);
  if (!doctor) return jsonError('Doctor not found', 404, 'not_found');

  return NextResponse.json({
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialisation: doctor.specialisation,
      bio: doctor.bio,
      slotDurationMinutes: doctor.slot_duration_minutes,
      workingHours: JSON.parse(doctor.working_hours || '{}'),
    },
  });
}
