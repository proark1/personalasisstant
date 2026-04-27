// Classifies recently-synced emails using Lovable AI Gemini Flash.
// Triggered: after gmail-sync, or via cron daily, or manually.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT = `You classify emails for a personal assistant. Return one classification per email.
Categories: bill, meeting_request, family_logistics, newsletter, personal, work, other.
Suggested actions: create_contract (only for bills/invoices/subscriptions), create_event (for meeting requests with clear time), create_task (for family logistics or actionable work), none.
Be conservative — only suggest actions when clearly warranted. Confidence 0-1.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Authenticate: accept either a logged-in user JWT (classify own emails)
    // or the service role key (cron/internal calls with explicit user_id).
    const authHeader = req.headers.get('Authorization') ?? '';
    const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;

    const body = await req.json().catch(() => ({}));
    const limit: number = body.limit ?? 25;
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

    const { data: existing } = await supabase
      .from("email_classifications")
      .select("email_id")
      .in("email_id", emails.map(e => e.id));
    const existingIds = new Set((existing ?? []).map(e => e.email_id));
    const todo = emails.filter(e => !existingIds.has(e.id));
    if (!todo.length) {
      return new Response(JSON.stringify({ classified: 0, skipped: emails.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build batch prompt
    const list = todo.map((e, i) =>
      `[${i}] from="${e.from_name || e.from_email}" subject="${e.subject || ""}" snippet="${(e.snippet || "").slice(0, 200)}"`
    ).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Classify these ${todo.length} emails:\n${list}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_classifications",
            description: "Save classification for each email by index",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      category: { type: "string", enum: ["bill", "meeting_request", "family_logistics", "newsletter", "personal", "work", "other"] },
                      suggested_action: { type: "string", enum: ["create_contract", "create_event", "create_task", "none"] },
                      confidence: { type: "number" },
                      reasoning: { type: "string" },
                    },
                    required: ["index", "category", "suggested_action", "confidence"],
                  },
                },
              },
              required: ["items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_classifications" } },
      }),
    });

    if (!aiResp.ok) {
      const err = await aiResp.text();
      console.error("AI gateway error", aiResp.status, err);
      return new Response(JSON.stringify({ error: "AI failed", status: aiResp.status }), { status: 502, headers: corsHeaders });
    }

    const aiData = await aiResp.json();
    const args = aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    const items = parsed?.items ?? [];

    const rows = items.map((it: any) => {
      const email = todo[it.index];
      if (!email) return null;
      return {
        user_id,
        email_id: email.id,
        category: it.category,
        suggested_action: it.suggested_action,
        confidence: it.confidence,
        reasoning: it.reasoning ?? null,
        suggested_payload: { subject: email.subject, from: email.from_email },
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
