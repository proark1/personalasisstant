import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PatternBucket {
  key: string;
  type: string;
  title: string;
  description: string;
  pattern: Record<string, unknown>;
  occurrences: number;
  lastAt: string;
  frequency: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal/cron only: the gateway does not verify JWTs for /functions/v1,
  // so require the service-role bearer in code (matches the *-cron siblings).
  if (req.headers.get("Authorization") !== `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    let userIds: string[] = body.user_id ? [body.user_id] : [];

    if (userIds.length === 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id");
      userIds = (profiles || []).map((p: { user_id: string }) => p.user_id);
    }

    let totalRoutines = 0;

    for (const userId of userIds) {
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const buckets = new Map<string, PatternBucket>();

      // 1. Email send patterns: same recipient + similar weekday/hour
      const { data: emails } = await supabase
        .from("user_emails")
        .select("to_addresses, sent_at, subject")
        .eq("user_id", userId)
        .eq("folder", "sent")
        .gte("sent_at", since)
        .limit(500);

      for (const e of emails || []) {
        const recipients = (e.to_addresses as string[] | null) || [];
        if (!e.sent_at || recipients.length === 0) continue;
        const d = new Date(e.sent_at);
        const dow = d.getUTCDay();
        const hour = d.getUTCHours();
        for (const recipient of recipients) {
          const key = `email:${recipient}:${dow}:${Math.floor(hour / 2)}`;
          const existing = buckets.get(key);
          if (existing) {
            existing.occurrences++;
            existing.lastAt = e.sent_at;
          } else {
            buckets.set(key, {
              key,
              type: "email_send",
              title: `Email ${recipient}`,
              description: `You email ${recipient} ${weekdayName(dow)}s around ${hour}:00`,
              pattern: { recipient, weekday: dow, hour },
              occurrences: 1,
              lastAt: e.sent_at,
              frequency: "weekly",
            });
          }
        }
      }

      // 2. Task category patterns by weekday
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, category, completed_at")
        .eq("user_id", userId)
        .eq("completed", true)
        .gte("completed_at", since)
        .limit(500);

      for (const t of tasks || []) {
        if (!t.completed_at || !t.category) continue;
        const d = new Date(t.completed_at);
        const dow = d.getUTCDay();
        const key = `task:${t.category}:${dow}`;
        const existing = buckets.get(key);
        if (existing) {
          existing.occurrences++;
          existing.lastAt = t.completed_at;
        } else {
          buckets.set(key, {
            key,
            type: "task_recurring",
            title: `${t.category} on ${weekdayName(dow)}`,
            description: `You complete ${t.category} tasks most ${weekdayName(dow)}s`,
            pattern: { category: t.category, weekday: dow },
            occurrences: 1,
            lastAt: t.completed_at,
            frequency: "weekly",
          });
        }
      }

      // Filter buckets with >=3 occurrences and propose
      for (const b of buckets.values()) {
        if (b.occurrences < 3) continue;
        const confidence = Math.min(0.95, 0.4 + b.occurrences * 0.1);
        const next = computeNext(b);

        await supabase.from("learned_routines").upsert(
          {
            user_id: userId,
            routine_type: b.type,
            title: b.title,
            description: b.description,
            pattern: b.pattern,
            frequency: b.frequency,
            confidence,
            occurrences: b.occurrences,
            last_occurred_at: b.lastAt,
            next_expected_at: next,
            fingerprint: b.key,
            status: "suggested",
          },
          { onConflict: "user_id,fingerprint" },
        );
        totalRoutines++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, routinesProposed: totalRoutines, usersScanned: userIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("routine-learner error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function weekdayName(d: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d];
}

function computeNext(b: PatternBucket): string | null {
  const wd = (b.pattern as Record<string, unknown>).weekday;
  const hour = (b.pattern as Record<string, unknown>).hour ?? 9;
  if (typeof wd !== "number") return null;
  const now = new Date();
  const next = new Date(now);
  const daysAhead = (wd - now.getUTCDay() + 7) % 7 || 7;
  next.setUTCDate(now.getUTCDate() + daysAhead);
  next.setUTCHours(hour, 0, 0, 0);
  return next.toISOString();
}
