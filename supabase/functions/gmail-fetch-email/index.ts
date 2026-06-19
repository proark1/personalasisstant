import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { decryptTokenIfNeeded, encryptTokenIfConfigured } from "../_shared/encryption.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
};

async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  return response.json();
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function decodeBody(payload: GmailPart): string {
  // Try to get HTML body first, then plain text
  if (payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  if (payload.parts) {
    // Prefer text/html
    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      return atob(htmlPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
    }
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      const text = atob(textPart.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      return `<pre style="white-space:pre-wrap;font-family:inherit;">${text}</pre>`;
    }
    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = decodeBody(part);
        if (nested) return nested;
      }
    }
  }
  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { messageId } = await req.json();
    if (!messageId) {
      return new Response(JSON.stringify({ error: "messageId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google connection
    const { data: connections } = await adminClient
      .from("external_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "google")
      .limit(1);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: "No Google connection" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connection = connections[0];
    // Tokens are encrypted at rest (when BANK_TOKEN_SECRET is set); decrypt for
    // use. Legacy plaintext rows pass through unchanged.
    connection.access_token =
      (await decryptTokenIfNeeded(connection.access_token)) ?? connection.access_token;
    connection.refresh_token =
      (await decryptTokenIfNeeded(connection.refresh_token)) ?? connection.refresh_token;
    let accessToken = connection.access_token;

    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token) {
        return new Response(JSON.stringify({ error: "Token expired" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: "Refresh failed" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      accessToken = refreshed.access_token;
      await adminClient
        .from("external_calendar_connections")
        .update({
          access_token: await encryptTokenIfConfigured(accessToken),
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", connection.id);
    }

    // Fetch full message
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Gmail fetch failed", status: resp.status }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msg = await resp.json();
    const body = decodeBody(msg.payload);

    return new Response(JSON.stringify({ body }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
