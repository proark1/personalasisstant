import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface LiveSessionRequest {
  action: 'send_text';
  personality?: string;
  text?: string;
}

const personalityPrompts: Record<string, string> = {
  balanced: "You are Flux, a helpful and balanced AI assistant. Be clear, supportive, and efficient.",
  strict: "You are Flux in strict mode. Be direct, focused on productivity, and push the user to complete their tasks. No fluff, just results.",
  supportive: "You are Flux in supportive mode. Be empathetic, encouraging, and understanding. Celebrate progress and be patient.",
  creative: "You are Flux in creative mode. Think outside the box, brainstorm freely, and encourage exploration of new ideas.",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { action, personality = 'balanced', text } = await req.json() as LiveSessionRequest;

    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.balanced}

You are having a real-time voice conversation. Keep responses conversational, natural, and concise (1-3 sentences unless more detail is needed).

You can help with:
- Task management (creating, updating, completing tasks)
- Calendar scheduling (creating events, checking availability)
- General questions and brainstorming
- Productivity advice

When the user asks to create a task or schedule an event, confirm what you'll do and provide brief confirmation.`;

    if (action === 'send_text') {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Lovable AI error:', response.status, errorText);
        
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`Lovable AI error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content || "I couldn't process that. Please try again.";

      return new Response(
        JSON.stringify({ text: responseText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('Gemini Live error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
