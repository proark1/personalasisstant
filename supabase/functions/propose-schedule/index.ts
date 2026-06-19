// Predictive scheduler.
//
// Body: { range_start?: 'YYYY-MM-DD', days?: number, timezone?: string,
//         deep_work_hours?: [number, number], constraints?: string[] }
//
//   range_start defaults to today; days defaults to 7.
//   deep_work_hours is a [start, end] in 24h local time, optional.
//   constraints is a free-form list of user instructions ("no
//     meetings before 10", "block 2h on Tuesday for the X review").
//
// Flow:
//   1. Gather context: open tasks (with priority + due_date + slip_risk),
//      existing events in the range, last 7 morning check-ins, energy
//      profile rollup, recent task stats per category.
//   2. Send to Gemini with a forced tool-call. The schema fixes the
//      block shape — start/end ISO, kind enum, optional task_id.
//   3. Persist as a `schedule_proposals` row with status='draft' and
//      a snapshot of the inputs for debuggability.
//
// Returns the new proposal row with parsed blocks.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { adminClient, resolveUserId } from "../_shared/auth.ts";
import { assertWithinQuota } from "../_shared/ai-quota.ts";
import { generateStructured } from "../_shared/geminiStructured.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "gemini-2.5-flash";
const MAX_BLOCKS = 60;
const KIND_VALUES = ["deep", "shallow", "meeting", "admin", "break", "errand"];

const SYSTEM_PROMPT = [
  "You are a scheduling assistant. Plan an efficient, sustainable",
  "work week for the user given their open tasks, calendar, energy",
  "profile, and stated constraints.",
  "",
  "Rules:",
  "- Honor existing events: do NOT propose blocks that overlap them.",
  "- Group similar work; avoid context-switch chaos.",
  "- Put DEEP-work blocks in the user's high-energy band whenever possible.",
  "  Push admin / shallow tasks into their low-energy band (e.g. post-lunch).",
  "- Cap deep blocks at 90 minutes. Insert breaks between long stretches.",
  "- Respect deadlines: tasks due soonest get earliest slots.",
  "- Never schedule outside 07:00–22:00 local time.",
  "- Never propose blocks on past dates.",
  '- For each block, write a one-sentence rationale ("placed in your',
  '  morning high-energy band so the writeup gets your best focus").',
  "- 8–25 blocks total per week is a healthy range. Quality, not quantity.",
].join("\n");

const TOOL = {
  type: "function",
  function: {
    name: "record_schedule",
    description: "Record the proposed schedule blocks",
    parameters: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          maxItems: MAX_BLOCKS,
          items: {
            type: "object",
            properties: {
              date: { type: "string", description: "YYYY-MM-DD local" },
              start_time: { type: "string", description: "ISO-8601 in user timezone" },
              end_time: { type: "string", description: "ISO-8601 in user timezone" },
              kind: { type: "string", enum: KIND_VALUES },
              title: { type: "string" },
              rationale: { type: "string" },
              task_id: { type: "string", description: "UUID of the linked open task, if any" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["date", "start_time", "end_time", "kind", "title", "rationale"],
          },
        },
        rationale: {
          type: "string",
          description: "Plain-English summary of the overall plan and trade-offs.",
        },
      },
      required: ["blocks"],
    },
  },
};

interface Block {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  kind: string;
  title: string;
  rationale: string;
  task_id?: string | null;
  priority?: "high" | "medium" | "low" | null;
  accepted: boolean | null;
  applied_event_id: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const user = { id: auth.userId };
    const admin = adminClient();

    const body = await req.json().catch(() => ({}));
    const days = clampInt(body.days, 1, 14, 7);
    // Resolve timezone before "today" so `range_start` defaults to the
    // user's local date, not UTC. A user in Tokyo at 22:00 UTC has
    // already moved to "tomorrow" locally — UTC's notion of today
    // would put deep-work blocks on a day that's already in the past.
    const timezone = typeof body.timezone === "string" ? body.timezone : "UTC";
    const rangeStart = isoDate(
      typeof body.range_start === "string" ? body.range_start : todayIso(timezone),
    );
    if (!rangeStart) return json({ error: "invalid range_start" }, 400);
    const rangeEnd = addDays(rangeStart, days - 1);
    const deepHours =
      Array.isArray(body.deep_work_hours) && body.deep_work_hours.length === 2
        ? `${body.deep_work_hours[0]}–${body.deep_work_hours[1]}`
        : null;
    const constraints: string[] = Array.isArray(body.constraints)
      ? body.constraints.map((s: unknown) => String(s).slice(0, 200)).slice(0, 8)
      : [];

    // ---- 1. Gather context. All queries are RLS-scoped via user_id.
    const [tasksRes, eventsRes, checkinsRes, energyRes, slipRes, statsRes] = await Promise.all([
      admin
        .from("tasks")
        .select("id, title, priority, category, due_date, description")
        .eq("user_id", user.id)
        .eq("completed", false)
        .eq("trashed", false)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50),
      admin
        .from("events")
        .select("id, title, start_time, end_time, location")
        .eq("user_id", user.id)
        .gte("start_time", rangeStart + "T00:00:00Z")
        .lte("start_time", rangeEnd + "T23:59:59Z")
        .order("start_time"),
      admin
        .from("daily_checkins")
        .select("checkin_date, energy_level, sleep_quality, sleep_hours, mood")
        .eq("user_id", user.id)
        .eq("checkin_type", "morning")
        .gte("checkin_date", addDays(rangeStart, -7))
        .order("checkin_date", { ascending: false })
        .limit(7),
      admin.from("user_energy_profile").select("*").eq("user_id", user.id).maybeSingle(),
      admin
        .from("dori_slip_risk")
        .select("task_id, slip_risk")
        .eq("user_id", user.id)
        .gt("slip_risk", 0.3)
        .limit(20),
      admin
        .from("dori_task_stats")
        .select("category, hour_bucket, median_lead_hours, on_time_rate, sample_size")
        .eq("user_id", user.id)
        .eq("hour_bucket", -1)
        .limit(20),
    ]);

    const tasks = (tasksRes.data ?? []) as Record<string, unknown>[];
    const events = (eventsRes.data ?? []) as Record<string, unknown>[];
    const checkins = (checkinsRes.data ?? []) as Record<string, unknown>[];
    const energyProfile = (energyRes.data ?? null) as Record<string, unknown> | null;
    const slipMap = new Map<string, number>();
    for (const r of (slipRes.data ?? []) as Array<{ task_id: string; slip_risk: number }>)
      slipMap.set(r.task_id, Number(r.slip_risk));
    const stats = (statsRes.data ?? []) as Record<string, unknown>[];

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) return json({ error: "AI not configured" }, 503);

    try {
      await assertWithinQuota(admin, user.id);
    } catch (e) {
      const code = e instanceof Object && "code" in e ? (e as { code?: string }).code : undefined;
      const errMsg = e instanceof Error ? e.message : String(e);
      return json({ error: errMsg, code }, code === "quota_exceeded" ? 429 : 500);
    }

    // ---- 2. Render the prompt. Keep it tight; the model doesn't
    //         need verbose framing.
    const userPrompt = [
      `Plan ${days} day${days === 1 ? "" : "s"} starting ${rangeStart} in timezone ${timezone}.`,
      deepHours ? `User's stated deep-work window: ${deepHours}.` : "",
      constraints.length ? "User constraints:\n" + constraints.map((c) => `- ${c}`).join("\n") : "",
      "",
      `Open tasks (${tasks.length}):`,
      tasks
        .map((t) => {
          const slip = slipMap.get(t.id);
          return `- [${t.priority}] [${t.category}] ${t.title}${t.due_date ? ` (due ${t.due_date.slice(0, 10)})` : ""}${slip != null ? ` (slip risk ${(slip * 100).toFixed(0)}%)` : ""} — id=${t.id}`;
        })
        .join("\n") || "(none)",
      "",
      `Existing calendar (${events.length}):`,
      events.map((e) => `- ${e.title}: ${e.start_time} → ${e.end_time}`).join("\n") || "(empty)",
      "",
      "Energy profile:",
      energyProfile
        ? `- avg energy ${energyProfile.avg_energy}/3 (${energyProfile.sample_size} samples), modal ${energyProfile.modal_energy}, sleep ${energyProfile.avg_sleep_hours}h q${energyProfile.avg_sleep_quality}/5`
        : "- no profile yet, use sensible defaults (high in mid-morning, dip after lunch)",
      "",
      `Recent check-ins (${checkins.length}):`,
      checkins
        .map(
          (c) =>
            `- ${c.checkin_date}: energy=${c.energy_level || "?"}, sleep=${c.sleep_hours ?? "?"}h q${c.sleep_quality ?? "?"}, focus="${c.mood ?? ""}"`,
        )
        .join("\n") || "(none)",
      "",
      "Per-category completion stats:",
      stats
        .map(
          (s) =>
            `- ${s.category}: on-time ${(Number(s.on_time_rate || 0) * 100).toFixed(0)}%, lead ${s.median_lead_hours}h (${s.sample_size} samples)`,
        )
        .join("\n") || "(none)",
    ]
      .filter(Boolean)
      .join("\n");

    const startMs = Date.now();
    // Native generateContent + responseSchema (the OpenAI-compat endpoint with
    // forced tool_choice fails in our deployment).
    let parsed: Record<string, unknown>;
    try {
      parsed = await generateStructured({
        system: SYSTEM_PROMPT,
        user: userPrompt,
        schema: TOOL.function.parameters,
        temperature: 0.3,
        timeoutMs: 50_000,
      });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
    const generationMs = Date.now() - startMs;

    // ---- 3. Sanitise + persist.
    const rawBlocks = Array.isArray(parsed?.blocks) ? parsed.blocks : [];
    const taskIdSet = new Set(tasks.map((t) => t.id));
    const blocks: Block[] = [];
    for (const b of rawBlocks.slice(0, MAX_BLOCKS)) {
      if (!b || typeof b !== "object") continue;
      const date = strSlice(b.date, 10);
      const startTime = strSlice(b.start_time, 80);
      const endTime = strSlice(b.end_time, 80);
      if (!date || !startTime || !endTime) continue;
      const kind = KIND_VALUES.includes(b.kind) ? b.kind : "shallow";
      const title = strSlice(b.title, 200);
      if (!title) continue;
      // Defense in depth — only honour task_id if it's actually one of
      // ours. Stops the model from hallucinating UUIDs.
      const taskId = typeof b.task_id === "string" && taskIdSet.has(b.task_id) ? b.task_id : null;
      const priority = ["high", "medium", "low"].includes(b.priority) ? b.priority : null;
      blocks.push({
        id: crypto.randomUUID(),
        date,
        start_time: startTime,
        end_time: endTime,
        kind,
        title,
        rationale: strSlice(b.rationale, 400) || "",
        task_id: taskId,
        priority,
        accepted: null,
        applied_event_id: null,
      });
    }

    // Mark any older draft proposals for the same range as superseded.
    await admin
      .from("schedule_proposals")
      .update({ status: "superseded" })
      .eq("user_id", user.id)
      .eq("range_start", rangeStart)
      .in("status", ["draft", "reviewed"]);

    const { data: ins, error: insErr } = await admin
      .from("schedule_proposals")
      .insert({
        user_id: user.id,
        range_start: rangeStart,
        range_end: rangeEnd,
        blocks,
        rationale: typeof parsed?.rationale === "string" ? parsed.rationale.slice(0, 4000) : null,
        model: MODEL,
        generation_ms: generationMs,
        input_snapshot: {
          timezone,
          deep_work_hours: body.deep_work_hours ?? null,
          constraints,
          task_count: tasks.length,
          event_count: events.length,
          checkin_count: checkins.length,
        },
      })
      .select("*")
      .single();
    if (insErr || !ins) return json({ error: insErr?.message || "insert failed" }, 500);

    return json({
      ok: true,
      proposal: ins,
      block_count: blocks.length,
    });
  } catch (err) {
    console.error("[propose-schedule] failed", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isInteger(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function todayIso(tz: string): string {
  // 'en-CA' formats dates as YYYY-MM-DD natively, which matches the
  // ISO date format the rest of the function expects. Falls back to
  // UTC if the timezone string is unsupported.
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function isoDate(s: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function strSlice(v: unknown, n: number): string {
  return typeof v === "string" ? v.slice(0, n) : "";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
