import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { getUserByEmail, createUser } from '@/db/repositories/users';
import { createDoctorProfile, listDoctorsWithUser } from '@/db/repositories/doctors';
import { hashPassword } from '@/lib/auth';
import { newId } from '@/lib/id';

const dayHours = z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) });
const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  specialisation: z.string().min(2).max(120),
  bio: z.string().max(2000).optional(),
  slotDurationMinutes: z.number().int().min(5).max(240),
  workingHours: z.record(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']), dayHours),
  password: z.string().min(8).max(200).optional(),
});

export async function GET() {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;
  const doctors = listDoctorsWithUser();
  return NextResponse.json({
    doctors: doctors.map((d) => ({
      id: d.id,
      userId: d.user_id,
      name: d.name,
      email: d.email,
      phone: d.phone,
      specialisation: d.specialisation,
      bio: d.bio,
      slotDurationMinutes: d.slot_duration_minutes,
      workingHours: JSON.parse(d.working_hours || '{}'),
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400, 'validation');
  const data = parsed.data;

  try {
    if (getUserByEmail(data.email)) return jsonError('A user with this email already exists', 409, 'email_taken');

    const tempPassword = data.password || newId().slice(0, 10);
    const password_hash = await hashPassword(tempPassword);
    const user = createUser({ role: 'doctor', email: data.email, password_hash, name: data.name, phone: data.phone ?? null });
    const profile = createDoctorProfile({
      user_id: user.id,
      specialisation: data.specialisation,
      bio: data.bio ?? null,
      slot_duration_minutes: data.slotDurationMinutes,
      working_hours: data.workingHours,
    });

    return NextResponse.json(
      {
        doctor: { id: profile.id, userId: user.id, name: user.name, email: user.email, specialisation: profile.specialisation },
        // Returned once so the admin can share credentials with the doctor;
        // never retrievable again (only the bcrypt hash is stored).
        temporaryPassword: data.password ? undefined : tempPassword,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
