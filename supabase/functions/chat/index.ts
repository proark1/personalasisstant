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
}

const systemPrompt = `You are Flux, an intelligent AI productivity assistant. You help users manage tasks, schedule events, and stay organized.

You have access to the following tools to manipulate the user's productivity state:

TOOL: manage_task
Use this to add, update, or delete tasks.
Format: <tool>manage_task</tool><action>add|update|delete|complete</action><task>{"title": "...", "category": "business|personal", "priority": "high|medium|low", "id": "..." (for update/delete/complete)}</task>

TOOL: schedule_event
Use this to schedule calendar events.
Format: <tool>schedule_event</tool><event>{"title": "...", "startTime": "ISO date string", "endTime": "ISO date string", "location": "..." (optional), "attendees": [...] (optional)}</event>

When the user asks you to add a task, schedule a meeting, or manage their productivity, use the appropriate tool by including it in your response.

Guidelines:
- Be concise and helpful
- When adding tasks, infer the category (business/personal) and priority (high/medium/low) from context
- When scheduling events, calculate appropriate times if not specified (default to next available business hour)
- Always confirm what you've done after using a tool
- If you need to search for information, just answer based on your knowledge

Current date and time: ${new Date().toISOString()}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, tasks, events }: ChatRequest = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
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

    const fullSystemPrompt = systemPrompt + contextMessage;

    // Convert messages to Gemini format
    const geminiMessages = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    // Add system prompt as first user message
    const contents = [
      { role: "user", parts: [{ text: fullSystemPrompt }] },
      { role: "model", parts: [{ text: "I understand. I'm Flux, your AI productivity assistant. I'll help you manage tasks and schedule events. How can I help you today?" }] },
      ...geminiMessages
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE format to OpenAI-compatible format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === '[DONE]') {
              controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
              continue;
            }
            
            try {
              const geminiData = JSON.parse(jsonStr);
              const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
              
              if (content) {
                const openAIFormat = {
                  choices: [{
                    delta: { content },
                    index: 0
                  }]
                };
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAIFormat)}\n\n`));
              }
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }
    });

    const transformedBody = response.body?.pipeThrough(transformStream);

    return new Response(transformedBody, {
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
