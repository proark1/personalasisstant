import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
};

interface Task {
  id: string;
  title: string;
  completed: boolean;
  category: string;
  priority: string;
  dueDate?: string;
  description?: string;
}

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

interface DailyCheckin {
  mood?: string;
  energy_level?: string;
  sleep_hours?: number;
  sleep_quality?: number;
  main_focus?: string;
}

interface AIRequest {
  type: 'breakdown' | 'reschedule' | 'plan_day' | 'what_now' | 'categorize_dump';
  task?: Task;
  tasks?: Task[];
  events?: Event[];
  checkin?: DailyCheckin;
  content?: string;
  userId?: string;
}

async function logAIUsage(
  supabase: any,
  userId: string,
  functionName: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  status: string,
  requestData?: Record<string, unknown>
) {
  try {
    // Estimate cost based on model (rough estimates for Gemini Flash)
    const inputCostPer1K = 0.000075; // $0.075 per 1M input tokens
    const outputCostPer1K = 0.0003;  // $0.30 per 1M output tokens
    const costEstimate = (promptTokens / 1000) * inputCostPer1K + (completionTokens / 1000) * outputCostPer1K;

    await supabase.from('ai_usage').insert({
      user_id: userId,
      function_name: functionName,
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      cost_estimate: costEstimate,
      response_status: status,
      request_data: requestData,
    });
  } catch (error) {
    console.error('Failed to log AI usage:', error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the user
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  let userId: string;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace(/^Bearer\s+/i, '');
    // getClaims exists at runtime on supabase-js v2 in Deno; cast to any to bypass stale lib types.
    const { data, error } = await (supabase.auth as any).getClaims(token);
    if (error || !data?.claims?.sub) throw new Error('No user');
    userId = data.claims.sub;
  } catch (e) {
    console.error('Auth error:', e);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create service role client for logging
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { type, task, tasks, events, checkin }: AIRequest = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (type === 'breakdown') {
      if (!task) throw new Error("Task is required for breakdown");
      
      systemPrompt = `You are a task breakdown expert. Break complex tasks into 3-5 actionable subtasks.
Return a JSON array of subtasks with this exact structure:
[{"title": "Subtask title", "priority": "high|medium|low", "estimatedMinutes": 30}]

Guidelines:
- Make subtasks specific and actionable
- First subtask should be the easiest to build momentum
- Total time should roughly match the complexity of the main task
- Assign priorities: first 1-2 subtasks medium, rest low
- Keep titles concise (under 50 characters)`;
      
      userPrompt = `Break down this task into subtasks:
Title: ${task.title}
${task.description ? `Description: ${task.description}` : ''}
Category: ${task.category}
Priority: ${task.priority}`;

    } else if (type === 'reschedule') {
      if (!tasks) throw new Error("Tasks are required for rescheduling");
      
      const overdueTasks = tasks.filter(t => 
        !t.completed && t.dueDate && new Date(t.dueDate) < now
      );

      if (overdueTasks.length === 0) {
        return new Response(JSON.stringify({ suggestions: [], message: "No overdue tasks to reschedule!" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      systemPrompt = `You are a smart scheduler. Suggest optimal new dates for overdue tasks.
Return a JSON array with this exact structure:
[{"taskId": "id", "taskTitle": "title", "suggestedDate": "YYYY-MM-DD", "suggestedTime": "HH:MM", "reason": "Brief reason"}]

Guidelines:
- High priority tasks should be scheduled sooner (today or tomorrow)
- Consider spreading tasks across multiple days to avoid overload
- Morning slots (9-12) for high-priority, afternoon (13-17) for medium
- Business tasks during work hours, personal tasks in evening
- Provide brief, helpful reasons for each suggestion`;

      userPrompt = `Current date/time: ${now.toISOString()}

Overdue tasks to reschedule:
${overdueTasks.map(t => `- ID: ${t.id}, Title: "${t.title}", Category: ${t.category}, Priority: ${t.priority}, Was due: ${t.dueDate}`).join('\n')}

${events && events.length > 0 ? `\nExisting events to avoid conflicts:\n${events.map(e => `- ${e.title}: ${e.startTime} to ${e.endTime}`).join('\n')}` : ''}`;

    } else if (type === 'plan_day') {
      if (!tasks) throw new Error("Tasks are required for day planning");
      
      const incompleteTasks = tasks.filter(t => !t.completed);
      
      systemPrompt = `You are an AI daily planner. Create an optimal schedule for today.
Return a JSON object with this structure:
{
  "schedule": [{"time": "09:00", "taskId": "id or null", "title": "Activity title", "duration": 60, "type": "task|break|focus"}],
  "summary": "Brief motivational summary of the day plan",
  "tips": ["1-2 productivity tips based on the tasks"]
}

Guidelines:
- Start with most important/urgent tasks when energy is highest (morning)
- Include short breaks between intense tasks (5-15 min)
- Group similar category tasks together
- Reserve 1-2 focus blocks (90 min) for high-priority work
- End day with wrap-up/planning (15-30 min)
- Total scheduled time: 6-8 productive hours
- Be realistic about what can be accomplished`;

      userPrompt = `Create an optimal day plan for today (${today}).
Current time: ${now.toLocaleTimeString()}

Available tasks (${incompleteTasks.length} incomplete):
${incompleteTasks.slice(0, 15).map(t => `- ID: ${t.id}, Title: "${t.title}", Category: ${t.category}, Priority: ${t.priority}${t.dueDate ? `, Due: ${t.dueDate}` : ''}`).join('\n')}

${events && events.length > 0 ? `\nExisting events/commitments:\n${events.filter(e => e.startTime.startsWith(today)).map(e => `- ${e.title}: ${new Date(e.startTime).toLocaleTimeString()} to ${new Date(e.endTime).toLocaleTimeString()}`).join('\n')}` : 'No existing events today.'}`;

    } else if (type === 'what_now') {
      // ADHD-friendly "What should I do now?" decision helper
      if (!tasks) throw new Error("Tasks are required for what_now");
      
      const incompleteTasks = tasks.filter(t => !t.completed);
      const highPriorityTasks = incompleteTasks.filter(t => t.priority === 'high');
      const overdueTasks = incompleteTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
      
      systemPrompt = `You are an ADHD-friendly productivity coach. Your job is to help someone with ADHD decide what to do RIGHT NOW.

Return a JSON object with this exact structure:
{
  "recommendation": {
    "taskId": "id of the recommended task or null",
    "title": "Task title or suggested activity",
    "reason": "Brief, encouraging reason (1-2 sentences)",
    "estimatedMinutes": 15,
    "startTip": "One specific tip to help start this task"
  },
  "alternatives": [
    {"taskId": "id or null", "title": "Alternative task", "reason": "Why this could work", "energy": "low|medium|high"}
  ],
  "encouragement": "A short, genuine motivational message"
}

ADHD-Specific Guidelines:
- ALWAYS pick the SMALLEST, most doable task first - momentum matters more than importance
- If energy is low, suggest the easiest task regardless of priority
- Break large tasks mentally: suggest focusing on "just the first 5 minutes"
- Acknowledge that starting is the hardest part
- Provide ONE clear action, not multiple options that cause paralysis
- Consider time of day and energy levels
- If many overdue tasks, DON'T shame - focus on what's achievable NOW
- For high-stakes tasks, suggest a "warm-up" task first
- Maximum 2 alternatives to prevent decision paralysis`;

      const energyInfo = checkin ? `
Current state:
- Mood: ${checkin.mood || 'unknown'}
- Energy: ${checkin.energy_level || 'unknown'}
- Sleep: ${checkin.sleep_hours ? `${checkin.sleep_hours} hours` : 'unknown'}
- Today's focus: ${checkin.main_focus || 'not set'}
` : 'No check-in data available today.';

      userPrompt = `Current time: ${now.toLocaleTimeString()}
${energyInfo}

Tasks overview:
- Total incomplete: ${incompleteTasks.length}
- High priority: ${highPriorityTasks.length}
- Overdue: ${overdueTasks.length}

Available tasks (sorted by priority):
${incompleteTasks.slice(0, 10).map(t => `- ID: ${t.id}, Title: "${t.title}", Category: ${t.category}, Priority: ${t.priority}${t.dueDate ? `, Due: ${t.dueDate}` : ''}`).join('\n')}

Help me decide: What should I do RIGHT NOW?`;

    } else if (type === 'categorize_dump') {
      // Brain dump categorization for quick capture
      const { content: dumpContent } = await req.json().catch(() => ({ content: '' }));
      if (!dumpContent && !req.body) throw new Error("Content is required for categorization");
      
      systemPrompt = `You are an AI assistant that categorizes quick thoughts and brain dumps.
Analyze the content and determine what type of item it should become.

Return a JSON object with this exact structure:
{
  "suggested_type": "task" | "note" | "event" | "reminder",
  "suggested_category": "personal" | "business" | "family" | "work",
  "suggested_priority": "low" | "medium" | "high",
  "ai_summary": "A brief, clean title (max 50 chars)"
}

Guidelines:
- "task" = actionable item with a clear outcome
- "note" = information to remember, no action needed
- "event" = something with a specific date/time
- "reminder" = something to remember at a future point
- Extract the essence into a clean, actionable title
- Infer priority from urgency words ("urgent", "asap", "when possible")`;

      userPrompt = `Categorize this brain dump:
"${dumpContent || ''}"`;

    } else {
      throw new Error("Invalid request type");
    }

    console.log(`AI Assistant request: ${type}`);

    const model = 'gemini-2.5-flash';
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GEMINI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      // Log failed request
      await logAIUsage(supabaseAdmin, userId, `ai-assistant-${type}`, model, 0, 0, 0, 'error', { error: errorText });
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    // Extract token usage from response
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    // Log successful AI usage
    await logAIUsage(
      supabaseAdmin, 
      userId, 
      `ai-assistant-${type}`, 
      model, 
      promptTokens, 
      completionTokens, 
      totalTokens, 
      'success',
      { type }
    );
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse and return the JSON result
    let result;
    try {
      result = JSON.parse(content);
    } catch {
      // If not valid JSON, wrap the content
      result = { raw: content };
    }

    console.log(`AI Assistant ${type} completed successfully - tokens: ${totalTokens}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Assistant error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
