import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'X-Content-Type-Options': 'nosniff',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { contact, type } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === 'conversation_starters') {
      systemPrompt = `You are a helpful assistant that generates personalized conversation starters based on someone's profile. Generate 5 natural, engaging conversation starters that feel genuine and appropriate for the relationship type.`;
      
      userPrompt = `Generate conversation starters for this contact:
Name: ${contact.name}
Type: ${contact.contactType}
${contact.company ? `Company: ${contact.company}` : ''}
${contact.role ? `Role: ${contact.role}` : ''}
${contact.city ? `City: ${contact.city}` : ''}
${contact.country ? `Country: ${contact.country}` : ''}
${contact.notes ? `Notes: ${contact.notes}` : ''}
${contact.tags?.length ? `Tags: ${contact.tags.join(', ')}` : ''}
${contact.personalTier ? `Relationship: ${contact.personalTier.replace('_', ' ')}` : ''}
${contact.businessLevel ? `Business Relationship: ${contact.businessLevel.replace('_', ' ')}` : ''}

Return ONLY a JSON array of 5 strings, each being a conversation starter. No explanation needed.`;
    } else if (type === 'relationship_insights') {
      systemPrompt = `You are an insightful relationship advisor. Analyze the contact information and provide actionable insights to strengthen the relationship.`;
      
      userPrompt = `Analyze this contact and provide relationship insights:
Name: ${contact.name}
Type: ${contact.contactType}
${contact.company ? `Company: ${contact.company}` : ''}
${contact.role ? `Role: ${contact.role}` : ''}
${contact.personalTier ? `Tier: ${contact.personalTier}` : ''}
${contact.businessLevel ? `Level: ${contact.businessLevel}` : ''}
${contact.notes ? `Notes: ${contact.notes}` : ''}
${contact.tags?.length ? `Tags: ${contact.tags.join(', ')}` : ''}
Last Contact: ${contact.lastContactedAt || 'Never'}
Contact Frequency: Every ${contact.contactFrequencyDays} days

Return ONLY a JSON object with:
{
  "strengthScore": number from 1-100,
  "insights": ["insight1", "insight2", "insight3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "riskLevel": "low" | "medium" | "high",
  "suggestedActions": ["action1", "action2"]
}`;
    } else {
      throw new Error("Invalid type. Use 'conversation_starters' or 'relationship_insights'");
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Contact insights error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
