import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UserProfile {
  displayName?: string;
  role?: string;
  bio?: string;
  businesses?: string[];
  interests?: string[];
  skills?: string[];
  goals?: string;
  locationCity?: string;
  locationCountry?: string;
  timezone?: string;
  preferredWorkHours?: string;
}

interface LiveSessionRequest {
  action: 'send_audio' | 'send_text';
  personality?: string;
  audio?: string;
  text?: string;
  userProfile?: UserProfile;
}

const personalityPrompts: Record<string, string> = {
  balanced: "You are Flux, a helpful and balanced AI assistant. Be clear, supportive, and efficient.",
  strict: "You are Flux in strict mode. Be direct, focused on productivity, and push the user to complete their tasks. No fluff, just results.",
  supportive: "You are Flux in supportive mode. Be empathetic, encouraging, and understanding. Celebrate progress and be patient.",
  creative: "You are Flux in creative mode. Think outside the box, brainstorm freely, and encourage exploration of new ideas.",
};

function buildUserContext(profile?: UserProfile): string {
  if (!profile || !profile.displayName) return '';

  const parts: string[] = [];
  
  if (profile.displayName) {
    parts.push(`The user's name is ${profile.displayName}.`);
  }
  
  if (profile.role) {
    parts.push(`Their role is ${profile.role}.`);
  }
  
  if (profile.businesses && profile.businesses.length > 0) {
    parts.push(`They run these businesses: ${profile.businesses.join('; ')}.`);
  }
  
  if (profile.locationCity && profile.locationCountry) {
    parts.push(`Based in ${profile.locationCity}, ${profile.locationCountry}.`);
  } else if (profile.locationCountry) {
    parts.push(`Based in ${profile.locationCountry}.`);
  }
  
  if (profile.timezone) {
    parts.push(`Timezone: ${profile.timezone}.`);
  }
  
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`Interests: ${profile.interests.join(', ')}.`);
  }
  
  if (profile.skills && profile.skills.length > 0) {
    parts.push(`Skills: ${profile.skills.join(', ')}.`);
  }
  
  if (profile.goals) {
    parts.push(`Current goals: ${profile.goals}`);
  }
  
  if (profile.bio) {
    parts.push(`Background: ${profile.bio}`);
  }

  return parts.length > 0 
    ? `\n\n## User Context (use this to personalize responses)\n${parts.join('\n')}`
    : '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { action, personality = 'balanced', audio, text, userProfile } = await req.json() as LiveSessionRequest;

    const userContext = buildUserContext(userProfile);
    
    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.balanced}

You are having a real-time voice conversation. Keep responses conversational, natural, and concise (1-3 sentences unless more detail is needed).
${userContext}

You can help with:
- Task management (creating, updating, completing tasks)
- Calendar scheduling (creating events, checking availability)
- General questions and brainstorming
- Productivity advice
- Questions about the user (based on their profile context above)

When the user asks about themselves, use the profile context to give personalized answers.
When the user asks to create a task or schedule an event, confirm what you'll do and provide brief confirmation.`;

    if (action === 'send_text') {
      console.log('Processing text:', text?.substring(0, 50));
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser says: ${text}` }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Please try again.";
      console.log('Gemini response:', responseText.substring(0, 100));

      return new Response(
        JSON.stringify({ text: responseText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_audio') {
      console.log('Processing audio input');
      
      if (!audio) {
        throw new Error('Audio data is required for send_audio action');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: systemPrompt },
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: audio
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini audio API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't understand that. Please try again.";
      console.log('Gemini audio response:', responseText.substring(0, 100));

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
