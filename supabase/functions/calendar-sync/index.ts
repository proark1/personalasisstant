import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Failed to refresh token:', await response.text());
    return null;
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { connectionId } = await req.json();

    // Use service role for database operations
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // Get the calendar connection
    const { data: connection, error: connectionError } = await adminSupabase
      .from('external_calendar_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .single();

    if (connectionError || !connection) {
      return new Response(JSON.stringify({ error: 'Connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (connection.provider !== 'google') {
      return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken = connection.access_token;

    // Check if token needs refresh
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      console.log('Token expired, refreshing...');
      const newTokens = await refreshGoogleToken(connection.refresh_token);
      
      if (!newTokens) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token. Please reconnect your calendar.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update token in database
      await adminSupabase
        .from('external_calendar_connections')
        .update({
          access_token: accessToken,
          token_expires_at: newExpiresAt,
        })
        .eq('id', connectionId);
    }

    // Fetch events from Google Calendar
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

    const calendarId = connection.external_calendar_id || 'primary';
    const eventsUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    eventsUrl.searchParams.set('timeMin', timeMin);
    eventsUrl.searchParams.set('timeMax', timeMax);
    eventsUrl.searchParams.set('singleEvents', 'true');
    eventsUrl.searchParams.set('orderBy', 'startTime');
    eventsUrl.searchParams.set('maxResults', '250');
    
    if (connection.sync_token) {
      eventsUrl.searchParams.set('syncToken', connection.sync_token);
    }

    const eventsResponse = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error('Failed to fetch events:', errorText);
      
      // If sync token is invalid, clear it and retry without it
      if (eventsResponse.status === 410) {
        await adminSupabase
          .from('external_calendar_connections')
          .update({ sync_token: null })
          .eq('id', connectionId);
        
        return new Response(JSON.stringify({ error: 'Sync token expired. Please try again.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'Failed to fetch calendar events' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventsData = await eventsResponse.json();
    const googleEvents = eventsData.items || [];
    
    console.log(`Fetched ${googleEvents.length} events from Google Calendar`);

    let importedCount = 0;
    let updatedCount = 0;
    let errors: string[] = [];

    for (const googleEvent of googleEvents) {
      try {
        // Handle cancelled events
        if (googleEvent.status === 'cancelled') {
          await adminSupabase
            .from('events')
            .delete()
            .eq('user_id', user.id)
            .eq('external_source', 'google')
            .eq('external_id', googleEvent.id);
          continue;
        }

        // Parse start and end times
        const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
        const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;

        if (!startTime || !endTime) {
          continue;
        }

        const eventData = {
          user_id: user.id,
          title: googleEvent.summary || 'Untitled Event',
          description: googleEvent.description || null,
          start_time: startTime,
          end_time: endTime,
          location: googleEvent.location || null,
          external_source: 'google',
          external_id: googleEvent.id,
          attendees: googleEvent.attendees?.map((a: any) => a.email) || null,
        };

        // Check if event already exists
        const { data: existingEvent } = await adminSupabase
          .from('events')
          .select('id')
          .eq('user_id', user.id)
          .eq('external_source', 'google')
          .eq('external_id', googleEvent.id)
          .single();

        if (existingEvent) {
          // Update existing event
          const { error: updateError } = await adminSupabase
            .from('events')
            .update(eventData)
            .eq('id', existingEvent.id);

          if (updateError) {
            errors.push(`Failed to update event: ${googleEvent.summary}`);
          } else {
            updatedCount++;
          }
        } else {
          // Insert new event
          const { error: insertError } = await adminSupabase
            .from('events')
            .insert(eventData);

          if (insertError) {
            errors.push(`Failed to import event: ${googleEvent.summary}`);
          } else {
            importedCount++;
          }
        }
      } catch (eventError) {
        console.error('Error processing event:', eventError);
        errors.push(`Error processing event: ${googleEvent.summary || 'Unknown'}`);
      }
    }

    // ====== PUSH local pending_push events to Google ======
    let pushedCount = 0;
    if (connection.sync_direction === 'two_way' || !connection.sync_direction) {
      const { data: pendingEvents } = await adminSupabase.from('events')
        .select('*')
        .eq('user_id', user.id)
        .eq('connection_id', connectionId)
        .eq('sync_status', 'pending_push')
        .limit(50);

      for (const local of pendingEvents || []) {
        try {
          const body = {
            summary: local.title || 'Untitled',
            description: local.description || undefined,
            location: local.location || undefined,
            start: { dateTime: new Date(local.start_time).toISOString() },
            end: { dateTime: new Date(local.end_time).toISOString() },
          };
          const isUpdate = !!local.external_id;
          const url = isUpdate
            ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${local.external_id}`
            : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
          const resp = await fetch(url, {
            method: isUpdate ? 'PATCH' : 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (resp.ok) {
            const remote = await resp.json();
            await adminSupabase.from('events').update({
              external_id: remote.id,
              external_source: 'google',
              external_etag: remote.etag,
              sync_status: 'synced',
              last_pushed_at: new Date().toISOString(),
            }).eq('id', local.id);
            pushedCount++;
          } else {
            errors.push(`push ${isUpdate ? 'update' : 'create'}: ${resp.status}`);
          }
        } catch (e: any) {
          errors.push(`push: ${e?.message || 'unknown'}`);
        }
      }
    }

    // Update last synced time and sync token
    await adminSupabase
      .from('external_calendar_connections')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_token: eventsData.nextSyncToken || null,
        last_sync_error: errors.length ? errors.slice(0, 5).join('; ') : null,
      })
      .eq('id', connectionId);

    console.log(`Sync complete: ${importedCount} imported, ${updatedCount} updated, ${pushedCount} pushed, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      imported: importedCount,
      updated: updatedCount,
      pushed: pushedCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in calendar-sync:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
