import type { Appointment, PrescriptionItem } from './models';

export interface AppointmentView extends Omit<Appointment, 'suggested_questions' | 'prescription'> {
  suggested_questions: string[] | null;
  prescription: PrescriptionItem[] | null;
  doctorName?: string;
  doctorSpecialisation?: string;
  patientName?: string;
  patientEmail?: string;
}
