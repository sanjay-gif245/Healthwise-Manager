// Standalone background worker process for persistent-server deployments
// (Render, Railway, a VM, or plain `next start` on a box you control).
// Run alongside the web process: `npm run worker`.
//
// It shares the exact same job functions as the HTTP-triggered
// /api/worker/tick endpoint (see src/lib/workerJobs.ts) used for serverless
// deploys — only the trigger mechanism differs.
import cron from 'node-cron';
import { runFullSweep } from '../lib/workerJobs';

const SCHEDULE = process.env.WORKER_CRON_SCHEDULE || '*/2 * * * *'; // every 2 minutes

async function tick() {
  const startedAt = new Date().toISOString();
  try {
    const result = await runFullSweep();
    // eslint-disable-next-line no-console
    console.log(`[worker] ${startedAt} sweep complete`, JSON.stringify(result));
  } catch (err) {
    console.error(`[worker] ${startedAt} sweep failed`, err);
  }
}

console.log(`[worker] starting, schedule="${SCHEDULE}"`);
cron.schedule(SCHEDULE, tick);
// Also run once immediately on boot so a fresh deploy doesn't wait a full interval.
tick();
