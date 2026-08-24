import { NextResponse } from 'next/server';
import { requireUser, isResponse } from '@/lib/apiHelpers';
import { listAppointmentsForPatient, listAppointmentsForDoctor } from '@/db/repositories/appointments';
import { getDoctorProfileByUserId, getDoctorWithUserById } from '@/db/repositories/doctors';
import { getUserById } from '@/db/repositories/users';
import { db } from '@/db/db';
import type { Appointment } from '@/types/models';

function enrich(appt: Appointment) {
  const doctor = getDoctorWithUserById(appt.doctor_id);
  const patient = getUserById(appt.patient_id);
  return {
    ...appt,
    suggested_questions: appt.suggested_questions ? JSON.parse(appt.suggested_questions) : null,
    prescription: appt.prescription ? JSON.parse(appt.prescription) : null,
    doctorName: doctor?.name,
    doctorSpecialisation: doctor?.specialisation,
    patientName: patient?.name,
  };
}

export async function GET() {
  const session = await requireUser();
  if (isResponse(session)) return session;

  if (session.role === 'patient') {
    const appts = listAppointmentsForPatient(session.sub);
    return NextResponse.json({ appointments: appts.map(enrich) });
  }
  if (session.role === 'doctor') {
    const profile = getDoctorProfileByUserId(session.sub);
    if (!profile) return NextResponse.json({ appointments: [] });
    const appts = listAppointmentsForDoctor(profile.id);
    return NextResponse.json({ appointments: appts.map(enrich) });
  }
  // admin: everything, most recent first
  const appts = db.prepare('SELECT * FROM appointments ORDER BY slot_start DESC LIMIT 300').all() as Appointment[];
  return NextResponse.json({ appointments: appts.map(enrich) });
}
