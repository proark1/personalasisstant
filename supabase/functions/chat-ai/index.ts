import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': strictAppOrigin(),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'X-Content-Type-Options': 'nosniff',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth gate
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await _sb.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const { action, messages, message, targetLanguage } = await req.json();

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    switch (action) {
      case 'smart_reply':
        systemPrompt = `You are a helpful assistant that generates smart reply suggestions for chat messages. 
        Generate 3 short, contextually appropriate reply suggestions based on the conversation history.
        Return only a JSON array of strings, no explanation.`;
        userPrompt = `Based on this conversation, suggest 3 brief replies:\n${messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}\n\nLast message to reply to: "${message}"`;
        break;

      case 'translate':
        systemPrompt = `You are a translator. Translate the given text to ${targetLanguage}. Return only the translated text, no explanation.`;
        userPrompt = message;
        break;

      case 'summarize':
        systemPrompt = `You are a helpful assistant that summarizes conversations. 
        Create a concise summary of the key points discussed.
        Keep it brief but informative.`;
        userPrompt = `Summarize this conversation:\n${messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}`;
        break;

      case 'sentiment':
        systemPrompt = `Analyze the sentiment of the message. Return a JSON object with:
        - sentiment: "positive", "negative", or "neutral"
        - confidence: number between 0 and 1
        - urgency: "high", "medium", or "low"
        No explanation, just the JSON.`;
        userPrompt = message;
        break;

      case 'transcribe_summary':
        systemPrompt = `You are a helpful assistant that creates meeting/call summaries from transcriptions.
        Identify key points, action items, and decisions made.
        Format as a structured summary.`;
        userPrompt = `Create a summary of this call transcription:\n${message}`;
        break;

      default:
        throw new Error('Invalid action');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const result = data.choices[0].message.content;

    // Parse JSON responses where applicable
    let parsedResult = result;
    if (action === 'smart_reply' || action === 'sentiment') {
      try {
        parsedResult = JSON.parse(result);
      } catch {
        // If parsing fails, return as-is
      }
    }

    return new Response(JSON.stringify({ result: parsedResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Chat AI error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
