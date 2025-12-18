import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { userProfile, contextData } = await req.json();
    console.log('Creating OpenAI Realtime session with context:', { 
      hasProfile: !!userProfile, 
      taskCount: contextData?.allTasks?.length || 0 
    });

    // Build comprehensive system prompt
    const systemPrompt = buildSystemPrompt(userProfile, contextData);
    console.log('System prompt length:', systemPrompt.length);

    // Define tools for task management
    const tools = [
      {
        type: "function",
        name: "create_task",
        description: "Create a new task for the user. Use this when the user wants to add a new task, todo, or reminder.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "The title/name of the task" },
            priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority level" },
            category: { type: "string", enum: ["work", "personal", "health", "finance", "learning", "shopping"], description: "Task category" },
            due_date: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" }
          },
          required: ["title"]
        }
      },
      {
        type: "function",
        name: "complete_task",
        description: "Mark a task as completed/done. Use when the user says they finished, completed, or done with a task.",
        parameters: {
          type: "object",
          properties: {
            task_query: { type: "string", description: "Task name, partial name, or description to search for" }
          },
          required: ["task_query"]
        }
      },
      {
        type: "function",
        name: "trash_task",
        description: "Move a task to trash/delete it. Use when user wants to remove, delete, or trash a task.",
        parameters: {
          type: "object",
          properties: {
            task_query: { type: "string", description: "Task name, partial name, or description to search for" }
          },
          required: ["task_query"]
        }
      },
      {
        type: "function",
        name: "reschedule_task",
        description: "Change the due date of a task. Use when user wants to move, reschedule, or change when a task is due.",
        parameters: {
          type: "object",
          properties: {
            task_query: { type: "string", description: "Task name, partial name, or description to search for" },
            new_date: { type: "string", description: "New due date - can be natural language like 'tomorrow', 'next monday', or ISO date" }
          },
          required: ["task_query", "new_date"]
        }
      },
      {
        type: "function",
        name: "edit_task",
        description: "Edit/update a task's title or other properties. Use when user wants to rename or modify a task.",
        parameters: {
          type: "object",
          properties: {
            task_query: { type: "string", description: "Task name, partial name, or description to search for" },
            new_title: { type: "string", description: "New title for the task" },
            new_priority: { type: "string", enum: ["low", "medium", "high"], description: "New priority level" },
            new_category: { type: "string", enum: ["work", "personal", "health", "finance", "learning", "shopping"], description: "New category" }
          },
          required: ["task_query"]
        }
      },
      {
        type: "function",
        name: "search_tasks",
        description: "Search for tasks by name or keyword. Use to find specific tasks before operating on them.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query - task name, keyword, or partial match" }
          },
          required: ["query"]
        }
      },
      {
        type: "function",
        name: "get_task_summary",
        description: "Get a summary of today's tasks, overdue tasks, or upcoming tasks.",
        parameters: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["today", "overdue", "upcoming", "all"], description: "Type of summary" }
          },
          required: ["type"]
        }
      },
      {
        type: "function",
        name: "search_contacts",
        description: "Search for contacts by name, company, location, role, or tags. Use when user asks about people, networking, who to contact, or who they know.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term - name, company, city, country, role, or keyword" },
            location: { type: "string", description: "Filter by city or country (e.g., 'Dubai', 'UAE', 'Germany')" },
            type: { type: "string", enum: ["personal", "business", "all"], description: "Filter by contact type" }
          },
          required: ["query"]
        }
      }
    ];

    // Request ephemeral token from OpenAI
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "alloy",
        instructions: systemPrompt,
        tools: tools,
        tool_choice: "auto",
        input_audio_transcription: {
          model: "whisper-1"
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Session created successfully");

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error creating realtime session:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildSystemPrompt(userProfile: any, contextData: any): string {
  const now = new Date();
  const timeString = now.toLocaleString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  let prompt = `You are a helpful, friendly personal assistant with access to the user's tasks, calendar, contacts, and contracts. You can help manage their productivity and answer questions about their schedule and commitments.

Current date and time: ${timeString}

## Your Capabilities:
- Create, complete, trash, reschedule, and edit tasks
- Search for tasks by name or keyword
- Provide summaries of tasks (today, overdue, upcoming)
- Answer questions about contacts and contracts
- Have natural conversations with context awareness

## Important Guidelines:
1. When the user mentions a task, search for it using fuzzy matching
2. Always confirm before destructive actions (trash, complete)
3. Be concise but friendly in responses
4. Use the tools to actually perform actions - don't just describe what you would do
5. If multiple tasks match a query, list them and ask which one
6. Remember context from the conversation - if user confirms "yes", perform the action discussed

## Conversation Style:
- Be warm and encouraging
- Use natural speech patterns (contractions, casual language)
- Keep responses brief for voice - no long lists unless asked
- Acknowledge actions clearly: "Done!", "Got it!", "Task created!"
`;

  // Add user profile
  if (userProfile) {
    prompt += `\n## About the User:\n`;
    if (userProfile.display_name) prompt += `- Name: ${userProfile.display_name}\n`;
    if (userProfile.role) prompt += `- Role: ${userProfile.role}\n`;
    if (userProfile.businesses?.length) prompt += `- Businesses: ${userProfile.businesses.join(', ')}\n`;
    if (userProfile.location_city || userProfile.location_country) {
      prompt += `- Location: ${[userProfile.location_city, userProfile.location_country].filter(Boolean).join(', ')}\n`;
    }
    if (userProfile.timezone) prompt += `- Timezone: ${userProfile.timezone}\n`;
    if (userProfile.goals) prompt += `- Goals: ${userProfile.goals}\n`;
  }

  // Add task context
  if (contextData) {
    prompt += `\n## Current Task Context:\n`;
    prompt += `- Total pending tasks: ${contextData.totalPendingTasks || 0}\n`;
    prompt += `- Overdue tasks: ${contextData.totalOverdue || 0}\n`;

    if (contextData.todayTasks?.length > 0) {
      prompt += `\n### Today's Tasks:\n`;
      contextData.todayTasks.forEach((t: any) => {
        prompt += `- "${t.title}" (${t.priority} priority, ${t.category})\n`;
      });
    }

    if (contextData.overdueTasks?.length > 0) {
      prompt += `\n### Overdue Tasks:\n`;
      contextData.overdueTasks.forEach((t: any) => {
        prompt += `- "${t.title}" - was due ${t.dueDate}\n`;
      });
    }

    if (contextData.upcomingTasks?.length > 0) {
      prompt += `\n### Upcoming This Week:\n`;
      contextData.upcomingTasks.forEach((t: any) => {
        prompt += `- "${t.title}" - due ${t.dueDate}\n`;
      });
    }

    // All tasks for reference (used by tools)
    if (contextData.allTasks?.length > 0) {
      prompt += `\n### All Active Tasks (for search/matching):\n`;
      contextData.allTasks.forEach((t: any) => {
        const status = t.completed ? '[DONE]' : '';
        const due = t.dueDate ? ` - due ${t.dueDate.split('T')[0]}` : '';
        prompt += `- ID:${t.id} "${t.title}" (${t.priority}, ${t.category})${due} ${status}\n`;
      });
    }

    // Contacts due for follow-up
    if (contextData.contactsDue?.length > 0) {
      prompt += `\n### Contacts Due for Follow-up:\n`;
      contextData.contactsDue.forEach((c: any) => {
        prompt += `- ${c.name}${c.company ? ` at ${c.company}` : ''}\n`;
      });
    }

    // ALL contacts for searching
    if (contextData.allContacts?.length > 0) {
      prompt += `\n### All Contacts (${contextData.allContacts.length} total - use search_contacts tool to find specific ones):\n`;
      contextData.allContacts.forEach((c: any) => {
        const location = [c.city, c.country].filter(Boolean).join(', ');
        const tags = c.tags?.length > 0 ? ` [${c.tags.join(', ')}]` : '';
        prompt += `- ${c.name}`;
        if (c.company) prompt += ` at ${c.company}`;
        if (c.role) prompt += ` (${c.role})`;
        if (location) prompt += ` - ${location}`;
        if (c.contactType) prompt += ` | ${c.contactType}`;
        if (tags) prompt += tags;
        if (c.notes) prompt += ` | Notes: ${c.notes.substring(0, 80)}`;
        prompt += `\n`;
      });
    }

    // Contracts
    if (contextData.contractsWithRenewals?.length > 0) {
      prompt += `\n### Contracts with Upcoming Renewals:\n`;
      contextData.contractsWithRenewals.forEach((c: any) => {
        prompt += `- ${c.name} - renews ${c.renewalDate}${c.costAmount ? ` ($${c.costAmount}/${c.costFrequency})` : ''}\n`;
      });
    }

    // Events
    if (contextData.upcomingEvents?.length > 0) {
      prompt += `\n### Upcoming Events:\n`;
      contextData.upcomingEvents.forEach((e: any) => {
        const date = new Date(e.startTime).toLocaleDateString();
        const time = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        prompt += `- "${e.title}" on ${date} at ${time}${e.location ? ` at ${e.location}` : ''}\n`;
      });
    }
  }

  return prompt;
}
