import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Builds a unified, ranked daily morning thread per user, drawing from
// briefing, conflicts, meeting briefs, life-score commentary, renewals.
// Pushes ONE consolidated message to Telegram.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    let userIds: string[] = body.user_id ? [body.user_id] : [];
    if (userIds.length === 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id");
      userIds = (profiles || []).map((p: any) => p.user_id);
    }

    const today = new Date().toISOString().split("T")[0];
    let totalUsers = 0;

    for (const userId of userIds) {
      // Skip users without telegram link
      const { data: link } = await supabase
        .from("telegram_links")
        .select("chat_id")
        .eq("user_id", userId)
        .maybeSingle();

      const items: Array<{ rank: number; type: string; title: string; body?: string }> = [];

      // 1. Today's events (rank 10)
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setUTCHours(23, 59, 59, 999);

      const { data: events } = await supabase
        .from("events")
        .select("title, start_time, location")
        .eq("user_id", userId)
        .gte("start_time", startOfDay.toISOString())
        .lte("start_time", endOfDay.toISOString())
        .order("start_time")
        .limit(5);

      if (events && events.length > 0) {
        items.push({
          rank: 10,
          type: "events",
          title: `📅 ${events.length} event(s) today`,
          body: events
            .map((e) => `• ${new Date(e.start_time).toUTCString().slice(17, 22)} ${e.title}`)
            .join("\n"),
        });
      }

      // 2. Conflicts (rank 5 — high)
      const { data: conflicts } = await supabase
        .from("detected_conflicts")
        .select("title, severity")
        .eq("user_id", userId)
        .eq("status", "open")
        .order("detected_at", { ascending: false })
        .limit(3);

      if (conflicts && conflicts.length > 0) {
        items.push({
          rank: 5,
          type: "conflicts",
          title: `⚠️ ${conflicts.length} schedule conflict(s)`,
          body: conflicts.map((c) => `• ${c.title}`).join("\n"),
        });
      }

      // 3. Life score commentary (rank 20)
      const { data: commentary } = await supabase
        .from("life_score_commentary")
        .select("headline, commentary, current_score, previous_score")
        .eq("user_id", userId)
        .eq("observation_date", today)
        .maybeSingle();

      if (commentary) {
        items.push({
          rank: 20,
          type: "life_score",
          title: `📊 ${commentary.headline}`,
          body: `${commentary.previous_score} → ${commentary.current_score}\n${commentary.commentary}`,
        });
      }

      // 4. Routines suggestions (rank 30)
      const { data: routines } = await supabase
        .from("learned_routines")
        .select("title")
        .eq("user_id", userId)
        .eq("status", "suggested")
        .limit(2);

      if (routines && routines.length > 0) {
        items.push({
          rank: 30,
          type: "routines",
          title: `✨ Dori spotted ${routines.length} routine(s)`,
          body: routines.map((r) => `• ${r.title}`).join("\n"),
        });
      }

      // 5. Email pipeline (rank 25)
      const { count: emailActions } = await supabase
        .from("email_classifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pending")
        .neq("suggested_action", "none");

      if (emailActions && emailActions > 0) {
        items.push({
          rank: 25,
          type: "email_actions",
          title: `📨 ${emailActions} email action(s) waiting`,
        });
      }

      if (items.length === 0) continue;

      // Sort and persist
      items.sort((a, b) => a.rank - b.rank);

      // Clear today's items for clean rebuild
      await supabase
        .from("morning_thread_items")
        .delete()
        .eq("user_id", userId)
        .eq("thread_date", today);

      await supabase.from("morning_thread_items").insert(
        items.map((i) => ({
          user_id: userId,
          thread_date: today,
          item_type: i.type,
          rank: i.rank,
          title: i.title,
          body: i.body || null,
        })),
      );

      // Push ONE consolidated Telegram message
      if (link?.chat_id) {
        const message = [
          "🌅 *Morning thread*",
          "",
          ...items.map((i) => `*${i.title}*${i.body ? "\n" + i.body : ""}`),
        ].join("\n\n");

        try {
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
          if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
            await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TELEGRAM_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                chat_id: link.chat_id,
                text: message,
                parse_mode: "Markdown",
              }),
            });
            await supabase
              .from("morning_thread_items")
              .update({ pushed_to_telegram: true, pushed_at: new Date().toISOString() })
              .eq("user_id", userId)
              .eq("thread_date", today);
          }
        } catch (telegramErr) {
          console.error("telegram push failed:", telegramErr);
        }
      }

      totalUsers++;
    }

    return new Response(
      JSON.stringify({ success: true, threadsBuilt: totalUsers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("morning-thread error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
