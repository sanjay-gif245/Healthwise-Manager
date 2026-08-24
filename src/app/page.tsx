import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-appbg">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
              Appointments, symptom triage, and follow-ups — in one clinic platform.
            </h1>
            <p className="mt-4 text-lg text-ink-muted">
              Patients share symptoms ahead of time. Doctors get an AI-generated pre-visit summary with an urgency
              level. Everyone gets timely email and calendar updates.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="md">Book Appointment</Button>
              </Link>
              <Link href="/login">
                <Button size="md" variant="secondary">
                  Log in
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            <Card>
              <CardBody className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-brand">
                  1
                </span>
                <div>
                  <p className="font-semibold text-ink">Search &amp; book a doctor</p>
                  <p className="text-sm text-ink-muted">Filter by specialisation and pick an open slot in seconds.</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-brand">
                  2
                </span>
                <div>
                  <p className="font-semibold text-ink">Describe your symptoms</p>
                  <p className="text-sm text-ink-muted">
                    An AI-generated summary with urgency level reaches your doctor before the visit.
                  </p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-brand">
                  3
                </span>
                <div>
                  <p className="font-semibold text-ink">Get a plain-language follow-up</p>
                  <p className="text-sm text-ink-muted">
                    Post-visit notes are turned into a friendly summary with medication reminders.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
