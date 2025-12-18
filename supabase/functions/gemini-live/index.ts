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

interface TaskItem {
  title: string;
  category: string;
  priority: string;
  dueDate: string | null;
}

interface EventItem {
  title: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  category?: string | null;
}

interface ContactItem {
  name: string;
  company?: string | null;
  role?: string | null;
  nextContactDue?: string | null;
}

interface ContractItem {
  name: string;
  category: string;
  renewalDate?: string | null;
  costAmount?: number | null;
  costFrequency?: string | null;
}

interface ContextData {
  overdueTasks?: TaskItem[];
  todayTasks?: TaskItem[];
  upcomingTasks?: TaskItem[];
  upcomingEvents?: EventItem[];
  contactsDue?: ContactItem[];
  contractsWithRenewals?: ContractItem[];
  totalPendingTasks?: number;
  totalOverdue?: number;
  totalEvents?: number;
  totalContacts?: number;
  totalContracts?: number;
}

interface LiveSessionRequest {
  action: 'send_audio' | 'send_text';
  personality?: string;
  audio?: string;
  text?: string;
  userProfile?: UserProfile;
  contextData?: ContextData;
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
    ? `\n\n## User Identity (who they are)\n${parts.join('\n')}`
    : '';
}

function buildDataContext(contextData?: ContextData): string {
  if (!contextData) return '';

  const parts: string[] = [];
  const now = new Date();
  
  parts.push(`\n\n## Current Date & Time\n${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);

  // Summary stats
  parts.push(`\n\n## Quick Stats\n- ${contextData.totalPendingTasks || 0} pending tasks (${contextData.totalOverdue || 0} overdue)\n- ${contextData.totalEvents || 0} upcoming events\n- ${contextData.totalContacts || 0} contacts\n- ${contextData.totalContracts || 0} active contracts`);

  // Overdue tasks
  if (contextData.overdueTasks && contextData.overdueTasks.length > 0) {
    parts.push(`\n\n## OVERDUE TASKS (Need immediate attention!)`);
    for (const task of contextData.overdueTasks) {
      const dueInfo = task.dueDate ? `was due ${new Date(task.dueDate).toLocaleDateString()}` : '';
      parts.push(`- ${task.title} (${task.category}, ${task.priority} priority) ${dueInfo}`);
    }
  }

  // Today's tasks
  if (contextData.todayTasks && contextData.todayTasks.length > 0) {
    parts.push(`\n\n## TODAY'S TASKS`);
    for (const task of contextData.todayTasks) {
      const timeInfo = task.dueDate ? new Date(task.dueDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      parts.push(`- ${task.title} (${task.category}, ${task.priority} priority) ${timeInfo}`);
    }
  }

  // Upcoming tasks (next 7 days)
  if (contextData.upcomingTasks && contextData.upcomingTasks.length > 0) {
    parts.push(`\n\n## UPCOMING TASKS (Next 7 days)`);
    for (const task of contextData.upcomingTasks) {
      const dueInfo = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
      parts.push(`- ${task.title} (${task.category}) - ${dueInfo}`);
    }
  }

  // Today's and upcoming events
  if (contextData.upcomingEvents && contextData.upcomingEvents.length > 0) {
    parts.push(`\n\n## CALENDAR EVENTS (Next 7 days)`);
    for (const event of contextData.upcomingEvents) {
      const eventDate = new Date(event.startTime);
      const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const location = event.location ? ` at ${event.location}` : '';
      parts.push(`- ${event.title} - ${dateStr} at ${timeStr}${location}`);
    }
  }

  // Contacts due for follow-up
  if (contextData.contactsDue && contextData.contactsDue.length > 0) {
    parts.push(`\n\n## CONTACTS DUE FOR FOLLOW-UP`);
    for (const contact of contextData.contactsDue) {
      const details = [contact.role, contact.company].filter(Boolean).join(' at ');
      parts.push(`- ${contact.name}${details ? ` (${details})` : ''}`);
    }
  }

  // Contracts with upcoming renewals
  if (contextData.contractsWithRenewals && contextData.contractsWithRenewals.length > 0) {
    parts.push(`\n\n## CONTRACTS RENEWING SOON`);
    for (const contract of contextData.contractsWithRenewals) {
      const cost = contract.costAmount ? `€${contract.costAmount}/${contract.costFrequency || 'month'}` : '';
      const renewalDate = contract.renewalDate ? new Date(contract.renewalDate).toLocaleDateString() : '';
      parts.push(`- ${contract.name} (${contract.category}) - renews ${renewalDate} ${cost}`);
    }
  }

  return parts.join('\n');
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

    const { action, personality = 'balanced', audio, text, userProfile, contextData } = await req.json() as LiveSessionRequest;

    const userContext = buildUserContext(userProfile);
    const dataContext = buildDataContext(contextData);
    
    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.balanced}

You are having a real-time voice conversation. Keep responses conversational, natural, and concise (1-3 sentences unless more detail is needed).

## CRITICAL INSTRUCTIONS - READ CAREFULLY
1. **ONLY reference ACTUAL data provided below** - NEVER make up tasks, events, meetings, or any other information
2. When asked "What do I need to do today?", answer ONLY based on the OVERDUE TASKS and TODAY'S TASKS sections below
3. When asked about meetings or events, check ONLY the CALENDAR EVENTS section below
4. If no data exists for a category, say "You don't have any [tasks/events/etc] scheduled" - don't invent items
5. When asked about the user personally ("Who am I?", "What do you know about me?"), use ONLY the User Identity section
${userContext}
${dataContext}

## What you can help with
- Task management (discussing tasks from the data above)
- Calendar and scheduling (based on events above)
- Contacts and follow-ups (based on contacts above)
- Contracts and renewals (based on contracts above)
- General productivity advice

Remember: Be helpful but NEVER fabricate information. Only reference what's in the data above.`;

    if (action === 'send_text') {
      console.log('Processing text:', text?.substring(0, 50));
      console.log('Has context data:', !!contextData);
      
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
      console.log('Has context data:', !!contextData);
      
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
