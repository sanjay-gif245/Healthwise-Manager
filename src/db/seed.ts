// Seeds a demo admin, three doctors, and one patient so the app is
// explorable immediately after `npm install && npm run seed`.
// Safe to re-run: skips any account whose email already exists.
import { getUserByEmail, createUser } from './repositories/users';
import { createDoctorProfile, getDoctorProfileByUserId } from './repositories/doctors';
import { hashPassword } from '../lib/auth';
import type { WorkingHours } from '../types/models';

const STANDARD_HOURS: WorkingHours = {
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: { start: '09:00', end: '15:00' },
};

async function ensureUser(role: 'admin' | 'doctor' | 'patient', name: string, email: string, password: string, phone?: string) {
  const existing = getUserByEmail(email);
  if (existing) return existing;
  const password_hash = await hashPassword(password);
  return createUser({ role, email, password_hash, name, phone });
}

async function main() {
  const admin = await ensureUser('admin', 'Clinic Admin', 'admin@clinic.demo', 'Admin@1234', '+91-90000-00000');
  console.log(`admin: ${admin.email} / Admin@1234`);

  // Names are stored WITHOUT a "Dr." prefix — every place in the UI/emails
  // that displays a doctor's name adds "Dr. " itself, so the stored name
  // stays reusable (e.g. for admin lists, "Doctor" record lookups, etc.).
  const doctorSeeds = [
    { name: 'Anjali Rao', email: 'anjali.rao@clinic.demo', specialisation: 'General Physician', slot: 20 },
    { name: 'Vikram Sen', email: 'vikram.sen@clinic.demo', specialisation: 'Cardiology', slot: 30 },
    { name: 'Priya Nair', email: 'priya.nair@clinic.demo', specialisation: 'Dermatology', slot: 15 },
  ];
  for (const d of doctorSeeds) {
    const user = await ensureUser('doctor', d.name, d.email, 'Doctor@1234', '+91-90000-00001');
    if (!getDoctorProfileByUserId(user.id)) {
      createDoctorProfile({
        user_id: user.id,
        specialisation: d.specialisation,
        bio: `Dr. ${d.name} is an experienced ${d.specialisation.toLowerCase()} at the clinic.`,
        slot_duration_minutes: d.slot,
        working_hours: STANDARD_HOURS,
      });
    }
    console.log(`doctor: ${d.email} / Doctor@1234  (${d.specialisation})`);
  }

  const patient = await ensureUser('patient', 'Ravi Kumar', 'ravi.kumar@clinic.demo', 'Patient@1234', '+91-90000-00002');
  console.log(`patient: ${patient.email} / Patient@1234`);

  console.log('\nSeed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
