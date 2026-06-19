// Detects schedule conflicts: overlapping events, tight transitions, kid-pickup clashes.
// Run via cron every 30 min OR on-demand.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIGHT_TRANSITION_MIN = 15; // less than X minutes between non-overlapping events = tight

interface ConflictEntity {
  type: string;
  id: string;
  title: string;
  start?: string;
  end?: string;
}

interface Conflict {
  conflict_type: string;
  severity: string;
  title: string;
  description: string;
  entities: ConflictEntity[];
  suggested_resolution: string;
  fingerprint: string;
}

interface EventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  category?: string;
}

function detectConflicts(events: EventRow[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aStart = new Date(a.start_time).getTime();
    const aEnd = new Date(a.end_time).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bStart = new Date(b.start_time).getTime();
      const _bEnd = new Date(b.end_time).getTime();

      // Overlap
      if (bStart < aEnd) {
        const fp = `overlap:${a.id}:${b.id}`;
        conflicts.push({
          conflict_type: "overlap",
          severity: "high",
          title: `Overlap: "${a.title}" & "${b.title}"`,
          description: `Both events overlap on ${new Date(aStart).toLocaleString()}.`,
          entities: [
            { type: "event", id: a.id, title: a.title, start: a.start_time, end: a.end_time },
            { type: "event", id: b.id, title: b.title, start: b.start_time, end: b.end_time },
          ],
          suggested_resolution: "Reschedule one of them or decline.",
          fingerprint: fp,
        });
      } else {
        // Tight transition
        const gapMin = (bStart - aEnd) / 60000;
        if (gapMin > 0 && gapMin < TIGHT_TRANSITION_MIN) {
          const fp = `tight:${a.id}:${b.id}`;
          conflicts.push({
            conflict_type: "tight_transition",
            severity: "medium",
            title: `Tight transition: ${Math.round(gapMin)}min between "${a.title}" → "${b.title}"`,
            description: `Only ${Math.round(gapMin)} minutes between events.`,
            entities: [
              { type: "event", id: a.id, title: a.title, end: a.end_time },
              { type: "event", id: b.id, title: b.title, start: b.start_time },
            ],
            suggested_resolution: "Add buffer time or move one event.",
            fingerprint: fp,
          });
        }
        break; // since sorted by start, no later j can overlap with a if this one doesn't
      }
    }
  }
  return conflicts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal/cron-only: require service role key
  const auth = req.headers.get("Authorization");
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // If user_id provided, run for one user; else loop all users with events in next 7 days.
    let userIds: string[];
    if (body.user_id) {
      userIds = [body.user_id];
    } else {
      const now = new Date();
      const future = new Date(now.getTime() + 7 * 86400_000);
      const { data } = await supabase
        .from("events")
        .select("user_id")
        .gte("start_time", now.toISOString())
        .lte("start_time", future.toISOString());
      userIds = [...new Set((data ?? []).map((e) => e.user_id))];
    }

    let totalDetected = 0;
    for (const uid of userIds) {
      const now = new Date();
      const future = new Date(now.getTime() + 7 * 86400_000);
      const { data: events } = await supabase
        .from("events")
        .select("id, title, start_time, end_time, category")
        .eq("user_id", uid)
        .gte("start_time", now.toISOString())
        .lte("start_time", future.toISOString())
        .order("start_time");

      if (!events?.length) continue;

      const conflicts = detectConflicts(events);
      if (!conflicts.length) continue;

      const rows = conflicts.map((c) => ({ ...c, user_id: uid }));
      const { error } = await supabase
        .from("detected_conflicts")
        .upsert(rows, { onConflict: "user_id,fingerprint", ignoreDuplicates: true });
      if (error) console.error("conflict insert err", error);
      else totalDetected += rows.length;
    }

    return new Response(JSON.stringify({ users: userIds.length, detected: totalDetected }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("conflict-detector error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
