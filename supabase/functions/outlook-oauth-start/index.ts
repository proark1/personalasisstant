import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("MICROSOFT_CLIENT_ID");
    if (!clientId) {
      return new Response(
        JSON.stringify({
          error:
            "Outlook integration not yet configured. The administrator needs to add Microsoft credentials.",
          code: "NOT_CONFIGURED",
          fallback: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const redirectUri = `${supabaseUrl}/functions/v1/outlook-oauth-callback`;

    // Signed state (HMAC) for CSRF protection
    const statePayload = JSON.stringify({ userId: user.id, provider: "outlook", ts: Date.now() });
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", hmacKey, encoder.encode(statePayload));
    const sigHex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const state = btoa(statePayload) + "." + sigHex;

    const scopes = ["offline_access", "User.Read", "Calendars.ReadWrite"].join(" ");

    // Use 'common' tenant to support both personal and work Microsoft accounts
    const authUrl = new URL("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("outlook-oauth-start error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
