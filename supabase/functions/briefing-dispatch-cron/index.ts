// Custom Daily Briefings dispatcher.
//
// Triggered every 15 minutes by pg_cron. For each enabled briefing we resolve
// the owner's local time and, when the briefing's `deliver_at` falls in the
// current 15-minute window on an active weekday (and hasn't already been sent
// today), we curate news for its topics and deliver to the chosen channels
// (Telegram and/or push). Mirrors the timezone-aware pattern used by
// `telegram-weekly-briefing`.
//
// Two entry modes:
//   1. Service-role bearer (pg_cron)          → evaluate all briefings by time.
//   2. End-user JWT + ?briefing_id=<id>       → "Send now" test for one briefing
//      the caller owns, bypassing the time/day checks.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateNews, type NewsItem } from "../_shared/briefingNews.ts";
import { defaultBriefingVoiceLimit, sendVoiceMessage } from "../_shared/telegram-voice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

const CONCURRENCY = 5;
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface BriefingRow {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  topics: string[];
  deliver_at: string; // "HH:MM:SS"
  days_of_week: number[];
  channels: string[];
  max_items: number;
  last_sent_on: string | null;
}

interface ProfileContext {
  city: string | null;
  country: string | null;
  locale?: string | null;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function localParts(now: Date, tz: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
    10,
  );
  const minute = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(now),
    10,
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return { dayIndex: WEEKDAY_INDEX[weekday] ?? 0, hour, minute, date };
}

interface TimezoneRow {
  user_id: string;
  timezone?: string | null;
}

async function loadTimezoneMap(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const [{ data: locs }, { data: profiles }] = await Promise.all([
    supabase.from("user_location_settings").select("user_id, timezone").in("user_id", userIds),
    supabase.from("profiles").select("user_id, timezone").in("user_id", userIds),
  ]);
  ((profiles as TimezoneRow[]) || []).forEach((p) => {
    if (p.timezone) map.set(p.user_id, p.timezone);
  });
  // Location settings win over profile when both exist.
  ((locs as TimezoneRow[]) || []).forEach((l) => {
    if (l.timezone) map.set(l.user_id, l.timezone);
  });
  return map;
}

async function tgSend(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_API_KEY) {
    console.error("TELEGRAM_API_KEY not configured; skipping Telegram send");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error("tgSend failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("tgSend threw", e);
    return false;
  }
}

// Briefings send Telegram text/voice themselves, so mark the compatibility
// wrapper call to suppress push-delivery's generic Telegram fallback.
async function sendPush(
  userId: string,
  title: string,
  body: string,
  briefingId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        user_ids: [userId],
        title,
        body,
        data: { type: "briefing", briefing_id: briefingId, suppress_telegram: true },
      }),
    });
    if (!res.ok) {
      console.error("sendPush failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendPush threw", e);
    return false;
  }
}

function buildTelegramMessage(name: string, items: NewsItem[]): string {
  const lines: string[] = [`<b>🗞 ${escapeHtml(name)}</b>`];
  if (!items.length) {
    lines.push("\nNo notable updates on your topics right now.");
    return lines.join("\n");
  }
  for (const item of items) {
    lines.push(`\n• <b><a href="${item.url}">${escapeHtml(item.headline)}</a></b>`);
    if (item.summary) lines.push(`  ${escapeHtml(item.summary)}`);
  }
  return lines.join("\n");
}

function buildPushBody(items: NewsItem[]): string {
  if (!items.length) return "No notable updates on your topics right now.";
  return items
    .map((i) => `• ${i.headline}`)
    .join("\n")
    .slice(0, 500);
}

function buildNewsVoiceScript(name: string, items: NewsItem[]): string {
  if (!items.length) {
    return `${name}. No notable updates on your topics right now. I am sending the text version too, so you can check it later.`;
  }

  const top = items.slice(0, 5);
  const lines = [
    `${name}. Here are your top ${top.length} news update${top.length === 1 ? "" : "s"} today.`,
  ];
  top.forEach((item, idx) => {
    const summary = (item.summary || "").replace(/\s+/g, " ").trim();
    lines.push(`Story ${idx + 1}: ${item.headline}. ${summary}`.trim());
  });
  lines.push("I am sending the links in text as well.");
  return lines.join(" ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);
  const briefingIdParam = url.searchParams.get("briefing_id");
  const isServiceCall = authHeader === `Bearer ${SERVICE_KEY}`;

  // ---- Resolve which briefings to evaluate ----
  let briefings: BriefingRow[] = [];

  if (isServiceCall) {
    // Cron path: all enabled briefings (or one, when briefing_id is forced).
    let query = supabase.from("briefings").select("*").eq("enabled", true);
    if (briefingIdParam) query = query.eq("id", briefingIdParam);
    const { data, error } = await query;
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    briefings = (data || []) as BriefingRow[];
  } else {
    // End-user "Send now": requires a briefing_id the caller owns.
    if (!briefingIdParam) {
      return new Response(JSON.stringify({ error: "briefing_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await supabase
      .from("briefings")
      .select("*")
      .eq("id", briefingIdParam)
      .maybeSingle();
    if (error || !data || data.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    briefings = [data as BriefingRow];
  }

  // A forced single-briefing call (test send, or service force) bypasses time checks.
  const force = !!briefingIdParam;
  const now = new Date();
  const tzMap = await loadTimezoneMap(
    supabase,
    briefings.map((b) => b.user_id),
  );
  const tzOf = (uid: string) => tzMap.get(uid) || "UTC";

  // Decide which briefings are due before doing any LLM work.
  const due = briefings.filter((b) => {
    if (force) return true;
    const { dayIndex, hour, minute, date } = localParts(now, tzOf(b.user_id));
    if (!Array.isArray(b.days_of_week) || !b.days_of_week.includes(dayIndex)) return false;
    const [bh, bm] = (b.deliver_at || "08:00").split(":").map((n) => parseInt(n, 10));
    if (bh !== hour) return false;
    if (Math.floor(bm / 15) !== Math.floor(minute / 15)) return false;
    if (b.last_sent_on === date) return false;
    return true;
  });

  // Resolve Telegram chat IDs for the due users in one query.
  const dueIds = due.map((b) => b.user_id);
  const chatMap = new Map<string, number>();
  if (dueIds.length > 0) {
    const { data: links } = await supabase
      .from("telegram_links")
      .select("user_id, chat_id, is_active")
      .in("user_id", dueIds)
      .eq("is_active", true)
      .not("chat_id", "is", null);
    ((links as Array<{ user_id: string; chat_id?: number | null }>) || []).forEach((l) => {
      if (l.chat_id) chatMap.set(l.user_id, Number(l.chat_id));
    });
  }

  // Resolve locations for nicer, localised news.
  const locMap = new Map<string, ProfileContext>();
  if (dueIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, location_city, location_country, locale")
      .in("user_id", dueIds);
    (
      (profiles as Array<{
        user_id: string;
        location_city: string | null;
        location_country: string | null;
        locale?: string | null;
      }>) || []
    ).forEach((p) => {
      locMap.set(p.user_id, {
        city: p.location_city,
        country: p.location_country,
        locale: p.locale,
      });
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  async function dispatchOne(b: BriefingRow) {
    try {
      const items = await generateNews(b.topics || [], locMap.get(b.user_id), b.max_items || 5);
      const channels = b.channels || [];
      const channelsSent: string[] = [];

      const chatId = chatMap.get(b.user_id);
      const telegramText = buildTelegramMessage(b.name, items);
      const wantsTelegramText =
        channels.includes("telegram") || channels.includes("telegram_voice");

      if (channels.includes("telegram_voice") && chatId && TELEGRAM_API_KEY) {
        const voice = await sendVoiceMessage({
          chatId,
          script: buildNewsVoiceScript(b.name, items),
          fallbackText: telegramText,
          caption: `🗞 ${b.name} — voice summary`,
          locale: locMap.get(b.user_id)?.locale,
          telegramKey: TELEGRAM_API_KEY,
          maxChars: defaultBriefingVoiceLimit(),
          sendFallbackText: false,
        });
        if (voice.sent === "voice" || voice.sent === "audio") channelsSent.push("telegram_voice");
      }

      if (wantsTelegramText) {
        if (chatId) {
          const ok = await tgSend(chatId, telegramText);
          if (ok) channelsSent.push("telegram");
        }
      }
      if (channels.includes("push")) {
        const ok = await sendPush(b.user_id, `🗞 ${b.name}`, buildPushBody(items), b.id);
        if (ok) channelsSent.push("push");
      }

      // Record delivery + stamp local send date for dedupe.
      const { date } = localParts(now, tzOf(b.user_id));
      await supabase.from("briefing_deliveries").insert({
        briefing_id: b.id,
        user_id: b.user_id,
        content: items,
        channels_sent: channelsSent,
        status: channelsSent.length ? "sent" : "no_channel",
      });
      if (!force) {
        await supabase.from("briefings").update({ last_sent_on: date }).eq("id", b.id);
      }

      if (channelsSent.length) sent++;
      else {
        failed++;
        errors.push(`${b.id}: no channel delivered`);
      }
    } catch (e) {
      failed++;
      errors.push(`${b.id}: ${e instanceof Error ? e.message : String(e)}`);
      console.error("briefing dispatch failed for", b.id, e);
    }
  }

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(dispatchOne));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      evaluated: briefings.length,
      due: due.length,
      sent,
      failed,
      errors,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
