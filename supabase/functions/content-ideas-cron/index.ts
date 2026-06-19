// content-ideas-cron — the daily Content Studio dispatcher.
//
// Pinged every 15 minutes by the Railway scheduler (cron/scheduler.mjs). For
// each enabled creator profile we resolve the owner's local time and, once
// their `deliver_at` has passed and we haven't already generated today
// (last_generated_on), we generate the day's batch of ideas, store them, and
// notify the chosen channels (push + Telegram) so the creator wakes up to a
// fresh set of ideas. The "after deliver_at" check lets the job recover if the
// scheduler/runtime misses the exact 15-minute delivery window.
//
// Service-role only: manual "generate now" from the app uses `content-ideas`.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import {
  generateContentIdeas,
  type ContentIdea,
  type CreatorProfileLike,
  type IdeaSource,
} from "../_shared/contentIdeas.ts";
import {
  dateKeyInTimezone,
  recentHeadlines,
  persistDailyBatch,
  type ContentAdminClient,
} from "../_shared/contentPersist.ts";

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
  idea_source: string;
  ideas_per_day: number;
  trending_ratio: number;
  enabled: boolean;
  deliver_at: string;
  channels: string[];
  last_generated_on: string | null;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// For HTML attribute values (e.g. href): also escape double quotes, which would
// otherwise terminate the attribute and make Telegram reject the message.
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function partsIn(now: Date, tz: string) {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
    10,
  );
  const minute = parseInt(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(now),
    10,
  );
  const date = dateKeyInTimezone(now, tz);
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

interface TzRow {
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
  ((profiles as TzRow[]) || []).forEach((p) => {
    if (p.timezone) map.set(p.user_id, p.timezone);
  });
  ((locs as TzRow[]) || []).forEach((l) => {
    if (l.timezone) map.set(l.user_id, l.timezone);
  });
  return map;
}

function deliveryMinuteOfDay(deliverAt: string | null | undefined): number {
  const [rawHour, rawMinute] = (deliverAt || "08:00").split(":");
  const hour = parseInt(rawHour, 10);
  const minute = parseInt(rawMinute, 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return 8 * 60;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return hour * 60;
  return hour * 60 + minute;
}

function shouldGenerateToday(
  p: ProfileRow,
  parts: { hour: number; minute: number; date: string },
): boolean {
  if (p.last_generated_on === parts.date) return false;
  return parts.hour * 60 + parts.minute >= deliveryMinuteOfDay(p.deliver_at);
}

async function tgSend(chatId: number, text: string): Promise<boolean> {
  if (!TELEGRAM_API_KEY) return false;
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

async function sendPush(userId: string, title: string, body: string): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ user_ids: [userId], title, body, data: { type: "content_ideas" } }),
    });
    if (!res.ok) {
      console.error("sendPush failed", res.status, await res.text());
      return false;
    }
    const payload = await res.json().catch(() => ({}));
    if (payload?.success === false || Number(payload?.sent ?? 0) < 1) {
      console.error("sendPush reported no delivery", payload);
      return false;
    }
    return true;
  } catch (e) {
    console.error("sendPush threw", e);
    return false;
  }
}

// Telegram caps messages at 4096 chars; stay under it with headroom so the
// short footer always fits on the last message.
const TG_MESSAGE_LIMIT = 3900;

function buildTelegramMessages(ideas: ContentIdea[]): string[] {
  const header = "<b>💡 Your content ideas for today</b>";
  if (!ideas.length) return [`${header}\n\nNo ideas generated — check your creator profile.`];

  const blocks = ideas.map((i) => {
    const tag = i.kind === "current" ? "🔥" : "♻️";
    const title = i.source_url
      ? `<a href="${escapeAttr(i.source_url)}">${escapeHtml(i.headline)}</a>`
      : escapeHtml(i.headline);
    const lines = [`${tag} <b>${title}</b>`];
    if (i.hook) lines.push(`<i>${escapeHtml(i.hook)}</i>`);
    if (i.summary) lines.push(escapeHtml(i.summary));
    return lines.join("\n");
  });

  // Pack idea blocks into as few messages as fit under the length cap. With the
  // longer spoken summaries a full batch no longer fits in one message.
  const messages: string[] = [];
  let current = header;
  for (const block of blocks) {
    const next = `${current}\n\n${block}`;
    if (next.length > TG_MESSAGE_LIMIT && current !== header) {
      messages.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  messages.push(`${current}\n\nOpen the app to like, script, and schedule them.`);
  return messages;
}

function buildPushBody(ideas: ContentIdea[]): string {
  if (!ideas.length) return "Open Content Studio to generate ideas.";
  return ideas
    .slice(0, 4)
    .map((i) => `• ${i.headline}`)
    .join("\n")
    .slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (authHeader !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const contentAdmin = supabase as unknown as ContentAdminClient;

  const { data, error } = await supabase.from("creator_profiles").select("*").eq("enabled", true);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const profiles = (data || []) as ProfileRow[];

  const now = new Date();
  const tzMap = await loadTimezoneMap(
    supabase,
    profiles.map((p) => p.user_id),
  );
  const tzOf = (uid: string) => tzMap.get(uid) || "UTC";

  // Decide who is due before doing any expensive LLM work.
  const due = profiles.filter((p) => {
    return shouldGenerateToday(p, localParts(now, tzOf(p.user_id)));
  });

  const dueIds = due.map((p) => p.user_id);
  const chatMap = new Map<string, number>();
  const locMap = new Map<string, { city: string | null; country: string | null }>();
  if (dueIds.length > 0) {
    const [{ data: links }, { data: locProfiles }] = await Promise.all([
      supabase
        .from("telegram_links")
        .select("user_id, chat_id, is_active")
        .in("user_id", dueIds)
        .eq("is_active", true)
        .not("chat_id", "is", null),
      supabase
        .from("profiles")
        .select("user_id, location_city, location_country")
        .in("user_id", dueIds),
    ]);
    ((links as Array<{ user_id: string; chat_id?: number | null }>) || []).forEach((l) => {
      if (l.chat_id) chatMap.set(l.user_id, Number(l.chat_id));
    });
    (
      (locProfiles as Array<{
        user_id: string;
        location_city: string | null;
        location_country: string | null;
      }>) || []
    ).forEach((p) => {
      locMap.set(p.user_id, { city: p.location_city, country: p.location_country });
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  async function dispatchOne(p: ProfileRow) {
    try {
      const { date } = localParts(now, tzOf(p.user_id));
      const channels = Array.isArray(p.channels) ? p.channels : [];
      const wantsTelegram = channels.includes("telegram");
      const wantsPush = channels.includes("push");
      const selectedDeliveryChannels = [
        wantsTelegram ? "telegram" : null,
        wantsPush ? "push" : null,
      ].filter(Boolean);
      const chatId = chatMap.get(p.user_id);

      if (
        selectedDeliveryChannels.length > 0 &&
        !wantsPush &&
        wantsTelegram &&
        (!TELEGRAM_API_KEY || !chatId)
      ) {
        throw new Error(
          !TELEGRAM_API_KEY
            ? "telegram channel selected but TELEGRAM_API_KEY is not configured"
            : "telegram channel selected but no active Telegram chat link was found",
        );
      }

      const profileLike: CreatorProfileLike = {
        persona: p.persona,
        tone: p.tone,
        topics: p.topics,
        audience: p.audience,
        business_context: p.business_context,
        platforms: p.platforms,
        primary_language: p.primary_language,
      };
      const avoid = await recentHeadlines(contentAdmin, p.user_id, 7);
      const ideas = await generateContentIdeas(profileLike, locMap.get(p.user_id), {
        count: p.ideas_per_day || 10,
        trendingRatio: p.trending_ratio ?? 0.5,
        ideaSource: (["mixed", "trending", "knowledge"].includes(p.idea_source)
          ? p.idea_source
          : "mixed") as IdeaSource,
        language: p.primary_language,
        avoidHeadlines: avoid,
      });
      await persistDailyBatch(contentAdmin, p.user_id, ideas, date);

      const deliveredChannels: string[] = [];
      const deliveryErrors: string[] = [];
      if (wantsTelegram) {
        if (!TELEGRAM_API_KEY) {
          deliveryErrors.push("telegram: TELEGRAM_API_KEY is not configured");
        } else if (!chatId) {
          deliveryErrors.push("telegram: no active Telegram chat link was found");
        } else {
          const messages = buildTelegramMessages(ideas);
          // Sequential on purpose: keeps the ideas in order in the chat.
          let telegramOk = true;
          for (let i = 0; i < messages.length; i++) {
            const ok = await tgSend(chatId, messages[i]);
            if (!ok) {
              telegramOk = false;
              deliveryErrors.push(`telegram: failed at message ${i + 1}/${messages.length}`);
              break;
            }
          }
          if (telegramOk) deliveredChannels.push("telegram");
        }
      }
      if (wantsPush) {
        const ok = await sendPush(p.user_id, "💡 Today's content ideas", buildPushBody(ideas));
        if (ok) deliveredChannels.push("push");
        else deliveryErrors.push("push: in-app notification delivery failed");
      }
      if (selectedDeliveryChannels.length > 0 && deliveredChannels.length === 0) {
        throw new Error(`no selected delivery channel succeeded (${deliveryErrors.join("; ")})`);
      }

      // Stamp after at least one selected notification channel succeeds. If no
      // selected channel delivers, the user remains eligible for a later retry
      // instead of silently losing the day's suggestions.
      const { error: stampErr } = await supabase
        .from("creator_profiles")
        .update({ last_generated_on: date, updated_at: new Date().toISOString() })
        .eq("user_id", p.user_id);
      if (stampErr) throw new Error(stampErr.message);

      sent++;
      console.log("content-ideas dispatched", {
        user_id: p.user_id,
        generated_on: date,
        channels: deliveredChannels,
        warnings: deliveryErrors,
        ideas: ideas.length,
      });
    } catch (e) {
      failed++;
      errors.push(`${p.user_id}: ${e instanceof Error ? e.message : String(e)}`);
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
