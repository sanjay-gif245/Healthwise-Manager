export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  role: Role;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export type PublicUser = Omit<User, 'password_hash'>;

export interface WorkingHoursDay {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}
export type WorkingHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', WorkingHoursDay>
>;

export interface DoctorProfile {
  id: string;
  user_id: string;
  specialisation: string;
  bio: string | null;
  slot_duration_minutes: number;
  working_hours: string; // JSON WorkingHours
  created_at: string;
}

export interface DoctorProfileWithUser extends DoctorProfile {
  name: string;
  email: string;
  phone: string | null;
}

export interface DoctorLeaveDay {
  id: string;
  doctor_id: string;
  leave_date: string;
  reason: string | null;
  created_at: string;
}

export interface SlotHold {
  id: string;
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  patient_id: string;
  expires_at: string;
  created_at: string;
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'rescheduled';
export type UrgencyLevel = 'Low' | 'Medium' | 'High';
export type SummaryStatus = 'pending' | 'ready' | 'failed' | 'simulated';
export type PostVisitStatus = 'not_submitted' | 'pending' | 'ready' | 'failed' | 'simulated';

export interface PrescriptionItem {
  drug: string;
  dosage: string;
  frequency_per_day: number;
  duration_days: number;
  instructions?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  status: AppointmentStatus;
  cancel_reason: string | null;
  rescheduled_to_id: string | null;

  symptom_text: string | null;
  urgency_level: UrgencyLevel | null;
  chief_complaint: string | null;
  suggested_questions: string | null; // JSON string[]
  pre_visit_summary_status: SummaryStatus;
  pre_visit_summary_error: string | null;

  doctor_notes: string | null;
  prescription: string | null; // JSON PrescriptionItem[]
  post_visit_summary_text: string | null;
  post_visit_summary_status: PostVisitStatus;
  post_visit_summary_error: string | null;

  patient_calendar_event_id: string | null;
  doctor_calendar_event_id: string | null;

  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'booking_confirmation'
  | 'reminder_24h'
  | 'cancellation'
  | 'reschedule'
  | 'leave_notice'
  | 'medication_reminder'
  | 'post_visit_summary_ready';

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface NotificationRow {
  id: string;
  appointment_id: string | null;
  recipient_id: string;
  type: NotificationType;
  channel: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface MedicationReminder {
  id: string;
  appointment_id: string;
  patient_id: string;
  drug_name: string;
  dosage: string | null;
  frequency_per_day: number;
  duration_days: number;
  start_date: string;
  reminder_times: string; // JSON string[]
  last_sent_date: string | null;
  active: 0 | 1;
  created_at: string;
}

export interface CalendarConnection {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string | null;
  connected_at: string;
}
