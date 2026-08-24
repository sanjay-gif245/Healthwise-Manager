'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Alert';

interface DoctorListItem {
  id: string;
  name: string;
  specialisation: string;
  bio: string | null;
  slotDurationMinutes: number;
}

export default function DoctorSearchPage() {
  const [doctors, setDoctors] = useState<DoctorListItem[] | null>(null);
  const [specialisations, setSpecialisations] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = filter ? `?specialisation=${encodeURIComponent(filter)}` : '';
    apiFetch<{ doctors: DoctorListItem[]; specialisations: string[] }>(`/api/doctors${params}`)
      .then((d) => {
        setDoctors(d.doctors);
        setSpecialisations((prev) => (prev.length ? prev : d.specialisations));
      })
      .catch((e) => setError(e.message));
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink">Find a Doctor</h1>
        <div className="w-56">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All specialisations</option>
            {specialisations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {!doctors && !error && <p className="text-sm text-ink-muted">Loading doctors…</p>}
      {doctors && doctors.length === 0 && (
        <Card>
          <CardBody className="text-sm text-ink-muted">No doctors match this filter.</CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors?.map((d) => (
          <Link key={d.id} href={`/dashboard/doctors/${d.id}`}>
            <Card className="h-full transition-colors hover:border-brand">
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink">Dr. {d.name}</p>
                    <p className="text-sm text-ink-muted">{d.specialisation}</p>
                  </div>
                  <span className="mt-1 flex items-center gap-1.5 text-xs font-medium text-available">
                    <span className="h-1.5 w-1.5 rounded-full bg-available" />
                    Available
                  </span>
                </div>
                {d.bio && <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{d.bio}</p>}
                <p className="mt-3 text-xs text-ink-muted">{d.slotDurationMinutes}-minute slots</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
