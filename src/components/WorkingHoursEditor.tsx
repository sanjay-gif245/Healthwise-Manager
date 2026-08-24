'use client';

import type { WorkingHours } from '@/types/models';
import { Input } from './ui/Form';

const DAYS: { key: keyof WorkingHours; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

export function WorkingHoursEditor({ value, onChange }: { value: WorkingHours; onChange: (v: WorkingHours) => void }) {
  function toggleDay(day: keyof WorkingHours, enabled: boolean) {
    const next = { ...value };
    if (enabled) next[day] = { start: '09:00', end: '17:00' };
    else delete next[day];
    onChange(next);
  }
  function setTime(day: keyof WorkingHours, field: 'start' | 'end', v: string) {
    const current = value[day] || { start: '09:00', end: '17:00' };
    onChange({ ...value, [day]: { ...current, [field]: v } });
  }

  return (
    <div className="space-y-2">
      {DAYS.map((d) => {
        const enabled = !!value[d.key];
        return (
          <div key={d.key} className="flex items-center gap-3">
            <label className="flex w-16 items-center gap-2 text-sm text-navtext">
              <input type="checkbox" checked={enabled} onChange={(e) => toggleDay(d.key, e.target.checked)} />
              {d.label}
            </label>
            {enabled ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-32"
                  value={value[d.key]?.start}
                  onChange={(e) => setTime(d.key, 'start', e.target.value)}
                />
                <span className="text-ink-muted">to</span>
                <Input
                  type="time"
                  className="w-32"
                  value={value[d.key]?.end}
                  onChange={(e) => setTime(d.key, 'end', e.target.value)}
                />
              </div>
            ) : (
              <span className="text-sm text-ink-muted">Day off</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
