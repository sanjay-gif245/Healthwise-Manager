import { NextResponse } from 'next/server';
import { requireUser, isResponse, jsonError } from '@/lib/apiHelpers';
import { getAppointmentById } from '@/db/repositories/appointments';
import { getDoctorProfileByUserId, getDoctorWithUserById } from '@/db/repositories/doctors';
import { getUserById } from '@/db/repositories/users';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser();
  if (isResponse(session)) return session;

  const appt = getAppointmentById(params.id);
  if (!appt) return jsonError('Appointment not found', 404, 'not_found');

  if (session.role === 'patient' && appt.patient_id !== session.sub) return jsonError('Not authorized', 403, 'forbidden');
  if (session.role === 'doctor') {
    const profile = getDoctorProfileByUserId(session.sub);
    if (!profile || profile.id !== appt.doctor_id) return jsonError('Not authorized', 403, 'forbidden');
  }

  const doctor = getDoctorWithUserById(appt.doctor_id);
  const patient = getUserById(appt.patient_id);

  return NextResponse.json({
    appointment: {
      ...appt,
      suggested_questions: appt.suggested_questions ? JSON.parse(appt.suggested_questions) : null,
      prescription: appt.prescription ? JSON.parse(appt.prescription) : null,
      doctorName: doctor?.name,
      doctorSpecialisation: doctor?.specialisation,
      patientName: patient?.name,
      patientEmail: patient?.email,
    },
  });
}
