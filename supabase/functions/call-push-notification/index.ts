// Incoming call notification delivery.
//
// Delivers to Expo push tokens when present and always creates an in-app
// notification fallback. Raw APNs/FCM tokens are reported as unsupported until
// provider credentials are configured.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

interface CallNotificationPayload {
  callee_id: string;
  caller_id: string;
  caller_name: string;
  session_id: string;
  call_type: "audio" | "video";
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function isExpoToken(token: string | null | undefined): token is string {
  return !!token && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate — the gateway does not verify JWTs, so validate the caller here.
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CallNotificationPayload = await req.json();
    const { callee_id, caller_name, session_id, call_type } = payload;
    // Derive caller identity from the authenticated user — never trust a
    // body-supplied caller_id (would let anyone spoof "incoming call from X").
    const caller_id = user.id;

    console.log("[call-push] Sending call notification for session:", session_id);

    // Get callee's push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, expo_push_token, platform")
      .eq("user_id", callee_id);

    if (tokenError) {
      console.error("[call-push] Error fetching tokens:", tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log("[call-push] No push tokens found for user:", callee_id);
    } else {
      console.log("[call-push] Found", tokens.length, "tokens");
    }

    // Send push notifications
    const results = await Promise.all(
      (tokens ?? []).map(async ({ token, expo_push_token, platform }) => {
        try {
          const pushToken = expo_push_token || token;
          if (isExpoToken(pushToken)) {
            const response = await fetch(EXPO_PUSH_URL, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: pushToken,
                title: `Incoming ${call_type} call`,
                body: `${caller_name} is calling you`,
                data: {
                  type: "incoming_call",
                  caller_id,
                  caller_name,
                  session_id,
                  call_type,
                },
                sound: "default",
                priority: "high",
                badge: 1,
                categoryId: "incoming_call",
              }),
            });
            const result = await response.json().catch(() => ({}));
            const ticket = result?.data?.[0];
            return {
              delivered: response.ok && ticket?.status === "ok",
              platform,
              provider: "expo",
              ticket_id: ticket?.id || null,
              error:
                ticket?.status === "error" ? ticket?.message || ticket?.details?.error : undefined,
            };
          }

          return {
            delivered: false,
            platform,
            provider: platform === "ios" ? "apns" : platform === "android" ? "fcm" : "unknown",
            reason:
              platform === "ios"
                ? "APNs not configured"
                : platform === "android"
                  ? "FCM not configured"
                  : "Unknown platform",
          };
        } catch (e) {
          console.error("[call-push] Error sending to", platform, ":", e);
          return { delivered: false, platform, error: String(e) };
        }
      }),
    );

    // For now, create an in-app notification as well
    await supabase.from("user_notifications").insert({
      user_id: callee_id,
      type: "call",
      title: `Incoming ${call_type} call`,
      message: `${caller_name} is calling you`,
      data: {
        type: "incoming_call",
        caller_id,
        caller_name,
        session_id,
        call_type,
      },
    });

    console.log("[call-push] Notification created");

    return new Response(
      JSON.stringify({
        success: true,
        delivery: "expo_and_in_app",
        message:
          "Call notification delivered to Expo tokens when available; in-app fallback created",
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[call-push] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
