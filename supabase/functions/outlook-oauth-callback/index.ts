import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptTokenIfConfigured } from "../_shared/encryption.ts";

serve(async (req) => {
  const appUrl = Deno.env.get('APP_URL') || '';

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=${encodeURIComponent(errorParam)}`);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=missing_params`);
    }

    // Verify HMAC state
    const stateParts = state.split('.');
    if (stateParts.length !== 2) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=invalid_state`);
    }

    let stateData: { userId: string; provider: string; ts: number };
    try {
      stateData = JSON.parse(atob(stateParts[0]));
    } catch {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=invalid_state`);
    }

    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = new Uint8Array(stateParts[1].match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', hmacKey, sigBytes, encoder.encode(atob(stateParts[0])));
    if (!valid) return Response.redirect(`${appUrl}/auth/calendar-callback?error=invalid_state`);
    if (stateData.ts && Date.now() - stateData.ts > 10 * 60 * 1000) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=state_expired`);
    }

    const { userId } = stateData;

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')!;
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/outlook-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'offline_access User.Read Calendars.ReadWrite',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Outlook token exchange failed:', await tokenResponse.text());
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Encrypt OAuth tokens at rest (no-op until BANK_TOKEN_SECRET is set).
    const accessTokenEnc = await encryptTokenIfConfigured(access_token);
    const refreshTokenEnc = await encryptTokenIfConfigured(refresh_token);

    // Fetch user info to get email/name
    const userInfoResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const userInfo = userInfoResp.ok ? await userInfoResp.json() : {};
    const calendarName = userInfo.userPrincipalName || userInfo.mail || userInfo.displayName || 'Outlook Calendar';

    // Fetch the primary calendar id
    const calResp = await fetch('https://graph.microsoft.com/v1.0/me/calendar', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const cal = calResp.ok ? await calResp.json() : {};
    const externalCalendarId = cal.id || 'primary';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: existing } = await supabase
      .from('external_calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'outlook')
      .eq('external_calendar_id', externalCalendarId)
      .maybeSingle();

    const payload = {
      user_id: userId,
      provider: 'outlook',
      auth_type: 'oauth',
      name: calendarName,
      color: '#0078D4',
      external_calendar_id: externalCalendarId,
      calendar_id: externalCalendarId,
      access_token: accessTokenEnc,
      refresh_token: refreshTokenEnc,
      token_expires_at: tokenExpiresAt,
      sync_enabled: true,
      sync_direction: 'two_way',
      last_sync_error: null,
    };

    if (existing) {
      await supabase.from('external_calendar_connections').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('external_calendar_connections').insert(payload);
    }

    return Response.redirect(`${appUrl}/auth/calendar-callback?success=true&provider=outlook`);
  } catch (error) {
    console.error('outlook-oauth-callback error:', error);
    return Response.redirect(`${appUrl}/auth/calendar-callback?error=unexpected_error`);
  }
});
