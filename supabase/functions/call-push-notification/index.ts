// ⚠️ IN-APP-ONLY — this function does NOT deliver native push (APNs/FCM).
//
// It creates an in-app `user_notifications` row for the incoming call and logs
// that it "would" send APNs/FCM. That means a *backgrounded* device is NOT
// woken by a real push — only foreground/realtime in-app delivery works today.
//
// TODO(push): wire real APNs/FCM (or Expo) delivery so incoming calls ring on
// locked/backgrounded devices.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

interface CallNotificationPayload {
  callee_id: string;
  caller_id: string;
  caller_name: string;
  session_id: string;
  call_type: 'audio' | 'video';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await _sb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: CallNotificationPayload = await req.json();
    const { callee_id, caller_id, caller_name, session_id, call_type } = payload;

    console.log('[call-push] Sending call notification for session:', session_id);

    // Get callee's push tokens
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', callee_id);

    if (tokenError) {
      console.error('[call-push] Error fetching tokens:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('[call-push] No push tokens found for user:', callee_id);
      return new Response(
        JSON.stringify({ success: false, message: 'No push tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[call-push] Found', tokens.length, 'tokens');

    // Send push notifications
    const results = await Promise.all(
      tokens.map(async ({ token, platform }) => {
        try {
          if (platform === 'ios') {
            // APNs not configured — nothing is delivered to the device.
            console.log('[call-push] NOT delivering APNs (not configured) to:', token.substring(0, 20) + '...');
            return { delivered: false, platform, reason: 'APNs not configured' };
          } else if (platform === 'android') {
            // FCM not configured — nothing is delivered to the device.
            console.log('[call-push] NOT delivering FCM (not configured) to:', token.substring(0, 20) + '...');
            return { delivered: false, platform, reason: 'FCM not configured' };
          }
          return { delivered: false, platform, error: 'Unknown platform' };
        } catch (e) {
          console.error('[call-push] Error sending to', platform, ':', e);
          return { delivered: false, platform, error: String(e) };
        }
      })
    );

    // For now, create an in-app notification as well
    await supabase.from('user_notifications').insert({
      user_id: callee_id,
      type: 'call',
      title: `Incoming ${call_type} call`,
      message: `${caller_name} is calling you`,
      data: {
        type: 'incoming_call',
        caller_id,
        caller_name,
        session_id,
        call_type,
      },
    });

    console.log('[call-push] Notification created');

    return new Response(
      JSON.stringify({
        success: true,
        delivery: 'in_app_only',
        message: 'In-app call notification created; native push not configured',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[call-push] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
