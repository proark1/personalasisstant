import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'X-Content-Type-Options': 'nosniff',
};

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!response.ok) return null;
  return response.json();
}

function buildRawEmail(to: string, subject: string, body: string, threadId: string | null, messageId: string | null, fromEmail: string): string {
  const isReply = !!threadId && !!messageId;
  const finalSubject = isReply ? (subject?.startsWith('Re:') ? subject : `Re: ${subject}`) : (subject || '(No subject)');
  const lines = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${finalSubject}`,
  ];
  if (isReply && messageId) {
    lines.push(`In-Reply-To: <${messageId}>`);
    lines.push(`References: <${messageId}>`);
  }
  lines.push(`Content-Type: text/plain; charset=UTF-8`, '', body);
  const raw = lines.join('\r\n');
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Accept two auth shapes:
    //   (a) a real user JWT — the normal web-app path
    //   (b) service-role token + x-telegram-user-id header — used when the
    //       chat function dispatches on behalf of a Telegram user
    const token = authHeader.replace('Bearer ', '');
    const telegramUserIdHeader = req.headers.get('x-telegram-user-id');
    let userId: string;
    if (token === serviceRoleKey && telegramUserIdHeader) {
      userId = telegramUserIdHeader;
    } else {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = claimsData.claims.sub;
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { to, subject, body, threadId, gmailMessageId } = await req.json();
    if (!to || !body) {
      return new Response(JSON.stringify({ error: 'to and body required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get Google connection
    const { data: connections } = await adminClient
      .from('external_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .limit(1);

    if (!connections?.length) {
      return new Response(JSON.stringify({ error: 'No Google connection' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const connection = connections[0];
    let accessToken = connection.access_token;

    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      if (!connection.refresh_token) {
        return new Response(JSON.stringify({ error: 'Token expired' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const refreshed = await refreshAccessToken(connection.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ error: 'Refresh failed' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      accessToken = refreshed.access_token;
      await adminClient.from('external_calendar_connections')
        .update({ access_token: accessToken, token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString() })
        .eq('id', connection.id);
    }

    // Get user's email from profile
    const { data: profile } = await adminClient.from('profiles').select('email').eq('user_id', userId).single();
    const fromEmail = profile?.email || 'me';

    const raw = buildRawEmail(to, subject || '', body, threadId || '', gmailMessageId || '', fromEmail);

    const sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw,
        threadId: threadId || undefined,
      }),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      console.error('Gmail send failed:', sendResp.status, errText);
      if (sendResp.status === 403) {
        return new Response(JSON.stringify({ error: 'Gmail send permission not granted. Reconnect your Google account with send permissions.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await sendResp.json();
    return new Response(JSON.stringify({ success: true, messageId: result.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Send reply error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
