# System Design Write-up

*Covers: double-booking prevention, doctor leave conflict handling, slot hold mechanism, notification failure
handling. (~780 words)*

## Double-booking prevention

Two requests to book the same doctor at the same time must never both succeed, even when they arrive within
milliseconds of each other. The design uses two layers, deliberately redundant:

**Layer 1 — the slot hold** (`slot_holds` table, unique on `(doctor_id, slot_start)`). When a patient picks a slot,
the server tries to `INSERT` a hold row before showing the symptom form. SQLite resolves the `UNIQUE` constraint
atomically: if another request already holds that exact slot, the insert fails immediately and the second patient
gets a clear "someone else is booking this" response and is nudged to pick another slot — no ambiguity, no waiting
on a lock. This also solves a subtler problem: without a hold, two patients could both see a slot as "available",
both spend two minutes filling in symptoms, and only discover the conflict at the very end. The hold surfaces the
conflict at selection time instead, and expires automatically after 5 minutes (checked lazily on every acquire
attempt, and swept periodically by the background worker) so an abandoned booking doesn't lock a slot forever.

**Layer 2 — a partial unique index on `appointments`**:
```sql
CREATE UNIQUE INDEX uq_appointments_active_slot
  ON appointments(doctor_id, slot_start)
  WHERE status IN ('confirmed', 'completed');
```
This is the actual source of truth. The hold makes conflicts rare and gives good UX, but the index is what makes
them *impossible* regardless of any bug in the hold logic, a retried request, or a future code path that inserts an
appointment directly. Confirming a hold (releasing it and inserting the appointment) happens inside one SQLite
transaction (`withTransaction`, `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`), so a crash mid-confirmation can't leave
a hold released with no appointment created, or vice versa. If the insert ever violates the partial index — the
one remaining race window between "hold looks valid" and "transaction commits" — the caller gets a `slot_taken`
error and is asked to pick again, rather than corrupting the schedule.

Deliberately not used: row-level advisory locks or `SELECT ... FOR UPDATE`-style pessimistic locking. SQLite's
single-writer model plus the unique indexes give the same correctness with far less code, and the approach ports
cleanly to Postgres (both constraints translate directly) if the app outgrows SQLite.

## Doctor leave conflict handling

Marking a doctor on leave is not just "stop offering new slots for that date" — it must also resolve appointments
that were booked *before* the leave was declared. `markDoctorOnLeave` (`src/lib/booking.ts`) does this as one
operation: add the leave row, then query all still-active (`confirmed`/`completed`) appointments for that doctor on
that date, and for each one: set it to `cancelled` with a reason, delete its pending medication reminders, queue a
`leave_notice` email to the patient, and remove both calendar events if they exist. The admin's response includes
`affectedAppointments` so the UI can show "3 patients were notified" rather than a bare success message — leave
management is exactly the kind of action where silent side effects are the wrong default.

Two choices here are intentional trade-offs rather than "it happened to be simplest": the doctor is not
double-notified for their own leave (they already know), and the leave day itself is *not* rejected just because
appointments exist on it — a doctor calling in sick needs the leave recorded immediately, with the fallout handled
automatically, not blocked pending manual conflict resolution.

## Notification failure handling

Every outbound email is a row in `notifications` (`status`: pending → sent/failed), not a fire-and-forget call.
`queueAndSend` creates the row, then makes one immediate best-effort send attempt — most emails go out
instantly and the caller (a booking, cancellation, etc.) never blocks on retries. If that attempt fails, the row
stays `pending` with `next_retry_at` set using an increasing backoff schedule (1 / 5 / 15 / 60 / 240 minutes). The
background worker's retry sweep (`retryDueNotifications`) periodically picks up anything due, and after 5 failed
attempts the row is marked `failed` permanently rather than retried forever — visible to the admin at
`/dashboard/admin/notifications`, filterable by status, with the last error message attached. This means a
transient SMTP outage self-heals without any user-visible impact (the booking still succeeded; only the email
lagged), while a persistent failure (bad address, misconfigured credentials) surfaces clearly instead of vanishing
silently. The same "log first, attempt second, never block the caller" pattern is used for the LLM calls: a summary
that fails to generate degrades to a labelled simulated one rather than failing the request it's attached to.
