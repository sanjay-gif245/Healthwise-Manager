import { NextResponse } from 'next/server';
import { runFullSweep } from '@/lib/workerJobs';
import { jsonError } from '@/lib/apiHelpers';

// HTTP-triggered variant of the background job, for serverless deploys
// (Vercel etc.) that don't keep a long-running Node process alive for
// node-cron. Point an external scheduler (Vercel Cron, GitHub Actions cron,
// cron-job.org) at this endpoint every few minutes with the header
// `x-worker-secret: <WORKER_SECRET>`.
export async function POST(req: Request) {
  const secret = process.env.WORKER_SECRET;
  if (secret) {
    const provided = req.headers.get('x-worker-secret');
    if (provided !== secret) return jsonError('Unauthorized', 401, 'unauthorized');
  }
  const result = await runFullSweep();
  return NextResponse.json({ ok: true, result });
}

// Convenience for manual browser testing when WORKER_SECRET is unset (dev only).
export async function GET(req: Request) {
  return POST(req);
}
