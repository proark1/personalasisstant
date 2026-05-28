// Trip prep — auto-create the "Pack for X" task and (when imminent)
// kick off AI packing list generation.
//
// Body: { trip_id: uuid, force?: boolean }
//   force: re-run even if prep_run_at is set.
//
// Behaviour:
//   1. Load the trip; verify ownership.
//   2. If prep_run_at is set and !force, return early (idempotent).
//   3. Insert a "Pack for {trip}" task due 24h before start_date
//      (or +1d from now if start_date already passed).
//   4. If start_date is within the weather forecast window (<14 days),
//      kick off generate-packing-list (best-effort).
//   5. Stamp prep_run_at on the trip.
//
// Returns task_id + packing_kicked_off boolean.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { adminClient, resolveUserId } from '../_shared/auth.ts';
import { recordUndo } from '../_shared/dori-undo.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-telegram-user-id',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userId = auth.userId;
    const admin = adminClient();

    const body = await req.json().catch(() => ({}));
    const tripId = String(body.trip_id || '');
    if (!UUID_RE.test(tripId)) return json({ error: 'invalid trip_id' }, 400);
    const force = body.force === true;

    const { data: trip, error: tErr } = await admin
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', userId)
      .single();
    if (tErr || !trip) return json({ error: 'trip not found' }, 404);

    if (trip.prep_run_at && !force) {
      return json({
        ok: true,
        skipped: true,
        reason: 'already prepped',
        prep_run_at: trip.prep_run_at,
      });
    }

    // 3. Pack task. Deadline = start_date - 1 day, but never in the past.
    const startMs = new Date(trip.start_date + 'T00:00:00Z').getTime();
    const dayBefore = new Date(startMs - 86_400_000);
    const now = new Date();
    const deadline = dayBefore > now ? dayBefore : new Date(now.getTime() + 86_400_000);

    const { data: task, error: taskErr } = await admin
      .from('tasks')
      .insert({
        user_id: userId,
        title: `Pack for ${trip.title || trip.destination}`,
        description: `Trip: ${trip.title || ''} → ${trip.destination}${trip.destination_country ? ', ' + trip.destination_country : ''}\nDates: ${trip.start_date} → ${trip.end_date}\nPurpose: ${trip.purpose || 'unspecified'}`,
        category: trip.purpose === 'work' ? 'business' : 'personal',
        priority: 'high',
        due_date: deadline.toISOString(),
        completed: false,
      })
      .select('id')
      .single();

    let packingKickedOff = false;
    let packingError: string | null = null;
    // 4. If trip starts within Open-Meteo's 14d horizon, fire packing
    //    generation. Best-effort; we don't block on it.
    const daysToStart = Math.floor((startMs - Date.now()) / 86_400_000);
    if (daysToStart >= 0 && daysToStart <= 14) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const r = await fetch(`${supabaseUrl}/functions/v1/generate-packing-list`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'x-telegram-user-id': userId,
          },
          body: JSON.stringify({ trip_id: tripId, replace: false }),
          signal: AbortSignal.timeout(50_000),
        });
        const r2 = await r.json().catch(() => null);
        packingKickedOff = !!(r?.ok && r2?.ok);
        if (r2?.error) packingError = r2.error;
      } catch (e) {
        packingError = (e as Error).message;
      }
    }

    // 5. Stamp + metadata.
    const newMeta = {
      ...((trip.metadata as Record<string, unknown>) ?? {}),
      prep_task_id: task?.id ?? null,
      packing_kicked_off: packingKickedOff,
    };
    await admin.from('trips').update({
      prep_run_at: new Date().toISOString(),
      metadata: newMeta,
    }).eq('id', tripId);

    // Undo: drop the pack task + clear the prep_run_at sentinel.
    if (task?.id) {
      await recordUndo(admin, {
        user_id: userId,
        op: 'create',
        entity_type: 'task',
        entity_id: task.id,
        label: `Pack for ${trip.title || trip.destination}`,
        inverse_tool_xml: null,
        snapshot: { kind: 'delete_by_id', table: 'tasks', id: task.id },
        source: 'trip_prep',
        source_ref: tripId,
      });
    }

    return json({
      ok: true,
      task_id: task?.id ?? null,
      task_due: deadline.toISOString(),
      packing_kicked_off: packingKickedOff,
      packing_error: packingError,
      days_to_start: daysToStart,
    });
  } catch (err) {
    console.error('[trip-prep] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
