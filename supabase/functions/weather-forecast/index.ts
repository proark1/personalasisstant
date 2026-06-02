// Weather forecast for a trip — Open-Meteo backend (no API key).
//
// Body: { lat: number, lon: number, start_date: string, end_date: string }
// Returns: { days: [{ date, temp_min_c, temp_max_c, precipitation_mm,
//   precipitation_probability, wind_speed_max_kmh, weather_code, summary }],
//   summary: string, cached_count, fetched_count }
//
// Caching strategy:
//   - Round lat/lon to 0.1° (≈ 11 km) to maximise hit rate across users
//     in the same metro area.
//   - 6h TTL via fetched_at on weather_snapshots.
//   - Per-day rows; we only fetch the days that are missing or stale.
//
// Open-Meteo's `forecast` endpoint covers 16 days out, no key required.
// For dates further out we extrapolate by returning a "no data" entry —
// the caller decides what to do with it.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FORECAST_RANGE_DAYS = 16;     // Open-Meteo's free forecast horizon
const MAX_RANGE_DAYS = 30;          // hard cap to avoid blowup

interface DayRow {
  date: string;                       // YYYY-MM-DD
  temp_min_c: number | null;
  temp_max_c: number | null;
  precipitation_mm: number | null;
  precipitation_probability: number | null;
  wind_speed_max_kmh: number | null;
  weather_code: number | null;
  summary: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const lat = Number(body.lat);
    const lon = Number(body.lon);
    const startDate = String(body.start_date || '').slice(0, 10);
    const endDate = String(body.end_date || '').slice(0, 10);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return json({ error: 'invalid lat' }, 400);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) return json({ error: 'invalid lon' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return json({ error: 'invalid dates' }, 400);
    }

    // Build the inclusive date list, capped.
    const allDates = enumerateDates(startDate, endDate);
    if (allDates.length === 0) return json({ error: 'end_date must be >= start_date' }, 400);
    if (allDates.length > MAX_RANGE_DAYS) {
      return json({ error: `range too wide (max ${MAX_RANGE_DAYS} days)` }, 400);
    }

    // Round to 0.1° grid for cache key stability.
    const latGrid = Math.round(lat * 10) / 10;
    const lonGrid = Math.round(lon * 10) / 10;

    // Pull cached rows for this grid + the requested window.
    const { data: cached } = await admin
      .from('weather_snapshots')
      .select('*')
      .eq('lat_grid', latGrid)
      .eq('lon_grid', lonGrid)
      .in('date', allDates);

    const cacheMap = new Map<string, Record<string, unknown>>();
    const now = Date.now();
    for (const r of (cached ?? []) as Array<Record<string, unknown>>) {
      const fetchedAt = r.fetched_at ? new Date(r.fetched_at).getTime() : 0;
      if (now - fetchedAt < CACHE_TTL_MS) {
        cacheMap.set(r.date, r);
      }
    }

    const missing = allDates.filter((d) => !cacheMap.has(d));
    let fetchedCount = 0;
    let upstreamErr: string | null = null;

    // Only call Open-Meteo if we need to. Always fetch the FULL window
    // we requested (it's just as cheap), then upsert per-day.
    if (missing.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      // Skip if every missing day is beyond Open-Meteo's 16-day horizon.
      const horizon = isoDaysFromToday(FORECAST_RANGE_DAYS);
      const fetchableMissing = missing.filter((d) => d <= horizon && d >= today);

      if (fetchableMissing.length > 0) {
        try {
          const params = new URLSearchParams({
            latitude: String(latGrid),
            longitude: String(lonGrid),
            daily: 'temperature_2m_min,temperature_2m_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code',
            start_date: fetchableMissing[0],
            end_date: fetchableMissing[fetchableMissing.length - 1],
            timezone: 'auto',
          });
          const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
          if (!res.ok) {
            upstreamErr = `Open-Meteo ${res.status}: ${(await res.text()).slice(0, 200)}`;
          } else {
            const data = await res.json();
            const daily = data?.daily;
            if (daily && Array.isArray(daily.time)) {
              const rows: Record<string, unknown>[] = [];
              for (let i = 0; i < daily.time.length; i++) {
                const date = daily.time[i];
                const code = daily.weather_code?.[i] ?? null;
                rows.push({
                  lat_grid: latGrid,
                  lon_grid: lonGrid,
                  date,
                  temp_min_c: daily.temperature_2m_min?.[i] ?? null,
                  temp_max_c: daily.temperature_2m_max?.[i] ?? null,
                  precipitation_mm: daily.precipitation_sum?.[i] ?? null,
                  precipitation_probability: daily.precipitation_probability_max?.[i] ?? null,
                  wind_speed_max_kmh: daily.wind_speed_10m_max?.[i] ?? null,
                  weather_code: code,
                  summary: weatherCodeSummary(code, daily.temperature_2m_min?.[i], daily.temperature_2m_max?.[i]),
                  fetched_at: new Date().toISOString(),
                });
              }
              if (rows.length > 0) {
                const { error: upErr } = await admin
                  .from('weather_snapshots')
                  .upsert(rows, { onConflict: 'lat_grid,lon_grid,date' });
                if (upErr) {
                  upstreamErr = `cache upsert failed: ${upErr.message}`;
                } else {
                  fetchedCount = rows.length;
                  for (const r of rows) cacheMap.set(r.date, r);
                }
              }
            }
          }
        } catch (e) {
          upstreamErr = (e as Error).message;
        }
      }
    }

    const days: DayRow[] = allDates.map((d) => {
      const r = cacheMap.get(d);
      if (!r) {
        return {
          date: d, temp_min_c: null, temp_max_c: null,
          precipitation_mm: null, precipitation_probability: null,
          wind_speed_max_kmh: null, weather_code: null,
          summary: 'No forecast available (date out of range)',
        };
      }
      return {
        date: r.date,
        temp_min_c: r.temp_min_c,
        temp_max_c: r.temp_max_c,
        precipitation_mm: r.precipitation_mm,
        precipitation_probability: r.precipitation_probability,
        wind_speed_max_kmh: r.wind_speed_max_kmh,
        weather_code: r.weather_code,
        summary: r.summary,
      };
    });

    const summary = buildTripSummary(days);

    return json({
      days,
      summary,
      cached_count: allDates.length - fetchedCount,
      fetched_count: fetchedCount,
      upstream_error: upstreamErr,
    });
  } catch (err) {
    console.error('[weather-forecast] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00Z');
  const e = new Date(end + 'T00:00:00Z');
  if (e.getTime() < s.getTime()) return out;
  for (let t = s.getTime(); t <= e.getTime(); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function isoDaysFromToday(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// WMO weather code → one-line human summary.
// https://open-meteo.com/en/docs#weathervariables
function weatherCodeSummary(code: number | null | undefined, min?: number, max?: number): string {
  if (code == null) return 'Unknown';
  let label = 'Clear';
  if (code === 0) label = 'Clear sky';
  else if (code <= 3) label = 'Partly cloudy';
  else if (code <= 48) label = 'Fog';
  else if (code <= 57) label = 'Drizzle';
  else if (code <= 67) label = 'Rain';
  else if (code <= 77) label = 'Snow';
  else if (code <= 82) label = 'Showers';
  else if (code <= 86) label = 'Snow showers';
  else if (code <= 99) label = 'Thunderstorm';
  if (typeof min === 'number' && typeof max === 'number') {
    return `${label}, ${Math.round(min)}–${Math.round(max)}°C`;
  }
  return label;
}

function buildTripSummary(days: DayRow[]): string {
  const valid = days.filter((d) => d.temp_max_c != null);
  if (valid.length === 0) return 'No forecast data.';
  const minT = Math.min(...valid.map((d) => d.temp_min_c ?? 99));
  const maxT = Math.max(...valid.map((d) => d.temp_max_c ?? -99));
  const rainyDays = valid.filter((d) => (d.precipitation_probability ?? 0) >= 50).length;
  const parts = [`${Math.round(minT)}–${Math.round(maxT)}°C`];
  if (rainyDays > 0) parts.push(`${rainyDays} likely rainy day${rainyDays === 1 ? '' : 's'}`);
  else parts.push('mostly dry');
  return parts.join(' · ');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}
