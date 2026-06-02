// Friday-evening auto-recap dispatcher.
//
// pg_cron pings this function once an hour. We walk every linked
// workspace, check whether it's currently the recap window (Friday
// 17:00 local time in the owner's timezone, ±30min), dedupe via
// dori_proactive_log, and trigger workspace-weekly-recap with
// post_to_telegram=true. Hourly granularity keeps the scheduler
// tz-agnostic — each owner's Friday-17:00 hits the corresponding
// UTC slot.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RECAP_TARGET_HOUR = 17;        // 5pm local
const RECAP_TARGET_DOW = 5;          // Friday (0=Sun … 6=Sat)
const TRIGGER_TYPE = 'workspace_weekly_recap';

function tzNow(tz: string | null | undefined) {
  // Use the en-US numeric/2-digit format because it's stable across browsers.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const wkMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: wkMap[parts.find((p) => p.type === 'weekday')?.value || 'Sun'] ?? 0,
    hour: Number(parts.find((p) => p.type === 'hour')?.value || '0'),
  };
}

// ISO week key in the owner's tz. Used as a per-workspace dedupe key
// so we send exactly one recap per ISO week, regardless of how many
// times pg_cron pings us inside the Friday window.
function weekKey(tz: string | null | undefined): string {
  // YYYY-Www (ISO week year, week number) computed in tz.
  const now = new Date();
  // Get the date the owner currently sees.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const [y, m, d] = ymd.split('-').map(Number);
  // Compute ISO week number.
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth gate. The function dispatches AI-driven recaps that hit the LLM
  // gateway, so an unauthenticated public endpoint would let anyone burn
  // through credits. We only accept calls that present the service-role
  // bearer (the cron migration wires it through pg_net headers from the
  // Vault entry). Timing-safe equality isn't needed: a wrong key just
  // gets a 401, no oracle on partial matches.
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Pull every active workspace ↔ Telegram link, plus the owner's tz.
  const { data: links } = await admin
    .from('workspace_telegram_links')
    .select('workspace_id, chat_id, workspaces(owner_id, name)')
    .eq('is_active', true);

  if (!links?.length) {
    return new Response(JSON.stringify({ ok: true, dispatched: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  interface WorkspaceLink {
    workspace_id: string;
    chat_id: number | string;
    workspaces?: { owner_id?: string | null; name?: string | null } | null;
  }
  // Look up owner timezones in one go.
  const ownerIds = Array.from(new Set((links as WorkspaceLink[]).map((l) => l.workspaces?.owner_id).filter(Boolean))) as string[];
  const tzByOwner = new Map<string, string | null>();
  if (ownerIds.length) {
    const { data: profs } = await admin
      .from('profiles')
      .select('user_id, timezone')
      .in('user_id', ownerIds);
    for (const p of (profs || []) as Array<{ user_id: string; timezone?: string | null }>) tzByOwner.set(p.user_id, p.timezone || null);
  }

  // First pass: filter to only the workspaces whose owner is currently in
  // the Friday-17:00 hour. Cheap, in-memory: tzNow uses Intl on the host's
  // clock, no DB round-trips. Anything not in the window is skipped before
  // we touch the DB again.
  type Eligible = {
    workspaceId: string;
    chatId: number | string;
    ownerId: string;
    workspaceName: string;
    tz: string;
    triggerKey: string;
  };
  const eligible: Eligible[] = [];
  const skipped: { workspace_id: string; reason: string }[] = [];

  for (const link of (links as WorkspaceLink[])) {
    const ownerId = link.workspaces?.owner_id as string | undefined;
    if (!ownerId) continue;
    const tz = tzByOwner.get(ownerId) || 'UTC';
    const { weekday, hour } = tzNow(tz);
    if (weekday !== RECAP_TARGET_DOW) {
      skipped.push({ workspace_id: link.workspace_id, reason: `weekday=${weekday}` });
      continue;
    }
    if (hour !== RECAP_TARGET_HOUR) {
      skipped.push({ workspace_id: link.workspace_id, reason: `hour=${hour}` });
      continue;
    }
    eligible.push({
      workspaceId: link.workspace_id,
      chatId: link.chat_id,
      ownerId,
      workspaceName: link.workspaces?.name || 'workspace',
      tz,
      triggerKey: `${link.workspace_id}:${weekKey(tz)}`,
    });
  }

  // Batched dedupe: one query for every (user_id, trigger_key) pair we
  // care about, instead of N separate queries inside the loop.
  let alreadySent = new Set<string>();
  if (eligible.length > 0) {
    const triggerKeys = Array.from(new Set(eligible.map((e) => e.triggerKey)));
    const ownerIdsEligible = Array.from(new Set(eligible.map((e) => e.ownerId)));
    const { data: existing } = await admin
      .from('dori_proactive_log')
      .select('user_id, trigger_key')
      .eq('trigger_type', TRIGGER_TYPE)
      .in('user_id', ownerIdsEligible)
      .in('trigger_key', triggerKeys);
    alreadySent = new Set((existing || []).map((r: { user_id: string; trigger_key: string }) => `${r.user_id}|${r.trigger_key}`));
  }

  // Parallel dispatch. Sequential POSTs hit the 60s edge function ceiling
  // once you have ~30 workspaces. allSettled keeps the cron honest: a
  // single failed downstream call doesn't abort the rest.
  const results = await Promise.allSettled(eligible.map(async (e) => {
    if (alreadySent.has(`${e.ownerId}|${e.triggerKey}`)) {
      return { workspace_id: e.workspaceId, status: 'already_sent' as const };
    }
    const r = await fetch(`${supabaseUrl}/functions/v1/workspace-weekly-recap`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workspace_id: e.workspaceId,
        post_to_telegram: true,
        timezone: e.tz,
      }),
    });
    if (!r.ok) {
      return { workspace_id: e.workspaceId, status: 'http_error' as const, http: r.status };
    }
    await admin.from('dori_proactive_log').insert({
      user_id: e.ownerId,
      trigger_type: TRIGGER_TYPE,
      trigger_key: e.triggerKey,
      channel: 'tg_workspace',
      channel_ref: String(e.chatId),
      message: `Weekly recap posted to ${e.workspaceName}.`,
    });
    return { workspace_id: e.workspaceId, status: 'dispatched' as const };
  }));

  let dispatched = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.status === 'dispatched') dispatched++;
      else if (r.value.status === 'already_sent') skipped.push({ workspace_id: r.value.workspace_id, reason: 'already_sent' });
      else if (r.value.status === 'http_error') skipped.push({ workspace_id: r.value.workspace_id, reason: `http_${r.value.http}` });
    } else {
      console.error('recap dispatch rejected', r.reason);
      skipped.push({ workspace_id: 'unknown', reason: String(r.reason).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ ok: true, dispatched, skipped }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
