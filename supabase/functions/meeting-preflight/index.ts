// Generates a 30-second pre-meeting brief 15 min before each meeting.
// Pulls: attendee context, last contact note, related emails, related contracts.
// Saves to meeting_briefs and pushes via Telegram if configured.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");


async function generateBrief(event: Record<string, unknown>, ctx: Record<string, unknown>): Promise<string> {
  const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: "Generate a sharp 30-second pre-meeting brief. 3-5 bullets max. Include: who you're meeting, last interaction summary, open threads, key context. Be concise and actionable." },
        { role: "user", content: `Meeting: "${event.title}" at ${event.start_time}\nLocation: ${event.location || 'N/A'}\nDescription: ${event.description || 'none'}\n\nRelevant context:\n${JSON.stringify(ctx)}` },
      ],
    }),
  });
  if (!resp.ok) return "Brief unavailable.";
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "Brief unavailable.";
}

async function sendTelegramBrief(chatId: number, eventTitle: string, brief: string) {
  if (!TELEGRAM_API_KEY) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: `📋 <b>Meeting in 15 min: ${eventTitle}</b>\n\n${brief}`,
      parse_mode: "HTML",
    }),
  }).catch(e => console.error("telegram brief send", e));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal/cron only: the gateway does not verify JWTs for /functions/v1,
  // so require the service-role bearer in code (matches the *-cron siblings).
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const now = new Date();
    const windowStart = new Date(now.getTime() + 10 * 60_000).toISOString();
    const windowEnd = new Date(now.getTime() + 20 * 60_000).toISOString();

    // Find meetings starting in 10–20 min that don't have a brief yet
    const { data: events } = await supabase
      .from("events")
      .select("id, user_id, title, start_time, end_time, location, description, attendees")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd);

    if (!events?.length) {
      return new Response(JSON.stringify({ generated: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: existing } = await supabase
      .from("meeting_briefs").select("event_id").in("event_id", events.map(e => e.id));
    const existingIds = new Set((existing ?? []).map(e => e.event_id));
    const todo = events.filter(e => !existingIds.has(e.id));

    let generated = 0;
    for (const ev of todo) {
      // Gather context
      const [contactsRes, emailsRes, contractsRes, profileRes] = await Promise.all([
        supabase.from("user_contacts").select("id, name, last_contacted_at, notes").eq("user_id", ev.user_id).limit(5),
        supabase.from("user_emails").select("id, subject, from_name, snippet").eq("user_id", ev.user_id).order("received_at", { ascending: false }).limit(5),
        supabase.from("contracts").select("id, name, provider").eq("user_id", ev.user_id).limit(5),
        supabase.from("profiles").select("telegram_chat_id").eq("user_id", ev.user_id).maybeSingle(),
      ]);

      // Match attendees by name
      const attendeeNames = (ev.attendees ?? []).map((a: string) => a.toLowerCase());
      const matched = (contactsRes.data ?? []).filter(c =>
        attendeeNames.some((n: string) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()))
      );

      const ctx = { matched_contacts: matched, recent_emails: emailsRes.data ?? [], contracts: contractsRes.data ?? [] };
      const brief = await generateBrief(ev, ctx);

      const { error } = await supabase.from("meeting_briefs").insert({
        user_id: ev.user_id,
        event_id: ev.id,
        brief_text: brief,
        attendees: ev.attendees ?? [],
        related_contacts: matched,
        related_emails: emailsRes.data ?? [],
        related_contracts: contractsRes.data ?? [],
        delivered_at: new Date().toISOString(),
        delivered_channel: profileRes.data?.telegram_chat_id ? "telegram" : "web",
      });
      if (error) { console.error("brief insert err", error); continue; }

      const chatId = (profileRes.data as Record<string, unknown>)?.telegram_chat_id;
      if (chatId) await sendTelegramBrief(chatId, ev.title, brief);
      generated++;
    }

    return new Response(JSON.stringify({ generated, candidates: todo.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("meeting-preflight error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
