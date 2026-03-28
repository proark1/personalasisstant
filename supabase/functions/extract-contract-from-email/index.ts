import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { from_name, from_email, subject, snippet, body_preview, body_html, received_at } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const emailContent = body_html || body_preview || snippet || "";
    const prompt = `You are a contract data extraction assistant. Analyze this email and extract contract/subscription details.

Email details:
- From: ${from_name || "Unknown"} <${from_email || "unknown"}>
- Subject: ${subject || "(No subject)"}
- Date: ${received_at || "unknown"}
- Content: ${emailContent.substring(0, 4000)}

Extract the following as JSON. Use null for fields you cannot determine. Be smart about inferring costs, frequencies, and categories from the email content:

{
  "provider": "string - the company/service name (clean, human-readable)",
  "costAmount": "number or null - the price/cost mentioned (just the number, e.g. 9.99)",
  "costCurrency": "string - EUR, USD, GBP etc., default EUR if unclear",
  "costFrequency": "monthly | quarterly | yearly | one_time - infer from context",
  "category": "insurance | utilities | subscription | phone | internet | streaming | other",
  "contractNumber": "string or null - any contract, invoice, order, or reference number",
  "startDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null", 
  "endDate": "YYYY-MM-DD or null",
  "autoRenews": "boolean - true if subscription/recurring, false if one-time",
  "cancellationNoticeDays": "number - typical notice period, default 30 if unknown"
}

Return ONLY valid JSON, no markdown or explanation.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    // Parse the JSON from the AI response (strip markdown fences if present)
    const jsonStr = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    let extracted;
    try {
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "Failed to parse AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract-from-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
