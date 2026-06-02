import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';
import { generateStructured } from '../_shared/geminiStructured.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Fetch emails from last 6 months with payment-related keywords
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: emails, error: emailError } = await supabase
      .from("user_emails")
      .select("id, subject, from_name, from_email, snippet, received_at")
      .eq("user_id", userId)
      .eq("user_archived", false)
      .gte("received_at", sixMonthsAgo.toISOString())
      .order("received_at", { ascending: false })
      .limit(500);

    if (emailError) {
      console.error("Email fetch error:", emailError);
      return new Response(JSON.stringify({ error: "Failed to fetch emails" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing contracts to exclude duplicates
    const { data: contracts } = await supabase
      .from("contracts")
      .select("name, provider")
      .eq("user_id", userId);

    const existingNames = (contracts || []).map((c: { name?: string; provider?: string }) =>
      `${(c.name || "").toLowerCase()}|${(c.provider || "").toLowerCase()}`
    );

    // Filter emails likely related to payments/subscriptions
    const paymentKeywords = [
      "invoice", "receipt", "payment", "subscription", "billing",
      "charge", "renewal", "monthly", "yearly", "annual",
      "plan", "membership", "statement", "order confirmation",
      "auto-pay", "autopay", "direct debit", "rechnung",
      "zahlung", "abbuchung", "abonnement", "lastschrift",
    ];

    const relevantEmails = emails.filter((e: { subject?: string; snippet?: string }) => {
      const text = `${e.subject || ""} ${e.snippet || ""}`.toLowerCase();
      return paymentKeywords.some((kw) => text.includes(kw));
    });

    if (relevantEmails.length === 0) {
      return new Response(JSON.stringify({ payments: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prepare email summaries for AI (limit to keep tokens low)
    const emailSummaries = relevantEmails.slice(0, 100).map((e: { from_email?: string; from_name?: string; subject?: string; snippet?: string; received_at?: string }) => ({
      sender: e.from_email || e.from_name || "unknown",
      senderName: e.from_name || "",
      subject: e.subject || "",
      snippet: (e.snippet || "").slice(0, 120),
      date: e.received_at,
    }));

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingContractsList = (contracts || [])
      .map((c: { name?: string; provider?: string }) => `${c.name} (${c.provider || "no provider"})`)
      .join(", ");

    // Native generateContent + responseSchema (the OpenAI-compat endpoint with
    // forced tool_choice fails in our deployment).
    let parsed: { payments?: Array<Record<string, unknown>> };
    try {
      parsed = await generateStructured({
        model: "gemini-2.5-flash-lite",
        system: `You are a financial analyst. Analyze these email summaries to identify recurring payments and subscriptions. Group emails by the same sender/service. Extract structured payment information. Only include services that appear at least 2 times (indicating recurring payment). Exclude one-time purchases.`,
        user: `Here are email summaries from the last 6 months:\n\n${JSON.stringify(emailSummaries, null, 1)}\n\nExisting contracts (exclude these): ${existingContractsList || "none"}\n\nIdentify recurring payments/subscriptions. For each, extract the company name, estimated amount (if visible in subject/snippet), payment frequency, and suggested category.`,
        schema: {
          type: "object",
          properties: {
            payments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Service/company name" },
                  provider: { type: "string", description: "Provider/company full name" },
                  amount: { type: "number", description: "Detected payment amount (0 if unknown)" },
                  frequency: { type: "string", enum: ["monthly", "quarterly", "yearly"] },
                  category: { type: "string", enum: ["insurance", "utilities", "subscription", "phone", "internet", "streaming", "other"] },
                  emailCount: { type: "number", description: "Number of matching emails found" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["name", "provider", "amount", "frequency", "category", "emailCount", "confidence"],
              },
            },
          },
          required: ["payments"],
        },
      });
    } catch (e) {
      console.error("AI error:", (e as Error).message);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Filter out existing contracts
    const newPayments = (parsed.payments || []).filter((p: Record<string, unknown>) => {
      const key = `${(p.name || "").toLowerCase()}|${(p.provider || "").toLowerCase()}`;
      return !existingNames.some((existing: string) => {
        const [eName, eProvider] = existing.split("|");
        return (
          key.includes(eName) ||
          key.includes(eProvider) ||
          eName.includes(p.name.toLowerCase()) ||
          eProvider.includes(p.provider.toLowerCase())
        );
      });
    });

    return new Response(JSON.stringify({ payments: newPayments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("detect-recurring-payments error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

