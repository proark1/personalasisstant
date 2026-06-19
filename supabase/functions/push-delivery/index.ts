import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUserQuietNow } from "../_shared/dori-quiet.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

async function sendTelegram(chatId: number, title: string, body: string) {
  if (!TELEGRAM_API_KEY) return { ok: false, error: "telegram not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>${title}</b>\n${body}`,
        parse_mode: "HTML",
      }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  categoryId?: string;
}

interface ExpoPushTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Service key auth gate
  const authHeader = req.headers.get("Authorization");
  const supabaseServiceKeyCheck = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKeyCheck}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { reminder_id, user_ids, title, body, data, priority = "high" } = await req.json();

    let targetUserIds: string[] = [];
    let reminderData: Record<string, unknown> | null = null;

    // If reminder_id provided, fetch the reminder details
    if (reminder_id) {
      const { data: reminder, error } = await supabase
        .from("proactive_reminders")
        .select("*")
        .eq("id", reminder_id)
        .single();

      if (error || !reminder) {
        console.error("Reminder not found:", reminder_id);
        return new Response(JSON.stringify({ error: "Reminder not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      reminderData = reminder;
      targetUserIds = [reminder.user_id];
    } else if (user_ids && user_ids.length > 0) {
      targetUserIds = user_ids;
    } else {
      return new Response(JSON.stringify({ error: "Must provide reminder_id or user_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending push notifications to ${targetUserIds.length} users`);

    const results: Record<string, unknown>[] = [];
    const errors: string[] = [];

    for (const userId of targetUserIds) {
      // Gate every channel (push + Telegram) through the shared quiet check
      // so focus mode, tz-aware quiet hours, and "busy in a meeting" all
      // silence us uniformly. Respect-events can be relaxed later for the
      // meeting-preflight caller that NEEDS to fire during a meeting window.
      const quiet = await isUserQuietNow(supabase, userId);
      if (quiet.quiet) {
        console.log(`push-delivery: skipping ${userId} — ${quiet.reason}`);
        results.push({ userId, skipped: true, reason: quiet.reason });
        continue;
      }

      // Get user's proactive settings
      const { data: settings } = await supabase
        .from("proactive_settings")
        .select("push_notifications_enabled, in_app_notifications_enabled")
        .eq("user_id", userId)
        .single();

      const pushEnabled = settings?.push_notifications_enabled ?? true;
      const inAppEnabled = settings?.in_app_notifications_enabled ?? true;

      // Get user's Expo push tokens
      const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, expo_push_token, platform")
        .eq("user_id", userId);

      const notificationTitle = reminderData?.title || title;
      const notificationBody = reminderData?.message || body;
      const notificationData = { ...asRecord(reminderData?.metadata || data) };
      const suppressTelegram = notificationData.suppress_telegram === true;
      delete notificationData.suppress_telegram;

      // Add reminder_id to data for handling
      if (reminder_id) {
        notificationData.reminder_id = reminder_id;
        notificationData.reminder_type = reminderData?.reminder_type;
        notificationData.trigger_entity_type = reminderData?.trigger_entity_type;
        notificationData.trigger_entity_id = reminderData?.trigger_entity_id;
      }

      // Get user's settings (telegram + group toggles)
      const { data: fullSettings } = await supabase
        .from("proactive_settings")
        .select("telegram_proactive_enabled, telegram_group_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      const telegramEnabled = fullSettings?.telegram_proactive_enabled !== false;
      const groupEnabled = fullSettings?.telegram_group_enabled !== false;

      // Telegram delivery — prefer family group, fall back to personal 1:1
      if (telegramEnabled && !suppressTelegram) {
        let chatId: number | null = null;
        let channelLabel = "telegram";
        if (groupEnabled) {
          const { data: glink } = await supabase
            .from("telegram_group_links")
            .select("chat_id")
            .eq("owner_user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          if (glink?.chat_id) {
            chatId = Number(glink.chat_id);
            channelLabel = "telegram_group";
          }
        }
        if (!chatId) {
          const { data: link } = await supabase
            .from("telegram_links")
            .select("chat_id")
            .eq("user_id", userId)
            .eq("is_active", true)
            .maybeSingle();
          if (link?.chat_id) chatId = Number(link.chat_id);
        }
        if (chatId) {
          const tgRes = await sendTelegram(chatId, notificationTitle, notificationBody);
          await supabase.from("reminder_delivery_log").insert({
            user_id: userId,
            reminder_id: reminder_id || null,
            delivery_channel: channelLabel,
            delivery_status: tgRes.ok ? "sent" : "failed",
            error_message: tgRes.ok ? null : tgRes.error || JSON.stringify(tgRes.data),
            sent_at: new Date().toISOString(),
          });
          if (tgRes.ok) {
            results.push({ user_id: userId, channel: channelLabel, status: "sent" });
          } else {
            errors.push(`Telegram failed for ${userId}: ${tgRes.error || "unknown"}`);
          }
        }
      }

      // Send Expo Push Notifications
      if (pushEnabled && tokens && tokens.length > 0) {
        for (const tokenRecord of tokens) {
          // Use expo_push_token if available, otherwise try the regular token
          const pushToken = tokenRecord.expo_push_token || tokenRecord.token;

          // Check if it's a valid Expo push token format
          if (
            !pushToken ||
            (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken["))
          ) {
            console.log(`Skipping non-Expo token for user ${userId}`);
            continue;
          }

          const message: ExpoPushMessage = {
            to: pushToken,
            title: notificationTitle,
            body: notificationBody,
            data: notificationData,
            sound: "default",
            priority: reminderData?.priority === "urgent" ? "high" : priority,
            badge: 1,
          };

          try {
            const response = await fetch(EXPO_PUSH_URL, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(message),
            });

            const result = await response.json();
            console.log("Expo push result:", JSON.stringify(result));

            // Log the delivery attempt
            const ticket = result.data?.[0] as ExpoPushTicket;

            await supabase.from("reminder_delivery_log").insert({
              user_id: userId,
              reminder_id: reminder_id || null,
              delivery_channel: "push",
              delivery_status: ticket?.status === "ok" ? "sent" : "failed",
              expo_push_ticket: ticket?.id || null,
              error_message:
                ticket?.status === "error" ? ticket.message || ticket.details?.error : null,
              sent_at: new Date().toISOString(),
            });

            if (ticket?.status === "ok") {
              results.push({
                user_id: userId,
                channel: "push",
                status: "sent",
                ticket_id: ticket.id,
              });
            } else {
              errors.push(`Push failed for ${userId}: ${ticket?.message || "Unknown error"}`);
            }
          } catch (pushError) {
            console.error("Expo push error:", pushError);
            errors.push(
              `Push error for ${userId}: ${pushError instanceof Error ? pushError.message : String(pushError)}`,
            );

            await supabase.from("reminder_delivery_log").insert({
              user_id: userId,
              reminder_id: reminder_id || null,
              delivery_channel: "push",
              delivery_status: "failed",
              error_message: pushError instanceof Error ? pushError.message : String(pushError),
              sent_at: new Date().toISOString(),
            });
          }
        }
      }

      // Create in-app notification
      if (inAppEnabled) {
        const { error: notifError } = await supabase.from("user_notifications").insert({
          user_id: userId,
          type: reminderData?.reminder_type || "proactive",
          title: notificationTitle,
          message: notificationBody,
          data: notificationData,
          read: false,
        });

        if (!notifError) {
          results.push({ user_id: userId, channel: "in_app", status: "created" });

          await supabase.from("reminder_delivery_log").insert({
            user_id: userId,
            reminder_id: reminder_id || null,
            delivery_channel: "in_app",
            delivery_status: "delivered",
            delivered_at: new Date().toISOString(),
          });
        } else {
          errors.push(`In-app notification failed for ${userId}: ${notifError.message}`);
        }
      }

      // Update reminder as delivered
      if (reminder_id) {
        await supabase
          .from("proactive_reminders")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", reminder_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors: errors.length > 0 ? errors : undefined,
        total_sent: results.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in push-delivery:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
