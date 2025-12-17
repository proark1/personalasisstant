import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: Message[];
  tasks?: { id: string; title: string; completed: boolean; category: string; priority: string }[];
  events?: { id: string; title: string; startTime: string; endTime: string }[];
  personality?: 'balanced' | 'strict' | 'supportive' | 'creative';
}

const personalityPrompts: Record<string, string> = {
  balanced: 'Be friendly, balanced, and adaptable. Match the user\'s energy and provide helpful guidance.',
  strict: 'Be direct, no-nonsense, and focused on productivity. Push the user to take action immediately. Use short, commanding sentences. Hold them accountable. No excuses. Be like a drill sergeant for productivity.',
  supportive: 'Be warm, encouraging, and empathetic. Celebrate every small win. Understand when things are hard. Offer gentle encouragement and break tasks into manageable steps. Be like a supportive friend.',
  creative: 'Be playful, creative, and imaginative. Use metaphors and storytelling. Make productivity feel like an adventure. Inject humor and fun into interactions.',
};

const systemPrompt = `You are Flux, an intelligent AI productivity assistant. You help users manage tasks, schedule events, and stay organized.

You have access to the following tools to manipulate the user's productivity state:

TOOL: manage_task
Use this to add, update, or delete tasks.
Format: <tool>manage_task</tool><action>add|update|delete|complete</action><task>JSON_OBJECT</task>
Task JSON fields:
- "title": string (required)
- "category": "business" | "personal"
- "priority": "high" | "medium" | "low"
- "dueDate": ISO date string (IMPORTANT: always set this when user mentions a date, deadline, or "starting from today")
- "recurrenceRule": RRULE string for recurring tasks (e.g., "FREQ=WEEKLY;INTERVAL=2" for every 2 weeks, "FREQ=DAILY", "FREQ=MONTHLY")
- "id": string (only for update/delete/complete actions)

TOOL: schedule_event
Use this to schedule calendar events.
Format: <tool>schedule_event</tool><event>JSON_OBJECT</event>
Event JSON fields:
- "title": string (required)
- "startTime": ISO date string (required)
- "endTime": ISO date string (required)
- "location": string (optional)
- "attendees": string[] (optional)
- "recurrenceRule": RRULE string (optional, e.g., "FREQ=WEEKLY;INTERVAL=2")

When the user asks you to add a task, schedule a meeting, or manage their productivity, use the appropriate tool by including it in your response.

Guidelines:
- Be concise and helpful
- When adding tasks, infer the category (business/personal) and priority (high/medium/low) from context
- ALWAYS include dueDate when user mentions any time reference like "today", "tomorrow", "next week", "starting from today", etc.
- For recurring tasks, ALWAYS set both dueDate (start date) AND recurrenceRule
- When scheduling events, calculate appropriate times if not specified (default to next available business hour)
- Always confirm what you've done after using a tool
- If you need to search for information, just answer based on your knowledge

Current date and time: ${new Date().toISOString()}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, tasks, events, personality = 'balanced' }: ChatRequest = await req.json();
    const personalityAddition = personalityPrompts[personality] || personalityPrompts.balanced;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context about current state
    let contextMessage = "";
    if (tasks && tasks.length > 0) {
      const pendingTasks = tasks.filter(t => !t.completed);
      contextMessage += `\nCurrent tasks (${pendingTasks.length} pending):\n${pendingTasks.map(t => `- ${t.title} (${t.category}, ${t.priority} priority)`).join('\n')}`;
    }
    if (events && events.length > 0) {
      contextMessage += `\nUpcoming events:\n${events.map(e => `- ${e.title} at ${e.startTime}`).join('\n')}`;
    }

    const fullSystemPrompt = systemPrompt + '\n\nPersonality: ' + personalityAddition + contextMessage;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream the response directly (already in OpenAI format)
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
