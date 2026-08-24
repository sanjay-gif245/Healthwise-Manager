'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { Card, CardBody } from './ui/Card';
import { Button } from './ui/Button';
import { Label, Input, Textarea } from './ui/Form';
import { Alert } from './ui/Alert';

interface PrescriptionDraft {
  drug: string;
  dosage: string;
  frequency_per_day: number;
  duration_days: number;
  instructions: string;
}

const emptyItem = (): PrescriptionDraft => ({ drug: '', dosage: '', frequency_per_day: 1, duration_days: 3, instructions: '' });

export function PostVisitForm({ appointmentId, onSubmitted }: { appointmentId: string; onSubmitted: () => void }) {
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PrescriptionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(i: number, patch: Partial<PrescriptionDraft>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/appointments/${appointmentId}/post-visit`, {
        method: 'POST',
        body: JSON.stringify({
          notes,
          prescription: items
            .filter((i) => i.drug.trim())
            .map((i) => ({ ...i, frequency_per_day: Number(i.frequency_per_day), duration_days: Number(i.duration_days) })),
        }),
      });
      onSubmitted();
    } catch (e2) {
      setError(e2 instanceof ApiError ? e2.message : 'Could not submit visit notes');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <h2 className="mb-3 font-semibold text-ink">Complete visit: notes &amp; prescription</h2>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <Label htmlFor="notes">Clinical notes</Label>
            <Textarea id="notes" rows={4} required value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Prescription (optional)</Label>
              <Button type="button" size="sm" variant="secondary" onClick={() => setItems((p) => [...p, emptyItem()])}>
                + Add medicine
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-5">
                  <div className="col-span-2 sm:col-span-1">
                    <Label>Drug</Label>
                    <Input value={it.drug} onChange={(e) => updateItem(i, { drug: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Dosage</Label>
                    <Input value={it.dosage} onChange={(e) => updateItem(i, { dosage: e.target.value })} placeholder="500mg" />
                  </div>
                  <div>
                    <Label>Times/day</Label>
                    <Input
                      type="number"
                      min={1}
                      max={6}
                      value={it.frequency_per_day}
                      onChange={(e) => updateItem(i, { frequency_per_day: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Days</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={it.duration_days}
                      onChange={(e) => updateItem(i, { duration_days: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" loading={submitting}>
            Submit &amp; generate patient summary
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
