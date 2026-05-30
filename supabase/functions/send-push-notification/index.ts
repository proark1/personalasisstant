// ⚠️ IN-APP-ONLY — this function does NOT deliver native push (APNs/FCM/Expo).
//
// Despite the name, it only inserts rows into `user_notifications` and logs
// that it "would" send to native devices. The real delivery path is the
// `push-delivery` function (Expo + Telegram + in-app). This is kept only so
// existing callers keep creating in-app notifications.
//
// TODO(push): once the Expo-vs-APNs/FCM decision is made and real native
// delivery is wired up, fold this into push-delivery or remove it. Removing a
// deployed edge function is a separate ops step, so it lives on for now.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Service key auth gate
  const authHeader = req.headers.get('Authorization');
  const supabaseServiceKeyCheck = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!authHeader || authHeader !== `Bearer ${supabaseServiceKeyCheck}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, data } = payload;

    console.log(`Sending push notification to ${user_ids.length} users`);

    if (!user_ids || user_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push tokens for the specified users
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('token, platform, user_id')
      .in('user_id', user_ids);

    if (tokensError) {
      console.error('Error fetching push tokens:', tokensError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log('No push tokens found for users');
      return new Response(
        JSON.stringify({ message: 'No push tokens registered for specified users', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${tokens.length} push tokens`);

    // Group tokens by platform
    const iosTokens = tokens.filter(t => t.platform === 'ios').map(t => t.token);
    const androidTokens = tokens.filter(t => t.platform === 'android').map(t => t.token);

    let sentCount = 0;
    const errors: string[] = [];

    // For iOS - Use APNs (would need APNs certificate configured)
    // For Android - Use FCM
    // Since we don't have FCM/APNs configured, we'll create in-app notifications instead
    
    // Create in-app notifications for all users
    const notifications = user_ids.map(userId => ({
      user_id: userId,
      type: 'push',
      title,
      message: body,
      data: data || {},
      read: false,
    }));

    const { error: insertError } = await supabase
      .from('user_notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating notifications:', insertError);
      errors.push('Failed to create in-app notifications');
    } else {
      sentCount = notifications.length;
      console.log(`Created ${sentCount} in-app notifications`);
    }

    // Native push is NOT delivered here — APNs/FCM are not configured. These
    // tokens are counted for visibility only; nothing is sent to the devices.
    if (iosTokens.length > 0) {
      console.log(`[send-push-notification] NOT delivering native push to ${iosTokens.length} iOS device(s) — APNs not configured (in-app only)`);
    }
    if (androidTokens.length > 0) {
      console.log(`[send-push-notification] NOT delivering native push to ${androidTokens.length} Android device(s) — FCM not configured (in-app only)`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        delivery: 'in_app_only',
        native_push_sent: 0,
        in_app_created: sentCount,
        sent: sentCount,
        tokens_found: tokens.length,
        ios_tokens: iosTokens.length,
        android_tokens: androidTokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
