// content-ideas-cron — the daily Content Studio dispatcher.
//
// Pinged every 15 minutes by the Railway scheduler (cron/scheduler.mjs). For
// each enabled creator profile we resolve the owner's local time and, when
// their `deliver_at` falls in the current 15-minute window and we haven't
// already generated today (last_generated_on), we generate the day's batch of
// ideas, store them, and notify the chosen channels (push + Telegram) so the
// creator wakes up to a fresh set of ideas. Mirrors the timezone-aware pattern
// of briefing-dispatch-cron.
//
// Service-role only: manual "generate now" from the app uses `content-ideas`.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateContentIdeas, type ContentIdea, type CreatorProfileLike } from "../_shared/contentIdeas.ts";
import { recentHeadlines, persistDailyBatch } from "../_shared/contentPersist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

const CONCURRENCY = 3;

interface ProfileRow {
  user_id: string;
  persona: string;
  tone: string[];
  topics: string[];
  audience: string;
  business_context: string;
  platforms: string[];
  primary_language: string;
  ideas_per_day: number;
  trending_ratio: number;
  enabled: boolean;
  deliver_at: string;
  channels: string[];
  last_generated_on: string | null;
}

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function partsIn(now: Date, tz: string) {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now), 10,
  );
  const minute = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(now), 10,
  );
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  return { hour, minute, date };
}

// A malformed timezone (bad profile/location data) makes Intl.DateTimeFormat
// throw a RangeError. This runs in the top-level `due` filter, so without a
// guard one bad row would crash the whole cron tick for every user. Fall back
// to UTC instead.
function localParts(now: Date, tz: string) {
  try {
    return partsIn(now, tz);
  } catch {
    return partsIn(now, "UTC");
  }
}

async function loadTimezoneMap(supabase: any, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const [{ data: locs }, { data: profiles }] = await Promise.all([
    supabase.from("user_location_settings").select("user_id, timezone").in("user_id", userIds),
    supabase.from("profiles").select("user_id, timezone").in("user_id", userIds),
  ]);
  (profiles || []).forEach((p: any) => { if (p.timezone) map.set(p.user_id, p.timezone); });
  (locs || []).forEach((l: any) => { if (l.timezone) map.set(l.user_id, l.timezone); });
  return map;
}

async function tgSend(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_API_KEY) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!res.ok) { console.error("tgSend failed", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("tgSend threw", e);
    return false;
  }
}

async function sendPush(userId: string, title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ user_ids: [userId], title, body, data: { type: "content_ideas" } }),
    });
    if (!res.ok) { console.error("sendPush failed", res.status, await res.text()); return false; }
    return true;
  } catch (e) {
    console.error("sendPush threw", e);
    return false;
  }
}

function buildTelegramMessage(ideas: ContentIdea[]): string {
  const lines: string[] = ["<b>💡 Your content ideas for today</b>"];
  if (!ideas.length) { lines.push("\nNo ideas generated — check your creator profile."); return lines.join("\n"); }
  for (const i of ideas) {
    const tag = i.kind === "current" ? "🔥" : "♻️";
    const title = i.source_url
      ? `<a href="${i.source_url}">${escapeHtml(i.headline)}</a>`
      : escapeHtml(i.headline);
    lines.push(`\n${tag} <b>${title}</b>`);
    if (i.hook) lines.push(`  <i>${escapeHtml(i.hook)}</i>`);
  }
  lines.push("\nOpen the app to like, script, and schedule them.");
  return lines.join("\n");
}

function buildPushBody(ideas: ContentIdea[]): string {
  if (!ideas.length) return "Open Content Studio to generate ideas.";
  return ideas.slice(0, 4).map((i) => `• ${i.headline}`).join("\n").slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await supabase.from("creator_profiles").select("*").eq("enabled", true);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const profiles = (data || []) as ProfileRow[];

  const now = new Date();
  const tzMap = await loadTimezoneMap(supabase, profiles.map((p) => p.user_id));
  const tzOf = (uid: string) => tzMap.get(uid) || "UTC";

  // Decide who is due before doing any expensive LLM work.
  const due = profiles.filter((p) => {
    const { hour, minute, date } = localParts(now, tzOf(p.user_id));
    const [bh, bm] = (p.deliver_at || "08:00").split(":").map((n) => parseInt(n, 10));
    if (bh !== hour) return false;
    if (Math.floor(bm / 15) !== Math.floor(minute / 15)) return false;
    if (p.last_generated_on === date) return false;
    return true;
  });

  const dueIds = due.map((p) => p.user_id);
  const chatMap = new Map<string, number>();
  const locMap = new Map<string, any>();
  if (dueIds.length > 0) {
    const [{ data: links }, { data: locProfiles }] = await Promise.all([
      supabase.from("telegram_links").select("user_id, chat_id, is_active")
        .in("user_id", dueIds).eq("is_active", true).not("chat_id", "is", null),
      supabase.from("profiles").select("user_id, location_city, location_country").in("user_id", dueIds),
    ]);
    (links || []).forEach((l: any) => { if (l.chat_id) chatMap.set(l.user_id, Number(l.chat_id)); });
    (locProfiles || []).forEach((p: any) => {
      locMap.set(p.user_id, { city: p.location_city, country: p.location_country });
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  async function dispatchOne(p: ProfileRow) {
    try {
      const { date } = localParts(now, tzOf(p.user_id));
      const profileLike: CreatorProfileLike = {
        persona: p.persona,
        tone: p.tone,
        topics: p.topics,
        audience: p.audience,
        business_context: p.business_context,
        platforms: p.platforms,
        primary_language: p.primary_language,
      };
      const avoid = await recentHeadlines(supabase, p.user_id, 7);
      const ideas = await generateContentIdeas(
        profileLike, locMap.get(p.user_id), p.ideas_per_day || 10, p.trending_ratio ?? 0.5, avoid,
      );
      await persistDailyBatch(supabase, p.user_id, ideas, date);
      // Throw on failure: if we can't stamp last_generated_on, this user stays
      // "due" and would be regenerated every tick (wasted quota + notify spam).
      // dispatchOne runs inside a per-user catch, so this won't affect others.
      const { error: stampErr } = await supabase.from("creator_profiles")
        .update({ last_generated_on: date, updated_at: new Date().toISOString() })
        .eq("user_id", p.user_id);
      if (stampErr) throw new Error(stampErr.message);

      const channels = p.channels || [];
      if (channels.includes("telegram")) {
        const chatId = chatMap.get(p.user_id);
        if (chatId) await tgSend(chatId, buildTelegramMessage(ideas));
      }
      if (channels.includes("push")) {
        await sendPush(p.user_id, "💡 Today's content ideas", buildPushBody(ideas));
      }
      sent++;
    } catch (e: any) {
      failed++;
      errors.push(`${p.user_id}: ${e?.message || String(e)}`);
      console.error("content-ideas dispatch failed for", p.user_id, e);
    }
  }

  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(dispatchOne));
  }

  return new Response(
    JSON.stringify({ ok: true, evaluated: profiles.length, due: due.length, sent, failed, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
