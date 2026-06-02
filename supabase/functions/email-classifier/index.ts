// Classifies recently-synced emails using Gemini Flash.
// Triggered: after gmail-sync, or via cron daily, or manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';
import { generateStructured } from '../_shared/geminiStructured.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You are a smart inbox triage assistant for a personal/household productivity app (DarAI).
For each email return ONE classification with a category, a suggested action, and a short reasoning.

Categories (pick the single best fit):
- bill            → invoices, recurring subscriptions, utility/rent/insurance bills, payment receipts
- meeting_request → contains a clear date/time for a meeting/call/appointment
- family_logistics→ school, kids, household chores, family scheduling
- travel          → flight/hotel/train bookings, itineraries, check-in reminders
- shopping        → order confirmations, deliveries, shipping updates
- newsletter      → marketing, promos, digests, "unsubscribe" footers
- personal        → friends, personal correspondence
- work            → work tasks, action items from colleagues
- note            → reference info worth saving (receipts of important info, login codes are NOT)
- other           → anything else

Suggested actions (pick the single best fit, or 'none'):
- create_contract → ONLY for bills/subscriptions/invoices that recur or have a clear vendor + amount
- create_event    → ONLY when there is a concrete date AND time
- create_task     → for actionable items (reply needed, deadline, errand, follow-up, family logistics)
- create_note     → for reference info the user will want to look up later
- none            → nothing actionable

Rules:
- Be CONSERVATIVE. If unsure, use 'none'. Confidence 0-1.
- Always write reasoning as ONE short sentence in the user's likely language (German if sender/subject is German, else English).
- For create_event include payload.start_iso (ISO 8601) and payload.title.
- For create_task include payload.title and optional payload.due_iso.
- For create_contract include payload.vendor and payload.amount if visible.
- For create_note include payload.title.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authenticate: accept either a logged-in user JWT (classify own emails)
    // or the service role key (cron/internal calls with explicit user_id).
    const authHeader = req.headers.get('Authorization') ?? '';
    const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;

    const body = await req.json().catch(() => ({}));
    const limit: number = Math.min(Math.max(Number(body.limit) || 25, 1), 200);
    const force: boolean = !!body.force; // re-classify even if a row already exists
    let user_id: string | undefined = body.user_id;

    if (!isServiceRole) {
      // Validate JWT and force user_id to the caller.
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      user_id = data.user.id;
    }

    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });

    // Fetch unclassified recent emails
    const { data: emails } = await supabase
      .from("user_emails")
      .select("id, subject, from_name, from_email, snippet, received_at")
      .eq("user_id", user_id)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (!emails?.length) {
      return new Response(JSON.stringify({ classified: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let todo = emails;
    if (!force) {
      const { data: existing } = await supabase
        .from("email_classifications")
        .select("email_id")
        .in("email_id", emails.map(e => e.id));
      const existingIds = new Set((existing ?? []).map(e => e.email_id));
      todo = emails.filter(e => !existingIds.has(e.id));
    }
    if (!todo.length) {
      return new Response(JSON.stringify({ classified: 0, skipped: emails.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build batch prompt
    const list = todo.map((e, i) =>
      `[${i}] from="${e.from_name || e.from_email}" subject="${e.subject || ""}" snippet="${(e.snippet || "").slice(0, 200)}"`
    ).join("\n");

    // Native generateContent + responseSchema (the OpenAI-compat endpoint with
    // forced tool_choice fails in our deployment).
    let parsed: { items?: Array<Record<string, unknown>> };
    try {
      parsed = await generateStructured({
        system: SYSTEM_PROMPT,
        user: `Classify these ${todo.length} emails:\n${list}`,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  category: { type: "string", enum: ["bill", "meeting_request", "family_logistics", "travel", "shopping", "newsletter", "personal", "work", "note", "other"] },
                  suggested_action: { type: "string", enum: ["create_contract", "create_event", "create_task", "create_note", "none"] },
                  confidence: { type: "number" },
                  reasoning: { type: "string" },
                  payload: {
                    type: "object",
                    description: "Extra fields needed to apply the action (title, start_iso, due_iso, vendor, amount, etc.)",
                    properties: {
                      title: { type: "string" },
                      start_iso: { type: "string" },
                      due_iso: { type: "string" },
                      vendor: { type: "string" },
                      amount: { type: "number" },
                      location: { type: "string" },
                    },
                  },
                },
                required: ["index", "category", "suggested_action", "confidence"],
              },
            },
          },
          required: ["items"],
        },
      });
    } catch (e) {
      console.error("AI gateway error", (e as Error).message);
      return new Response(JSON.stringify({ error: "AI failed" }), { status: 502, headers: corsHeaders });
    }
    const items = parsed?.items ?? [];

    const rows = items.map((it: Record<string, unknown>) => {
      const email = todo[it.index];
      if (!email) return null;
      return {
        user_id,
        email_id: email.id,
        category: it.category,
        suggested_action: it.suggested_action,
        confidence: it.confidence,
        reasoning: it.reasoning ?? null,
        suggested_payload: {
          subject: email.subject,
          from: email.from_email,
          from_name: email.from_name,
          received_at: email.received_at,
          ...(it.payload || {}),
        },
        status: 'pending',
      };
    }).filter(Boolean);

    if (rows.length) {
      const { error } = await supabase.from("email_classifications").upsert(rows, { onConflict: "email_id" });
      if (error) console.error("Insert error", error);
    }

    return new Response(JSON.stringify({ classified: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("classifier error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
