// Generates and (optionally) posts a weekly recap for a workspace.
// Callable by the /recap Telegram command and later by a cron trigger.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildWorkspaceWeeklyRecap, formatRecapForTelegram } from "../_shared/dori-recap.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (auth !== `Bearer ${serviceKey}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    const body = await req.json().catch(() => ({}));
    const {
      workspace_id,
      post_to_telegram = false,
      timezone,
    } = body as {
      workspace_id?: string;
      post_to_telegram?: boolean;
      timezone?: string;
    };
    if (!workspace_id) return json({ error: "workspace_id required" }, 400);

    // If no timezone was explicitly passed, default to the workspace owner's.
    let tz = timezone;
    if (!tz) {
      const { data: ws } = await admin
        .from("workspaces")
        .select("owner_id")
        .eq("id", workspace_id)
        .maybeSingle();
      if (ws?.owner_id) {
        const { data: p } = await admin
          .from("profiles")
          .select("timezone")
          .eq("user_id", ws.owner_id)
          .maybeSingle();
        tz = p?.timezone || undefined;
      }
    }

    const [{ data: ws }, recap] = await Promise.all([
      admin.from("workspaces").select("name").eq("id", workspace_id).maybeSingle(),
      buildWorkspaceWeeklyRecap(admin, workspace_id, { timezone: tz }),
    ]);
    const markdown = formatRecapForTelegram(recap, ws?.name, tz);

    if (post_to_telegram) {
      const { data: link } = await admin
        .from("workspace_telegram_links")
        .select("chat_id")
        .eq("workspace_id", workspace_id)
        .eq("is_active", true)
        .maybeSingle();
      if (link?.chat_id) {
        const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: link.chat_id,
              text: markdown.slice(0, 4000),
              parse_mode: "HTML",
            }),
          });
        } catch (e) {
          console.error("recap post failed", e);
        }
      }
    }

    return json({ ok: true, recap, formatted: markdown });
  } catch (e) {
    console.error("workspace-weekly-recap error", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
