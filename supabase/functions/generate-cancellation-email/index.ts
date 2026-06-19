import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { strictAppOrigin } from "../_shared/cors.ts";
import { resolveUserId } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-user-id, x-internal-token",
  "X-Content-Type-Options": "nosniff",
};

interface ContractInfo {
  name: string;
  provider?: string;
  contractNumber?: string;
  renewalDate?: string;
  userName?: string;
  userAddress?: string;
  language?: "en" | "de";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await resolveUserId(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const contractInfo: ContractInfo = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const language = contractInfo.language || "en";
    const languageInstruction =
      language === "de" ? "Write the letter in German (Deutsch)." : "Write the letter in English.";

    const prompt = `Generate a professional contract cancellation letter/email for the following contract:

Contract Name: ${contractInfo.name}
Provider/Company: ${contractInfo.provider || "Unknown"}
Contract Number: ${contractInfo.contractNumber || "Not provided"}
Renewal Date: ${contractInfo.renewalDate || "Not specified"}
Customer Name: ${contractInfo.userName || "[Your Name]"}
Customer Address: ${contractInfo.userAddress || "[Your Address]"}

${languageInstruction}

Generate THREE versions:
1. **Formal Letter** - A traditional formal cancellation letter suitable for postal mail
2. **Email Version** - A professional email suitable for sending to customer service
3. **Brief Version** - A short, direct cancellation notice

For each version, include:
- Subject line (for email) or reference line
- Clear statement of cancellation
- Contract identification details
- Effective date (next possible termination date)
- Request for written confirmation
- Professional closing

Format the response as JSON:
{
  "formalLetter": "full letter text",
  "emailVersion": "full email text with subject",
  "briefVersion": "short cancellation text"
}

Return ONLY valid JSON.`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are an expert in business correspondence. Generate professional, legally appropriate cancellation letters. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 3000,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const contentText = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response
    let templates;
    try {
      const jsonMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/) ||
        contentText.match(/```\s*([\s\S]*?)\s*```/) || [null, contentText];
      templates = JSON.parse(jsonMatch[1] || contentText);
    } catch {
      console.error("Failed to parse AI response:", contentText);
      templates = {
        formalLetter: contentText,
        emailVersion: contentText,
        briefVersion: contentText,
      };
    }

    return new Response(JSON.stringify({ success: true, templates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate cancellation email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
