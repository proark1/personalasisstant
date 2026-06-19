import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateNews } from "../_shared/briefingNews.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error,
    } = await _sb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { interests, skills, businesses, location } = await req.json();

    // Build a personalized query based on user's profile
    const topics = [...(interests || []), ...(skills || []), ...(businesses || [])];

    console.log("Generating news for topics:", topics.join(", ") || "(defaults)");

    let newsItems;
    try {
      newsItems = await generateNews(topics, location, 5);
    } catch (genError) {
      console.error("News generation failed:", genError);
      newsItems = [
        {
          headline: "Unable to fetch personalized news",
          summary: "Check back later for updates on your interests.",
          category: "General",
          url: "https://news.google.com",
        },
      ];
    }

    return new Response(JSON.stringify({ news: newsItems }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in morning-briefing function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        news: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
