import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRequest {
  icsContent?: string;
  calendarName?: string;
  color?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get user from authorization header
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Create client with user's auth header to validate token
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  
  if (userError || !user) {
    console.error('Auth error:', userError);
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  const userId = user.id;
  
  // Create service client for database operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { icsContent, calendarName = 'Imported Calendar', color = '#3b82f6' }: ImportRequest = await req.json();

    if (!icsContent) {
      return new Response(JSON.stringify({ error: 'ICS content is required' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Importing calendar for user: ${userId}`);

    // Parse ICS content
    const events = parseICS(icsContent);
    
    if (events.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No events found in the calendar file' 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create calendar connection record
    const { data: connection, error: connError } = await supabase
      .from('external_calendar_connections')
      .insert({
        user_id: userId,
        provider: 'ics',
        name: calendarName,
        color: color,
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (connError) {
      console.error('Error creating calendar connection:', connError);
    }

    // Import events
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        // Check for duplicate (same title and start time)
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('user_id', userId)
          .eq('title', event.title)
          .eq('start_time', event.startTime)
          .single();

        if (existing) {
          skippedCount++;
          continue;
        }

        const { error: insertError } = await supabase
          .from('events')
          .insert({
            user_id: userId,
            title: event.title,
            description: event.description,
            start_time: event.startTime,
            end_time: event.endTime,
            location: event.location,
            category: 'personal',
            recurrence_rule: event.rrule,
          });

        if (insertError) {
          errors.push(`Failed to import "${event.title}": ${insertError.message}`);
        } else {
          importedCount++;
        }
      } catch (e) {
        errors.push(`Error processing event: ${e}`);
      }
    }

    console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped`);

    return new Response(JSON.stringify({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: events.length,
      errors: errors.length > 0 ? errors : undefined,
      connectionId: connection?.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Calendar import error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simple ICS parser
function parseICS(content: string): Array<{
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  rrule?: string;
}> {
  const events: any[] = [];
  const lines = content.split(/\r?\n/);
  
  let currentEvent: any = null;
  let currentField = '';
  let currentValue = '';

  for (const line of lines) {
    // Handle line continuations
    if (line.startsWith(' ') || line.startsWith('\t')) {
      currentValue += line.substring(1);
      continue;
    }

    // Process previous field
    if (currentField && currentEvent) {
      processField(currentEvent, currentField, currentValue);
    }

    // Parse new line
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    currentField = line.substring(0, colonIndex);
    currentValue = line.substring(colonIndex + 1);

    // Handle field parameters (e.g., DTSTART;TZID=...)
    const semicolonIndex = currentField.indexOf(';');
    if (semicolonIndex !== -1) {
      currentField = currentField.substring(0, semicolonIndex);
    }

    if (currentField === 'BEGIN' && currentValue === 'VEVENT') {
      currentEvent = {};
    } else if (currentField === 'END' && currentValue === 'VEVENT') {
      if (currentEvent && currentEvent.title && currentEvent.startTime) {
        // Default end time to 1 hour after start if not provided
        if (!currentEvent.endTime) {
          const start = new Date(currentEvent.startTime);
          start.setHours(start.getHours() + 1);
          currentEvent.endTime = start.toISOString();
        }
        events.push(currentEvent);
      }
      currentEvent = null;
      currentField = '';
      currentValue = '';
    }
  }

  return events;
}

function processField(event: any, field: string, value: string) {
  switch (field) {
    case 'SUMMARY':
      event.title = unescapeICS(value);
      break;
    case 'DESCRIPTION':
      event.description = unescapeICS(value);
      break;
    case 'DTSTART':
      event.startTime = parseICSDate(value);
      break;
    case 'DTEND':
      event.endTime = parseICSDate(value);
      break;
    case 'LOCATION':
      event.location = unescapeICS(value);
      break;
    case 'RRULE':
      event.rrule = value;
      break;
  }
}

function parseICSDate(value: string): string {
  // Remove any timezone info prefix
  const cleanValue = value.replace(/^TZID=[^:]+:/, '');
  
  // Format: YYYYMMDD or YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
  if (cleanValue.length === 8) {
    // All day event
    const year = cleanValue.substring(0, 4);
    const month = cleanValue.substring(4, 6);
    const day = cleanValue.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00.000Z`;
  } else if (cleanValue.length >= 15) {
    const year = cleanValue.substring(0, 4);
    const month = cleanValue.substring(4, 6);
    const day = cleanValue.substring(6, 8);
    const hour = cleanValue.substring(9, 11);
    const minute = cleanValue.substring(11, 13);
    const second = cleanValue.substring(13, 15);
    
    const isUTC = cleanValue.endsWith('Z');
    if (isUTC) {
      return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    } else {
      // Treat as local time and convert to ISO
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      return date.toISOString();
    }
  }
  
  return new Date().toISOString();
}

function unescapeICS(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
