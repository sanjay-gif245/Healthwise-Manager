import { NextResponse } from 'next/server';
import { listDoctorsWithUser, listSpecialisations } from '@/db/repositories/doctors';
import { requireUser, isResponse } from '@/lib/apiHelpers';

export async function GET(req: Request) {
  const session = await requireUser();
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const specialisation = searchParams.get('specialisation') || undefined;
  const doctors = listDoctorsWithUser(specialisation);
  const specialisations = listSpecialisations();
  return NextResponse.json({
    doctors: doctors.map((d) => ({
      id: d.id,
      name: d.name,
      specialisation: d.specialisation,
      bio: d.bio,
      slotDurationMinutes: d.slot_duration_minutes,
      workingHours: JSON.parse(d.working_hours || '{}'),
    })),
    specialisations,
  });
}
