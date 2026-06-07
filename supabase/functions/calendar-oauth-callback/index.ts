import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptTokenIfConfigured } from "../_shared/encryption.ts";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Get the app URL for redirect
    const appUrl = Deno.env.get('APP_URL') || '';

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=missing_params`);
    }

    // Verify cryptographically signed state parameter
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

    // Verify HMAC signature
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encoder = new TextEncoder();
    const hmacKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = new Uint8Array(stateParts[1].match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const statePayload = atob(stateParts[0]);
    const valid = await crypto.subtle.verify('HMAC', hmacKey, sigBytes, encoder.encode(statePayload));

    if (!valid) {
      console.error('OAuth state HMAC verification failed');
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=invalid_state`);
    }

    // Reject state older than 10 minutes
    if (stateData.ts && Date.now() - stateData.ts > 10 * 60 * 1000) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=state_expired`);
    }

    const { userId, provider } = stateData;

    if (provider !== 'google') {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=unsupported_provider`);
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redirectUri = `${supabaseUrl}/functions/v1/calendar-oauth-callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Encrypt OAuth tokens at rest (no-op until BANK_TOKEN_SECRET is set).
    const accessTokenEnc = await encryptTokenIfConfigured(access_token);
    const refreshTokenEnc = await encryptTokenIfConfigured(refresh_token);

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Fetch user's calendar list
    const calendarListResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!calendarListResponse.ok) {
      console.error('Failed to fetch calendar list');
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=calendar_fetch_failed`);
    }

    const calendarList = await calendarListResponse.json();
    const primaryCalendar = calendarList.items?.find((cal: { primary?: boolean }) => cal.primary) || calendarList.items?.[0];

    if (!primaryCalendar) {
      return Response.redirect(`${appUrl}/auth/calendar-callback?error=no_calendars_found`);
    }

    // Use service role to insert the connection
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('external_calendar_connections')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('external_calendar_id', primaryCalendar.id)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error: updateError } = await supabase
        .from('external_calendar_connections')
        .update({
          access_token: accessTokenEnc,
          refresh_token: refreshTokenEnc,
          token_expires_at: tokenExpiresAt,
          name: primaryCalendar.summary || 'Google Calendar',
          color: primaryCalendar.backgroundColor || '#4285F4',
          sync_enabled: true,
          last_synced_at: null,
        })
        .eq('id', existingConnection.id);

      if (updateError) {
        console.error('Failed to update connection:', updateError);
        return Response.redirect(`${appUrl}/auth/calendar-callback?error=db_update_failed`);
      }
    } else {
      // Create new connection
      const { error: insertError } = await supabase
        .from('external_calendar_connections')
        .insert({
          user_id: userId,
          provider: 'google',
          name: primaryCalendar.summary || 'Google Calendar',
          color: primaryCalendar.backgroundColor || '#4285F4',
          calendar_id: primaryCalendar.id,
          external_calendar_id: primaryCalendar.id,
          access_token: accessTokenEnc,
          refresh_token: refreshTokenEnc,
          token_expires_at: tokenExpiresAt,
          sync_enabled: true,
        });

      if (insertError) {
        console.error('Failed to insert connection:', insertError);
        return Response.redirect(`${appUrl}/auth/calendar-callback?error=db_insert_failed`);
      }
    }

    console.log('Successfully connected Google Calendar for user:', userId);

    return Response.redirect(`${appUrl}/auth/calendar-callback?success=true`);
  } catch (error) {
    console.error('Error in calendar-oauth-callback:', error);
    const appUrl = Deno.env.get('APP_URL') || '';
    return Response.redirect(`${appUrl}/auth/calendar-callback?error=unexpected_error`);
  }
});
