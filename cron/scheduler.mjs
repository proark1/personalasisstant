// Self-hosted scheduler for DarAI edge functions.
//
// Replaces the Supabase pg_cron + net.http_post jobs (which don't exist on our
// self-hosted Railway Postgres — see db/bootstrap/00_extensions.sql). This is a
// long-running process that POSTs to each edge function on its schedule, exactly
// mirroring the cron expressions the old `cron.schedule(...)` migrations used.
//
// Zero dependencies: a tiny 5-field cron matcher + global fetch (Node 18+).
//
// Configuration (Railway env vars):
//   EDGE_FUNCTIONS_URL        Base URL of the edge-runtime service.
//                             Default: http://edge-runtime.railway.internal:9000
//                             (private networking — same value the gateway uses).
//   SUPABASE_SERVICE_ROLE_KEY Service-role JWT. Required by the dispatcher
//                             functions (briefing-dispatch-cron, *-cron, weekly
//                             briefing, digest, recap) which gate on it. Harmless
//                             for the no-auth functions (telegram-poll, email-
//                             autopilot), which ignore the header.
//   PORT                      Health-check port (Railway sets this). Default 8080.
//   CRON_DISABLED             Set to "1" to run the health server only (no jobs).

const BASE = (process.env.EDGE_FUNCTIONS_URL || 'http://edge-runtime.railway.internal:9000').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PORT = Number(process.env.PORT) || 8080;
const DISABLED = process.env.CRON_DISABLED === '1';
// Cap each edge-function POST so a hung runtime can't pin a job in-flight
// forever; the request is aborted and logged as a failure instead.
const REQUEST_TIMEOUT_MS = Number(process.env.CRON_REQUEST_TIMEOUT_MS) || 60_000;

// Each job mirrors a former pg_cron entry: { name → function path, schedule }.
//
// NOTE: telegram-poll is intentionally NOT here. Inbound Telegram updates are
// delivered by webhook (see supabase/functions/telegram-poll/WEBHOOK.md) — the
// bot replies instantly with no polling. Registering a webhook also disables
// getUpdates on Telegram's side, so a poll job here would just 409 every tick.
const JOBS = [
  { name: 'briefing-dispatch-cron',          schedule: '*/15 * * * *' },
  { name: 'content-ideas-cron',              schedule: '*/15 * * * *' },
  { name: 'telegram-weekly-briefing',        schedule: '0 * * * *' },
  { name: 'telegram-family-morning-digest',  schedule: '0 * * * *' },
  { name: 'workspace-recap-cron',            schedule: '5 * * * *' },
  { name: 'email-autopilot',                 schedule: '5 * * * *' },
  { name: 'plaid-sync-cron',                 schedule: '15 * * * *' },
  { name: 'meeting-bot-reconciler-cron',     schedule: '*/30 * * * *' },
  { name: 'trip-prep-cron',                  schedule: '0 9 * * *' },
  { name: 'calendar-sync-all',               schedule: '*/15 * * * *' },
];

// ── Minimal 5-field cron matcher (UTC) ─────────────────────────────────────
// Supports the only forms our schedules use: '*', '*/n', 'a-b', exact, and
// comma lists of those. Fields: minute hour day-of-month month day-of-week.
function fieldMatch(field, value) {
  for (const part of field.split(',')) {
    if (part === '*') return true;
    if (part.startsWith('*/')) {
      const step = parseInt(part.slice(2), 10);
      if (step > 0 && value % step === 0) return true;
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    } else if (Number(part) === value) {
      return true;
    }
  }
  return false;
}

function cronMatches(expr, d) {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/);
  return (
    fieldMatch(min, d.getUTCMinutes()) &&
    fieldMatch(hour, d.getUTCHours()) &&
    fieldMatch(dom, d.getUTCDate()) &&
    fieldMatch(mon, d.getUTCMonth() + 1) &&
    fieldMatch(dow, d.getUTCDay())
  );
}

// ── Job execution ──────────────────────────────────────────────────────────
const inFlight = new Set();

async function fire(job) {
  if (job.solo && inFlight.has(job.name)) {
    console.log(`[cron] ${job.name} still running — skipping this tick`);
    return;
  }
  inFlight.add(job.name);
  const url = `${BASE}/${job.name}`;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
      },
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const ms = Date.now() - t0;
    if (res.ok) {
      console.log(`[cron] ${job.name} -> ${res.status} (${ms}ms)`);
    } else {
      const body = await res.text().catch(() => '');
      console.error(`[cron] ${job.name} -> ${res.status} (${ms}ms) ${body.slice(0, 300)}`);
    }
  } catch (e) {
    console.error(`[cron] ${job.name} failed:`, e?.message || e);
  } finally {
    inFlight.delete(job.name);
  }
}

// Evaluate all jobs for a given minute, firing the matches. Fire-and-forget so
// a slow job never delays another job's tick.
function tick(now) {
  for (const job of JOBS) {
    if (cronMatches(job.schedule, now)) fire(job);
  }
}

// Align to the top of each minute, then run once per minute. We snap to the
// minute boundary so schedules like '0 * * * *' fire predictably.
function startScheduler() {
  let lastMinuteKey = '';
  const run = () => {
    const now = new Date();
    const key = `${now.getUTCHours()}:${now.getUTCMinutes()}`;
    if (key !== lastMinuteKey) {
      lastMinuteKey = key;
      tick(now);
    }
  };
  // Check every 15s; the minute-key guard ensures each minute fires exactly once
  // even if timers drift slightly.
  setInterval(run, 15_000);
  run(); // evaluate immediately on boot so a fresh deploy fires due jobs at once
  console.log(`[cron] scheduler started — ${JOBS.length} jobs, base=${BASE}`);
  if (!SERVICE_KEY) {
    console.warn('[cron] SUPABASE_SERVICE_ROLE_KEY is unset — dispatcher jobs that require it will 401.');
  }
}

// ── Crash safety ─────────────────────────────────────────────────────────────
// A long-running worker must never die on a stray rejection — otherwise Railway
// restarts it and the deployment flaps red. Log and keep scheduling.
process.on('unhandledRejection', (e) => console.error('[cron] unhandledRejection:', e?.stack || e?.message || e));
process.on('uncaughtException', (e) => console.error('[cron] uncaughtException:', e?.stack || e?.message || e));

// ── Health server (Railway expects a listening port) ───────────────────────
import { createServer } from 'node:http';
createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, jobs: JOBS.length, base: BASE, disabled: DISABLED }));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(PORT, () => console.log(`[cron] health server on :${PORT}`));

if (DISABLED) {
  console.warn('[cron] CRON_DISABLED=1 — health server only, no jobs scheduled.');
} else {
  startScheduler();
}
