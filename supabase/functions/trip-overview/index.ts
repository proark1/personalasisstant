// One-shot dashboard rollup for the /travel page.
//
// Returns: trips (from the trip_overview view) + segments per active
// trip + bookings + packing lists + country essentials, all in one
// round trip. The caller renders without any further joins.
//
// Body: { trip_id?: uuid }   // when set, drills into one trip only

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const tripId = typeof body.trip_id === "string" ? body.trip_id : null;

    // 1. Trip overview (cached counters baked into the view).
    let q = admin
      .from("trip_overview")
      .select("*")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true });
    if (tripId) q = q.eq("trip_id", tripId);
    const { data: trips, error: tErr } = await q;
    if (tErr) return json({ error: tErr.message }, 500);

    if (!trips || trips.length === 0) {
      return json({
        trips: [],
        segments: {},
        bookings: {},
        packing_lists: {},
        country_essentials: [],
      });
    }

    const tripIds = (trips as Array<{ trip_id: string }>).map((t) => t.trip_id);

    // 2. Parallel: segments + bookings + packing + essentials.
    const [segRes, bookRes, packRes, essRes] = await Promise.all([
      admin
        .from("trip_segments")
        .select("*")
        .in("trip_id", tripIds)
        .order("idx", { ascending: true }),
      admin
        .from("trip_bookings")
        .select("*")
        .in("trip_id", tripIds)
        .order("start_time", { ascending: true }),
      admin
        .from("packing_lists")
        .select("*")
        .in("trip_id", tripIds)
        .order("updated_at", { ascending: false }),
      admin
        .from("country_essentials")
        .select("*")
        .eq("user_id", user.id)
        .in(
          "country",
          uniq(
            (trips as Array<{ destination_country?: string | null }>)
              .map((t) => t.destination_country)
              .filter(Boolean) as string[],
          ),
        ),
    ]);

    // Group children by trip_id for the UI.
    const segments = groupBy((segRes.data ?? []) as Record<string, unknown>[], "trip_id");
    const bookings = groupBy((bookRes.data ?? []) as Record<string, unknown>[], "trip_id");
    const packing = groupBy((packRes.data ?? []) as Record<string, unknown>[], "trip_id");

    return json({
      trips,
      segments,
      bookings,
      packing_lists: packing,
      country_essentials: essRes.data ?? [],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[trip-overview] failed", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function groupBy<T extends Record<string, unknown>>(rows: T[], key: string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = String(r[key] ?? "");
    if (!out[k]) out[k] = [];
    out[k].push(r);
  }
  return out;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
