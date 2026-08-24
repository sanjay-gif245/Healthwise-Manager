import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, isResponse, jsonError, handleApiError } from '@/lib/apiHelpers';
import { listLeaveDays, removeLeaveDay, getDoctorProfileById } from '@/db/repositories/doctors';
import { markDoctorOnLeave } from '@/lib/booking';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['admin', 'doctor']);
  if (isResponse(session)) return session;
  const leave = listLeaveDays(params.id);
  return NextResponse.json({ leave });
}

const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(500).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || 'Invalid input', 400, 'validation');

  const doctor = getDoctorProfileById(params.id);
  if (!doctor) return jsonError('Doctor not found', 404, 'not_found');

  try {
    const { affected } = await markDoctorOnLeave(params.id, parsed.data.date, parsed.data.reason ?? null);
    return NextResponse.json({ ok: true, affectedAppointments: affected });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await requireUser(['admin']);
  if (isResponse(session)) return session;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  if (!date) return jsonError('Query param "date" is required', 400, 'validation');
  removeLeaveDay(params.id, date);
  return NextResponse.json({ ok: true });
}
