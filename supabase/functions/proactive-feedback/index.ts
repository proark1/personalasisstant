// Records 👍/👎 feedback on a proactive message. Used by Telegram inline buttons + web UI.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const token = auth.replace("Bearer ", "");
    const { data: claimsData } = await supabaseAuth.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { trigger_type, trigger_key, channel = "web", rating, message_excerpt, context } = await req.json();
    if (!trigger_type || ![1, -1].includes(rating)) {
      return new Response(JSON.stringify({ error: "trigger_type and rating (1|-1) required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error } = await supabase.from("proactive_feedback").insert({
      user_id: userId,
      trigger_type,
      trigger_key,
      channel,
      rating,
      message_excerpt,
      context: context ?? {},
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("proactive-feedback error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
