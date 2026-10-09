const module = await import('../apps/web/server/push-worker.ts');
const runPushWorker = module.runPushWorker ?? module.default?.runPushWorker;
import { setTimeout } from 'node:timers/promises';
const once = process.argv.includes('--once');
// Local-only runner: durable state is in PostgreSQL; hosted production uses signed Inngest invocations.
if (process.env.APP_ENV !== 'local') throw new Error('This runner is only for local development.');
do {
  try { console.log(JSON.stringify(await runPushWorker())); }
  catch { console.error('Notification worker temporarily unavailable.'); if (once) process.exitCode = 1; }
  if (once) break;
  await setTimeout(15000);
} while (true);
if (once) process.exit(process.exitCode ?? 0);
