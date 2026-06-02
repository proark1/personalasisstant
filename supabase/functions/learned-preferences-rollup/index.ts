// Learned-preferences rollup.
//
// Reads the user's last ~180 days of completed tasks and computes:
//   - per-category median lead time (created_at → completed_at)
//   - per-category on-time rate (completed_at <= due_date)
//   - per-category median slip (only over the late ones)
//   - per-category preferred hour-of-day (mode of completed_at hour
//     bucketed by category)
//
// Results land in dori_task_stats. The stats power both the slip-risk
// view and the chat function's preference block.
//
// Also writes 1-2 derived narrative preferences into
// dori_learned_preferences so the chat assistant can SEE them in
// natural language ("you usually complete personal tasks 36h after
// creating them"). Confidence scales with sample size: tiny samples
// produce nothing; >=10 → 0.6; >=30 → 0.85.
//
// Service-role auth required.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

interface CompletedTask {
  category: string | null;
  created_at: string;
  completed_at: string;
  due_date: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const body = await req.json().catch(() => ({}));

  // Pagination knobs — same shape as embed-memories-backfill so callers
  // can apply identical cron orchestration to both.
  const userPageSize: number = body.user_page_size ?? 500;
  const maxUsers: number = body.max_users ?? 5000;
  const cursorOffset: number = body.cursor_offset ?? 0;

  let processed = 0;
  let preferencesWritten = 0;

  const runOne = async (userId: string) => {
    try {
      const { written } = await rollupForUser(supabase, userId);
      preferencesWritten += written;
      processed++;
    } catch (e) {
      console.error('[learned-preferences-rollup]', userId, (e as Error).message);
    }
  };

  if (body.user_id) {
    await runOne(body.user_id);
  } else {
    let offset = cursorOffset;
    while (processed < maxUsers) {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id')
        .order('user_id')
        .range(offset, offset + userPageSize - 1);
      if (error) {
        console.error('[learned-preferences-rollup] page fetch failed', error.message);
        break;
      }
      const page = (data ?? []) as Array<{ user_id: string }>;
      if (page.length === 0) break;
      for (const { user_id } of page) {
        if (processed >= maxUsers) break;
        await runOne(user_id);
      }
      if (page.length < userPageSize) break;
      offset += userPageSize;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      usersProcessed: processed,
      preferencesWritten,
      nextCursorOffset: cursorOffset + processed,
      truncated: processed >= maxUsers,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

async function rollupForUser(supabase: SupabaseClient, userId: string): Promise<{ written: number }> {
  const since = new Date(Date.now() - 180 * 24 * 3600_000).toISOString();

  // Pull the user's timezone so "preferred hour" reflects local clock,
  // not whatever the edge runtime defaults to (UTC). Falls through to
  // UTC if the column is missing — better than crashing the rollup.
  let userTz: string | undefined;
  try {
    const { data: p } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();
    userTz = p?.timezone || undefined;
  } catch { /* best-effort */ }

  const { data: rows, error } = await supabase
    .from('tasks')
    .select('category, created_at, completed_at, due_date')
    .eq('user_id', userId)
    .eq('completed', true)
    .not('completed_at', 'is', null)
    .gte('completed_at', since);

  if (error) throw error;
  const completed = (rows ?? []) as CompletedTask[];
  if (completed.length === 0) return { written: 0 };

  const byCat: Record<string, CompletedTask[]> = {};
  for (const t of completed) {
    const cat = t.category || 'uncategorised';
    (byCat[cat] ??= []).push(t);
  }

  // Tear down previous stats for this user, then re-write. Single
  // transaction-ish — last write wins.
  await supabase.from('dori_task_stats').delete().eq('user_id', userId);

  const statsRows: Array<Record<string, unknown>> = [];
  const narratives: { key: string; value: string; confidence: number }[] = [];

  for (const [category, tasks] of Object.entries(byCat)) {
    const leadHours = tasks.map((t) =>
      (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 3600_000,
    ).filter((h) => h >= 0 && h < 24 * 365);

    const datedTasks = tasks.filter((t) => t.due_date);
    const onTimeCount = datedTasks.filter((t) =>
      new Date(t.completed_at) <= new Date(t.due_date!),
    ).length;
    const onTimeRate = datedTasks.length > 0 ? onTimeCount / datedTasks.length : null;

    const slipHours = datedTasks
      .filter((t) => new Date(t.completed_at) > new Date(t.due_date!))
      .map((t) => (new Date(t.completed_at).getTime() - new Date(t.due_date!).getTime()) / 3600_000);

    const medianLead = median(leadHours);
    const medianSlip = median(slipHours);

    statsRows.push({
      user_id: userId,
      category,
      hour_bucket: -1, // sentinel for "all hours" — see migration comment
      sample_size: tasks.length,
      median_lead_hours: medianLead,
      on_time_rate: onTimeRate,
      median_slip_hours: medianSlip,
      computed_at: new Date().toISOString(),
    });

    // Per-hour-bucket stats: which hour-of-day does the user actually
    // complete this category's tasks at? Mode → "preferred_hour".
    // Hours computed in the USER's timezone — `Date#getHours()` would
    // return UTC on the edge runtime and report bogus "3am workers".
    const hourCounts: Record<number, number> = {};
    for (const t of tasks) {
      const h = hourInTz(t.completed_at, userTz);
      hourCounts[h] = (hourCounts[h] ?? 0) + 1;
    }
    for (const [h, count] of Object.entries(hourCounts)) {
      statsRows.push({
        user_id: userId,
        category,
        hour_bucket: parseInt(h, 10),
        sample_size: count,
        median_lead_hours: null,
        on_time_rate: null,
        median_slip_hours: null,
        computed_at: new Date().toISOString(),
      });
    }

    // Derived narrative for the chat preferences block. Only emit
    // for categories with enough signal.
    if (tasks.length >= 10 && medianLead != null) {
      const conf = tasks.length >= 30 ? 0.85 : 0.6;
      narratives.push({
        key: `lead_time_${category}`,
        value: `User typically takes ~${Math.round(medianLead)}h between creating and completing ${category} tasks (n=${tasks.length}).`,
        confidence: conf,
      });
    }
    if (datedTasks.length >= 10 && onTimeRate != null) {
      const conf = datedTasks.length >= 30 ? 0.85 : 0.6;
      const verdict = onTimeRate >= 0.8
        ? 'almost always on time'
        : onTimeRate >= 0.5
          ? `on time roughly ${Math.round(onTimeRate * 100)}% of the time`
          : `frequently slips deadlines (only ${Math.round(onTimeRate * 100)}% on time)`;
      narratives.push({
        key: `slip_pattern_${category}`,
        value: `User is ${verdict} for ${category} tasks (n=${datedTasks.length}). Pad due dates if confidence is low.`,
        confidence: conf,
      });
    }
    if (Object.keys(hourCounts).length > 0) {
      const topHour = Number(Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0][0]);
      if (tasks.length >= 10) {
        narratives.push({
          key: `preferred_hour_${category}`,
          value: `User completes most ${category} tasks around ${topHour.toString().padStart(2, '0')}:00 local time.`,
          confidence: tasks.length >= 30 ? 0.8 : 0.55,
        });
      }
    }
  }

  if (statsRows.length > 0) {
    const { error: insertErr } = await supabase.from('dori_task_stats').insert(statsRows);
    if (insertErr) console.warn('[rollup] insert stats failed', insertErr.message);
  }

  let written = 0;
  for (const n of narratives) {
    const { error } = await supabase
      .from('dori_learned_preferences')
      .upsert(
        {
          user_id: userId,
          key: n.key,
          value: n.value,
          confidence: n.confidence,
          times_seen: 1,
          source: 'task_history_rollup',
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,key' },
      );
    if (!error) written++;
  }
  return { written };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Hour-of-day in a target timezone. Intl.DateTimeFormat is the only
// reliable way to get this on Deno — `Date#getHours()` returns the
// runtime's local zone (UTC on edge), which would mislabel every
// completion. Falls back to UTC if the tz string is bad.
function hourInTz(iso: string, tz?: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz || 'UTC',
      hour: '2-digit',
      hour12: false,
    });
    const h = parseInt(fmt.format(new Date(iso)), 10);
    return Number.isFinite(h) ? h % 24 : 0;
  } catch {
    return new Date(iso).getUTCHours();
  }
}
