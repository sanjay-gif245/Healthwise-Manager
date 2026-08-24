-- Healthcare Appointment & Follow-up Manager
-- SQLite schema (via Node's built-in node:sqlite driver)
-- Foreign keys are enforced (PRAGMA foreign_keys = ON, set in db.ts on every connection)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One-to-one extension of a 'doctor' user with clinical/scheduling metadata.
CREATE TABLE IF NOT EXISTS doctor_profiles (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialisation        TEXT NOT NULL,
  bio                   TEXT,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  -- JSON map of weekday -> {start:"HH:MM", end:"HH:MM"}; a missing key means day off.
  -- e.g. {"mon":{"start":"09:00","end":"17:00"}, "tue":{"start":"09:00","end":"17:00"}}
  working_hours         TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_specialisation ON doctor_profiles(specialisation);

-- Individual leave days for a doctor. Adding a row here for a date that already
-- has confirmed appointments triggers the leave-conflict notification flow.
CREATE TABLE IF NOT EXISTS doctor_leave_days (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  leave_date  TEXT NOT NULL, -- 'YYYY-MM-DD'
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (doctor_id, leave_date)
);

-- Short-lived hold on a single (doctor, slot_start) pair while a patient is
-- filling in the symptom form / confirming a booking. This is the mechanism
-- that makes concurrent booking attempts safe: only one hold can exist per
-- slot at a time (UNIQUE constraint), and holds expire automatically.
CREATE TABLE IF NOT EXISTS slot_holds (
  id          TEXT PRIMARY KEY,
  doctor_id   TEXT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  slot_start  TEXT NOT NULL, -- ISO 8601 UTC
  slot_end    TEXT NOT NULL,
  patient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (doctor_id, slot_start)
);
CREATE INDEX IF NOT EXISTS idx_slot_holds_expires ON slot_holds(expires_at);

CREATE TABLE IF NOT EXISTS appointments (
  id                        TEXT PRIMARY KEY,
  patient_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id                 TEXT NOT NULL REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  slot_start                TEXT NOT NULL, -- ISO 8601 UTC
  slot_end                  TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (
                               status IN ('confirmed', 'cancelled', 'completed', 'rescheduled')
                             ) DEFAULT 'confirmed',
  cancel_reason             TEXT,
  rescheduled_to_id         TEXT REFERENCES appointments(id),

  -- Pre-visit (symptom intake -> LLM)
  symptom_text              TEXT,
  urgency_level              TEXT CHECK (urgency_level IN ('Low', 'Medium', 'High')),
  chief_complaint            TEXT,
  suggested_questions        TEXT, -- JSON array of strings
  pre_visit_summary_status   TEXT NOT NULL DEFAULT 'pending'
                               CHECK (pre_visit_summary_status IN ('pending','ready','failed','simulated')),
  pre_visit_summary_error    TEXT,

  -- Post-visit (clinical notes -> LLM patient-friendly summary)
  doctor_notes               TEXT,
  prescription                TEXT, -- JSON array of {drug, dosage, frequency, duration_days, instructions}
  post_visit_summary_text     TEXT,
  post_visit_summary_status   TEXT NOT NULL DEFAULT 'not_submitted'
                               CHECK (post_visit_summary_status IN ('not_submitted','pending','ready','failed','simulated')),
  post_visit_summary_error    TEXT,

  -- Calendar linkage (nullable: calendar integration is optional per user)
  patient_calendar_event_id  TEXT,
  doctor_calendar_event_id   TEXT,

  created_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_slot ON appointments(doctor_id, slot_start);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
-- The core double-booking guard: only one confirmed/completed appointment can
-- occupy a given (doctor, slot_start). Cancelled/rescheduled rows are excluded
-- so a freed slot can be rebooked.
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
  ON appointments(doctor_id, slot_start)
  WHERE status IN ('confirmed', 'completed');

-- Every outbound email (and its retry lifecycle) is logged here so delivery
-- failures are visible and retryable instead of silently dropped.
CREATE TABLE IF NOT EXISTS notifications (
  id              TEXT PRIMARY KEY,
  appointment_id  TEXT REFERENCES appointments(id) ON DELETE CASCADE,
  recipient_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                     'booking_confirmation', 'reminder_24h', 'cancellation',
                     'reschedule', 'leave_notice', 'medication_reminder',
                     'post_visit_summary_ready'
                   )),
  channel         TEXT NOT NULL DEFAULT 'email',
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_retry_at   TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status, next_retry_at);

-- One row per prescribed medication; the background worker fans these out
-- into individual `medication_reminder` notifications at the configured times.
CREATE TABLE IF NOT EXISTS medication_reminders (
  id                TEXT PRIMARY KEY,
  appointment_id    TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drug_name         TEXT NOT NULL,
  dosage            TEXT,
  frequency_per_day INTEGER NOT NULL DEFAULT 1,
  duration_days     INTEGER NOT NULL DEFAULT 1,
  start_date        TEXT NOT NULL, -- 'YYYY-MM-DD'
  reminder_times    TEXT NOT NULL, -- JSON array of "HH:MM" (length == frequency_per_day)
  last_sent_date    TEXT,          -- 'YYYY-MM-DD' of last date a reminder batch was sent
  active             INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_medication_reminders_patient ON medication_reminders(patient_id, active);

-- Stored Google OAuth2 tokens per user (patient or doctor) who has connected
-- their calendar. Absence of a row = calendar sync silently skipped for them.
CREATE TABLE IF NOT EXISTS calendar_connections (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expiry_date   INTEGER,
  scope         TEXT,
  connected_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Opaque one-time CSRF state values for the Google OAuth2 redirect flow.
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
