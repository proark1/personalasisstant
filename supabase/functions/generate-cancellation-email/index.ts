import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
};

interface ContractInfo {
  name: string;
  provider?: string;
  contractNumber?: string;
  renewalDate?: string;
  userName?: string;
  userAddress?: string;
  language?: 'en' | 'de';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate. Accept either an end-user JWT or a service-role bearer
  // with x-telegram-user-id (the standard internal-call pattern used by
  // chat tools and dori-execute-action).
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const tgUserId = req.headers.get('x-telegram-user-id');
    if (serviceKey && token === serviceKey && tgUserId) {
      // Trusted internal call — skip JWT verify.
    } else {
      const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error } = await _sb.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  }

  try {
    const contractInfo: ContractInfo = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const language = contractInfo.language || 'en';
    const languageInstruction = language === 'de' 
      ? 'Write the letter in German (Deutsch).' 
      : 'Write the letter in English.';

    const prompt = `Generate a professional contract cancellation letter/email for the following contract:

Contract Name: ${contractInfo.name}
Provider/Company: ${contractInfo.provider || 'Unknown'}
Contract Number: ${contractInfo.contractNumber || 'Not provided'}
Renewal Date: ${contractInfo.renewalDate || 'Not specified'}
Customer Name: ${contractInfo.userName || '[Your Name]'}
Customer Address: ${contractInfo.userAddress || '[Your Address]'}

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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert in business correspondence. Generate professional, legally appropriate cancellation letters. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const contentText = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response
    let templates;
    try {
      const jsonMatch = contentText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        contentText.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, contentText];
      templates = JSON.parse(jsonMatch[1] || contentText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", contentText);
      templates = { 
        formalLetter: contentText,
        emailVersion: contentText,
        briefVersion: contentText
      };
    }

    return new Response(
      JSON.stringify({ success: true, templates }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Generate cancellation email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
