import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface AIRequest {
  type: 'breakdown' | 'reschedule' | 'plan_day';
  task?: Task;
  tasks?: Task[];
  events?: Event[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, task, tasks, events }: AIRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getHours();

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

    } else {
      throw new Error("Invalid request type");
    }

    console.log(`AI Assistant request: ${type}`);

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
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
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

    console.log(`AI Assistant ${type} completed successfully`);

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
