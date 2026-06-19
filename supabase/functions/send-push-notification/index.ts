// Compatibility wrapper around push-delivery.
//
// Older callers hit send-push-notification directly. Keep that endpoint, but
// route it through the real delivery pipeline so Expo push, Telegram, quiet
// hours, and in-app fallback all stay in one place.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "normal" | "high";
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    const payload: PushPayload = await req.json();
    const { user_ids, title, body, data, priority } = payload;

    if (!user_ids || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: "No user IDs provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending push notification to ${user_ids.length} users`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const deliveryResponse = await fetch(`${supabaseUrl}/functions/v1/push-delivery`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_ids, title, body, data, priority: priority || "high" }),
      signal: AbortSignal.timeout(55_000),
    });
    const delivery = await deliveryResponse.json().catch(() => ({}));

    return new Response(
      JSON.stringify({
        success: deliveryResponse.ok && delivery?.success !== false,
        delivery: "push_delivery",
        sent: delivery?.sent ?? delivery?.results?.length ?? 0,
        results: delivery?.results ?? [],
        errors: delivery?.errors,
        upstream_status: deliveryResponse.status,
      }),
      {
        status: deliveryResponse.ok ? 200 : deliveryResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-push-notification:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
