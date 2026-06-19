// Prayer times via the free Aladhan API.
// Looks up the caller's profile city/country, then fetches today's
// timings. No API key required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const userId: string | undefined = body.user_id;
    let city: string | undefined = body.city;
    let country: string | undefined = body.country;
    const date: string = body.date || new Date().toISOString().slice(0, 10);

    if (userId && (!city || !country)) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: prof } = await supabase
        .from("profiles")
        .select("location_city, location_country")
        .eq("user_id", userId)
        .maybeSingle();
      city = city || prof?.location_city || undefined;
      country = country || prof?.location_country || undefined;
    }

    if (!city) {
      return new Response(JSON.stringify({ ok: false, error: "No city set on profile." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aladhan expects DD-MM-YYYY in the URL path.
    const [yyyy, mm, dd] = date.split("-");
    const url = `https://api.aladhan.com/v1/timingsByCity/${dd}-${mm}-${yyyy}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country || "")}&method=2`;
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.code !== 200) {
      return new Response(
        JSON.stringify({ ok: false, error: "Aladhan lookup failed", detail: j }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const t = j.data?.timings || {};
    return new Response(
      JSON.stringify({
        ok: true,
        city,
        country,
        date,
        times: {
          fajr: t.Fajr,
          sunrise: t.Sunrise,
          dhuhr: t.Dhuhr,
          asr: t.Asr,
          maghrib: t.Maghrib,
          isha: t.Isha,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
