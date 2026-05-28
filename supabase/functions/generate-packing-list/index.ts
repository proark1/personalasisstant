// AI-generated packing list for a trip.
//
// Body: { trip_id: uuid, replace?: boolean, extra_context?: string }
//
// Pulls trip + weather forecast (via the same weather snapshots
// table — fetched fresh by the caller if needed), runs Gemini with a
// forced tool-call to produce a structured list, and either appends
// to or replaces the existing 'AI packing' list for the trip.
//
// Items shape on the row's `items` JSONB:
//   [{ name, category?, packed: false, qty?, note? }]

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { adminClient, resolveUserId } from '../_shared/auth.ts';
import { assertWithinQuota } from '../_shared/ai-quota.ts';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = 'gemini-2.5-flash';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SYSTEM_PROMPT = [
  'You are a travel packing expert. Produce a packing list tailored to the',
  'trip: destination, weather, length, purpose, and any extra context the',
  'user provided. Categorize items.',
  '',
  'Rules:',
  '- 12–25 items total. Quality, not quantity.',
  '- Items MUST be physical objects you pack into a bag — not actions.',
  '- Use clear singular names ("Rain jacket", not "weather-appropriate clothing").',
  '- `category` is one of: clothing, toiletries, electronics, documents,',
  '  health, work, leisure, weather, other.',
  '- Skip generic basics the user obviously already packs (toothbrush is OK to',
  '  include, but skip "phone").',
  '- For business trips, lean into work items. For beach trips, lean into',
  '  swimwear/sunscreen. For cold destinations, layered warm clothing.',
].join('\n');

const TOOL = {
  type: 'function',
  function: {
    name: 'record_packing_list',
    description: 'Record the generated packing list',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          maxItems: 25,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: {
                type: 'string',
                enum: ['clothing', 'toiletries', 'electronics', 'documents', 'health', 'work', 'leisure', 'weather', 'other'],
              },
              qty: { type: 'integer', minimum: 1 },
              note: { type: 'string' },
            },
            required: ['name', 'category'],
          },
        },
        rationale: { type: 'string' },
      },
      required: ['items'],
    },
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const auth = await resolveUserId(req);
    if (!auth) return json({ error: 'Unauthorized' }, 401);
    const user = { id: auth.userId };
    const admin = adminClient();

    const body = await req.json().catch(() => ({}));
    const tripId = String(body.trip_id || '');
    if (!UUID_RE.test(tripId)) return json({ error: 'invalid trip_id' }, 400);
    const replace = body.replace === true;
    const extraContext = typeof body.extra_context === 'string'
      ? body.extra_context.slice(0, 500)
      : '';

    // Load trip + cached weather summary if any.
    const { data: trip, error: tErr } = await admin
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .single();
    if (tErr || !trip) return json({ error: 'trip not found' }, 404);

    let weatherSummary = trip.weather_summary || '';
    let weatherDays: any[] = [];
    if (trip.destination_lat != null && trip.destination_lon != null) {
      const latGrid = Math.round(Number(trip.destination_lat) * 10) / 10;
      const lonGrid = Math.round(Number(trip.destination_lon) * 10) / 10;
      const { data: cached } = await admin
        .from('weather_snapshots')
        .select('date, temp_min_c, temp_max_c, precipitation_probability, summary')
        .eq('lat_grid', latGrid)
        .eq('lon_grid', lonGrid)
        .gte('date', trip.start_date)
        .lte('date', trip.end_date)
        .order('date');
      weatherDays = cached ?? [];
      if (!weatherSummary && weatherDays.length > 0) {
        weatherSummary = weatherDays.map((d) => `${d.date}: ${d.summary}`).join('\n');
      }
    }

    const lengthDays = daysBetween(trip.start_date, trip.end_date) + 1;

    const userPrompt = [
      `Destination: ${trip.destination}${trip.destination_country ? `, ${trip.destination_country}` : ''}`,
      `Dates: ${trip.start_date} → ${trip.end_date} (${lengthDays} day${lengthDays === 1 ? '' : 's'})`,
      `Purpose: ${trip.purpose || 'unspecified'}`,
      `Status: ${trip.status || 'planned'}`,
      weatherSummary ? `Weather forecast:\n${weatherSummary}` : 'No weather forecast available — pick safe layered choices.',
      extraContext ? `\nExtra context from the user: ${extraContext}` : '',
    ].filter(Boolean).join('\n');

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return json({ error: 'GEMINI_API_KEY not configured' }, 503);
    }

    try {
      await assertWithinQuota(admin, user.id);
    } catch (e) {
      const code = (e as any)?.code;
      return json({ error: (e as Error).message, code }, code === 'quota_exceeded' ? 429 : 500);
    }

    const aiResp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: 'function', function: { name: 'record_packing_list' } },
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!aiResp.ok) {
      return json({ error: `AI gateway ${aiResp.status}` }, 502);
    }
    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    // Forced tool_choice usually returns valid JSON, but the gateway
    // can occasionally hand back a malformed string (truncated tokens,
    // upstream timeout). Guard the parse so the function returns a
    // clean 502 instead of crashing into a 500.
    let parsed: any = null;
    try {
      parsed = typeof args === 'string' ? JSON.parse(args) : args;
    } catch (e) {
      console.error('[generate-packing-list] AI returned malformed JSON', (e as Error).message);
      return json({ error: 'AI returned invalid structured data' }, 502);
    }
    const items = Array.isArray(parsed?.items) ? parsed.items : [];

    const cleanItems = items.slice(0, 25).map((it: any) => ({
      name: String(it?.name || '').slice(0, 100),
      category: String(it?.category || 'other').slice(0, 30),
      qty: Number.isInteger(it?.qty) && it.qty > 0 ? it.qty : 1,
      note: typeof it?.note === 'string' ? it.note.slice(0, 200) : null,
      packed: false,
    })).filter((it: any) => it.name.length > 0);

    if (cleanItems.length === 0) {
      return json({ error: 'AI returned no usable items' }, 500);
    }

    // Find or create the AI packing list for this trip.
    const { data: existing } = await admin
      .from('packing_lists')
      .select('id, items')
      .eq('user_id', user.id)
      .eq('trip_id', tripId)
      .eq('source', 'ai_generated')
      .maybeSingle();

    let listId: string;
    if (existing && !replace) {
      // Append items, dedup by name (case-insensitive).
      const have = new Set(
        ((existing.items as any[]) ?? []).map((i: any) =>
          String(i?.name || '').toLowerCase()),
      );
      const merged = [
        ...((existing.items as any[]) ?? []),
        ...cleanItems.filter((i: any) => !have.has(i.name.toLowerCase())),
      ];
      const { error: upErr } = await admin
        .from('packing_lists')
        .update({
          items: merged,
          generated_at: new Date().toISOString(),
          metadata: { rationale: parsed?.rationale ?? null },
        })
        .eq('id', existing.id);
      if (upErr) return json({ error: upErr.message }, 500);
      listId = existing.id;
    } else if (existing && replace) {
      const { error: upErr } = await admin
        .from('packing_lists')
        .update({
          items: cleanItems,
          generated_at: new Date().toISOString(),
          metadata: { rationale: parsed?.rationale ?? null },
        })
        .eq('id', existing.id);
      if (upErr) return json({ error: upErr.message }, 500);
      listId = existing.id;
    } else {
      const { data: ins, error: insErr } = await admin
        .from('packing_lists')
        .insert({
          user_id: user.id,
          trip_id: tripId,
          name: 'Smart packing list',
          source: 'ai_generated',
          items: cleanItems,
          generated_at: new Date().toISOString(),
          metadata: { rationale: parsed?.rationale ?? null },
        })
        .select('id')
        .single();
      if (insErr || !ins) return json({ error: insErr?.message || 'insert failed' }, 500);
      listId = ins.id;
    }

    return json({
      ok: true,
      packing_list_id: listId,
      items_count: cleanItems.length,
      rationale: parsed?.rationale ?? null,
      weather_used: weatherDays.length > 0,
    });
  } catch (err) {
    console.error('[generate-packing-list] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T00:00:00Z').getTime();
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
