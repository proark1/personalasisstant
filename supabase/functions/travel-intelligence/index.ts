// Detects upcoming trips from calendar events (location field, "trip to X", flight keywords).
// Cross-references contacts in destination city, suggests packing/travel blocks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateStructured } from "../_shared/geminiStructured.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// GEMINI_API_KEY is read by generateStructured internally from env

interface DetectedTrip {
  destination: string;
  destination_country?: string;
  start_date: string;
  end_date: string;
  source_ref: string;
}

async function aiDetectTrips(events: Record<string, unknown>[]): Promise<DetectedTrip[]> {
  if (!events.length) return [];
  const list = events
    .map(
      (e, i) =>
        `[${i}] title="${e.title}" location="${e.location || ""}" start=${e.start_time} end=${e.end_time}`,
    )
    .join("\n");

  // Native generateContent + responseSchema (the OpenAI-compat endpoint with
  // forced tool_choice fails in our deployment).
  let parsed: Record<string, unknown>;
  try {
    parsed = await generateStructured({
      system:
        "Detect travel/trips from calendar events. A trip = travel to a different city/country, multi-day, OR contains flight/hotel/conference keywords. Group consecutive events at same location into one trip.",
      user: `Events:\n${list}`,
      schema: {
        type: "object",
        properties: {
          trips: {
            type: "array",
            items: {
              type: "object",
              properties: {
                destination: { type: "string", description: "City name" },
                destination_country: { type: "string" },
                start_date: { type: "string", description: "YYYY-MM-DD" },
                end_date: { type: "string", description: "YYYY-MM-DD" },
                source_event_indices: { type: "array", items: { type: "number" } },
              },
              required: ["destination", "start_date", "end_date"],
            },
          },
        },
        required: ["trips"],
      },
    });
  } catch (e) {
    console.error("AI trip detect fail", (e as Error).message);
    return [];
  }
  return ((parsed?.trips ?? []) as Record<string, unknown>[]).map((t) => ({
    destination: t.destination as string,
    destination_country: t.destination_country as string | undefined,
    start_date: t.start_date as string,
    end_date: t.end_date as string,
    source_ref: ((t.source_event_indices ?? []) as number[])
      .map((i) => (events[i] as Record<string, unknown>)?.id)
      .filter(Boolean)
      .join(","),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Internal/cron only: the gateway does not verify JWTs for /functions/v1,
  // so require the service-role bearer in code (matches the *-cron siblings).
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let userIds: string[];
    if (body.user_id) userIds = [body.user_id];
    else {
      const future = new Date(Date.now() + 60 * 86400_000).toISOString();
      const { data } = await supabase
        .from("events")
        .select("user_id")
        .gte("start_time", new Date().toISOString())
        .lte("start_time", future);
      userIds = [...new Set((data ?? []).map((e) => e.user_id))];
    }

    let total = 0;
    for (const uid of userIds) {
      const future = new Date(Date.now() + 60 * 86400_000).toISOString();
      const { data: events } = await supabase
        .from("events")
        .select("id, title, location, start_time, end_time")
        .eq("user_id", uid)
        .gte("start_time", new Date().toISOString())
        .lte("start_time", future)
        .not("location", "is", null);
      if (!events?.length) continue;

      const trips = await aiDetectTrips(events);
      if (!trips.length) continue;

      // Match contacts by city
      const { data: contacts } = await supabase
        .from("user_contacts")
        .select("id, name, location, phone, email")
        .eq("user_id", uid);

      for (const trip of trips) {
        const matched = (contacts ?? [])
          .filter((c) => c.location?.toLowerCase().includes(trip.destination.toLowerCase()))
          .slice(0, 10);

        const fp = `${trip.destination}:${trip.start_date}`;
        const { error } = await supabase.from("detected_trips").upsert(
          {
            user_id: uid,
            destination: trip.destination,
            destination_country: trip.destination_country,
            start_date: trip.start_date,
            end_date: trip.end_date,
            source: "calendar",
            source_ref: trip.source_ref,
            contacts_in_destination: matched,
            fingerprint: fp,
          },
          { onConflict: "user_id,fingerprint", ignoreDuplicates: false },
        );
        if (error) console.error("trip upsert err", error);
        else total++;
      }
    }

    return new Response(JSON.stringify({ users: userIds.length, trips: total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("travel-intelligence error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
