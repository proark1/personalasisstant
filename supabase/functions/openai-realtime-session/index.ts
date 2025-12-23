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
      taskCount: contextData?.allTasks?.length || 0,
      contactCount: contextData?.allContacts?.length || 0,
      contractCount: contextData?.allContracts?.length || 0,
      projectCount: contextData?.allProjects?.length || 0,
      hasHealthData: !!contextData?.healthData,
      healthMetricsCount: contextData?.healthData?.recentMetrics?.length || 0,
      habitCount: contextData?.habitData?.habits?.length || 0,
    });

    // Build comprehensive system prompt
    const systemPrompt = buildSystemPrompt(userProfile, contextData);
    console.log('System prompt length:', systemPrompt.length);

    // Define all tools for full platform integration
    const tools = [
      // ==================== TASK TOOLS ====================
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
            due_date: { type: "string", description: "Due date in ISO format (YYYY-MM-DD)" },
            project_id: { type: "string", description: "Optional project ID to assign this task to" }
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

      // ==================== CONTACT TOOLS ====================
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
      },
      {
        type: "function",
        name: "create_contact",
        description: "Add a new contact. Use when user wants to add someone to their contacts.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Contact's full name" },
            company: { type: "string", description: "Company or organization" },
            role: { type: "string", description: "Job title or role" },
            email: { type: "string", description: "Email address" },
            phone: { type: "string", description: "Phone number" },
            city: { type: "string", description: "City" },
            country: { type: "string", description: "Country" },
            contact_type: { type: "string", enum: ["personal", "business"], description: "Contact type" },
            notes: { type: "string", description: "Notes about this contact" }
          },
          required: ["name"]
        }
      },
      {
        type: "function",
        name: "update_contact",
        description: "Update an existing contact's information.",
        parameters: {
          type: "object",
          properties: {
            contact_query: { type: "string", description: "Contact name to search for" },
            company: { type: "string", description: "New company" },
            role: { type: "string", description: "New role" },
            email: { type: "string", description: "New email" },
            phone: { type: "string", description: "New phone" },
            city: { type: "string", description: "New city" },
            country: { type: "string", description: "New country" },
            notes: { type: "string", description: "New notes" }
          },
          required: ["contact_query"]
        }
      },
      {
        type: "function",
        name: "mark_contact_contacted",
        description: "Mark that you've contacted someone. This resets their follow-up timer. Use when user says they called, emailed, or met with someone.",
        parameters: {
          type: "object",
          properties: {
            contact_query: { type: "string", description: "Contact name to search for" }
          },
          required: ["contact_query"]
        }
      },
      {
        type: "function",
        name: "delete_contact",
        description: "Delete a contact from the address book.",
        parameters: {
          type: "object",
          properties: {
            contact_query: { type: "string", description: "Contact name to search for" }
          },
          required: ["contact_query"]
        }
      },
      {
        type: "function",
        name: "get_contacts_due",
        description: "Get contacts that are due for follow-up. Use when user asks who they should reach out to.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },

      // ==================== EVENT/CALENDAR TOOLS ====================
      {
        type: "function",
        name: "create_event",
        description: "Create a new calendar event or meeting. Use when user wants to schedule something.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Event title" },
            start_time: { type: "string", description: "Start date/time - can be natural language like 'tomorrow at 3pm' or ISO format" },
            end_time: { type: "string", description: "End date/time - can be duration like '1 hour' or specific time" },
            location: { type: "string", description: "Event location" },
            description: { type: "string", description: "Event description or notes" }
          },
          required: ["title", "start_time"]
        }
      },
      {
        type: "function",
        name: "search_events",
        description: "Search for calendar events by title, date, or location.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term - event title or keyword" },
            date_range: { type: "string", enum: ["today", "tomorrow", "this_week", "next_week", "this_month"], description: "Time range to search" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "update_event",
        description: "Update an existing calendar event.",
        parameters: {
          type: "object",
          properties: {
            event_query: { type: "string", description: "Event title to search for" },
            new_title: { type: "string", description: "New title" },
            new_start_time: { type: "string", description: "New start time" },
            new_end_time: { type: "string", description: "New end time" },
            new_location: { type: "string", description: "New location" }
          },
          required: ["event_query"]
        }
      },
      {
        type: "function",
        name: "delete_event",
        description: "Delete/cancel a calendar event.",
        parameters: {
          type: "object",
          properties: {
            event_query: { type: "string", description: "Event title to search for" }
          },
          required: ["event_query"]
        }
      },

      // ==================== CONTRACT TOOLS ====================
      {
        type: "function",
        name: "create_contract",
        description: "Add a new contract or subscription. Use when user wants to track a service, subscription, or agreement.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Contract/subscription name" },
            provider: { type: "string", description: "Service provider name" },
            category: { type: "string", enum: ["subscription", "insurance", "utilities", "lease", "service", "membership", "software", "other"], description: "Contract category" },
            cost_amount: { type: "number", description: "Cost amount" },
            cost_frequency: { type: "string", enum: ["monthly", "quarterly", "yearly", "one-time"], description: "Payment frequency" },
            renewal_date: { type: "string", description: "Renewal or expiration date" },
            auto_renews: { type: "boolean", description: "Whether it auto-renews" },
            notes: { type: "string", description: "Additional notes" }
          },
          required: ["name"]
        }
      },
      {
        type: "function",
        name: "search_contracts",
        description: "Search for contracts by name, provider, or category.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term - contract name, provider, or keyword" },
            category: { type: "string", description: "Filter by category" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "update_contract",
        description: "Update an existing contract's information.",
        parameters: {
          type: "object",
          properties: {
            contract_query: { type: "string", description: "Contract name to search for" },
            cost_amount: { type: "number", description: "New cost amount" },
            cost_frequency: { type: "string", description: "New payment frequency" },
            renewal_date: { type: "string", description: "New renewal date" },
            is_active: { type: "boolean", description: "Active status" },
            notes: { type: "string", description: "New notes" }
          },
          required: ["contract_query"]
        }
      },
      {
        type: "function",
        name: "delete_contract",
        description: "Delete a contract from tracking.",
        parameters: {
          type: "object",
          properties: {
            contract_query: { type: "string", description: "Contract name to search for" }
          },
          required: ["contract_query"]
        }
      },
      {
        type: "function",
        name: "get_contract_costs",
        description: "Get total subscription/contract costs. Use when user asks how much they spend on subscriptions.",
        parameters: {
          type: "object",
          properties: {
            frequency: { type: "string", enum: ["monthly", "yearly"], description: "Cost breakdown frequency" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_expiring_contracts",
        description: "Get contracts that are expiring soon or need renewal.",
        parameters: {
          type: "object",
          properties: {
            days: { type: "number", description: "Number of days to look ahead (default 30)" }
          },
          required: []
        }
      },

      // ==================== PROJECT TOOLS ====================
      {
        type: "function",
        name: "create_project",
        description: "Create a new project to organize tasks.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Project name" },
            description: { type: "string", description: "Project description" },
            color: { type: "string", description: "Project color (hex code or name like 'blue', 'red', etc.)" }
          },
          required: ["name"]
        }
      },
      {
        type: "function",
        name: "list_projects",
        description: "List all projects with their task counts and progress.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        type: "function",
        name: "get_project_status",
        description: "Get detailed status of a specific project including task completion.",
        parameters: {
          type: "object",
          properties: {
            project_query: { type: "string", description: "Project name to search for" }
          },
          required: ["project_query"]
        }
      },
      {
        type: "function",
        name: "add_task_to_project",
        description: "Assign an existing task to a project.",
        parameters: {
          type: "object",
          properties: {
            task_query: { type: "string", description: "Task name to search for" },
            project_query: { type: "string", description: "Project name to assign to" }
          },
          required: ["task_query", "project_query"]
        }
      },
      {
        type: "function",
        name: "update_project",
        description: "Update a project's name, description, or color.",
        parameters: {
          type: "object",
          properties: {
            project_query: { type: "string", description: "Project name to search for" },
            new_name: { type: "string", description: "New project name" },
            new_description: { type: "string", description: "New description" },
            new_color: { type: "string", description: "New color" }
          },
          required: ["project_query"]
        }
      },
      {
        type: "function",
        name: "delete_project",
        description: "Archive/delete a project (tasks are kept but unassigned).",
        parameters: {
          type: "object",
          properties: {
            project_query: { type: "string", description: "Project name to search for" }
          },
          required: ["project_query"]
        }
      },

      // ==================== HEALTH TOOLS ====================
      {
        type: "function",
        name: "get_health_summary",
        description: "Get health data summary including steps, calories, sleep, heart rate, etc. Use when user asks about their health, fitness, activity, steps, or wellness data.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "yesterday", "week", "month"], description: "Time period for health data" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_steps",
        description: "Get step count for a specific period. Use when user asks about their steps or walking activity.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "yesterday", "week"], description: "Time period for step count" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_sleep_data",
        description: "Get sleep data and hours slept. Use when user asks about their sleep.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["last_night", "week", "month"], description: "Time period for sleep data" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_calories",
        description: "Get calories burned data. Use when user asks about their calories or energy expenditure.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "yesterday", "week"], description: "Time period for calorie data" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_heart_rate",
        description: "Get heart rate data. Use when user asks about their heart rate or pulse.",
        parameters: {
          type: "object",
          properties: {
            period: { type: "string", enum: ["today", "week", "month"], description: "Time period for heart rate data" }
          },
          required: []
        }
      },
      {
        type: "function",
        name: "get_habit_summary",
        description: "Get habit tracking summary and streak information. Use when user asks about their habits or routines.",
        parameters: {
          type: "object",
          properties: {
            habit_query: { type: "string", description: "Optional habit name to filter by" }
          },
          required: []
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
    console.log("Session created successfully with", tools.length, "tools");

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

  let prompt = `You are a powerful, friendly personal assistant with FULL access to the user's productivity platform. You can manage their tasks, calendar events, contacts, contracts, and projects through voice commands.

Current date and time: ${timeString}

## Your Capabilities:
### Tasks
- Create, complete, trash, reschedule, and edit tasks
- Search tasks and get summaries (today, overdue, upcoming)
- Assign tasks to projects

### Contacts  
- Search contacts by name, company, location, or tags
- Create, update, and delete contacts
- Mark contacts as contacted (resets follow-up timer)
- See who is due for follow-up

### Calendar/Events
- Create, update, and delete calendar events
- Search events by date range or title
- Schedule meetings with natural language ("tomorrow at 3pm")

### Contracts/Subscriptions
- Track subscriptions, services, and contracts
- See total monthly/yearly costs
- Get alerts for expiring contracts
- Create, update, and delete contracts

### Projects
- Create and manage projects to organize tasks
- Get project progress and status
- Assign tasks to projects

### Health & Fitness
- Access Apple Health data (steps, calories, sleep, heart rate, weight)
- Provide health summaries for today, yesterday, or the past week
- Answer questions about fitness trends and activity levels
- Compare health metrics across different time periods

### Habits
- View habit tracking data and streaks
- Provide summaries of habit completion rates

## Important Guidelines:
1. Use fuzzy matching when searching - partial names work
2. Always confirm before destructive actions (delete, trash)
3. Be concise but friendly - this is voice, not text
4. ALWAYS use tools to perform actions - don't just describe what you would do
5. If multiple items match, list top 3 and ask which one
6. Remember conversation context - if user says "yes", do the discussed action
7. For dates, understand natural language: "tomorrow", "next monday", "in 3 days"
8. When creating events, default to 1 hour duration if not specified
9. For health data, always use the get_health_summary or specific health tools - you have FULL access to the user's health data

## Conversation Style:
- Warm and encouraging
- Natural speech (contractions, casual language)
- Brief responses for voice
- Clear confirmations: "Done!", "Got it!", "Created!"
- Proactive suggestions when relevant
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

  // Add context data
  if (contextData) {
    prompt += `\n## Current Data Summary:\n`;
    prompt += `- Pending tasks: ${contextData.totalPendingTasks || 0}\n`;
    prompt += `- Overdue tasks: ${contextData.totalOverdue || 0}\n`;
    prompt += `- Total contacts: ${contextData.totalContacts || 0}\n`;
    prompt += `- Active contracts: ${contextData.totalContracts || 0}\n`;
    prompt += `- Total projects: ${contextData.totalProjects || 0}\n`;
    prompt += `- Habits tracked: ${contextData.totalHabits || 0}\n`;
    prompt += `- Apple Health connected: ${contextData.healthData?.isConnected ? 'Yes' : 'No'}\n`;

    // Health data summary
    if (contextData.healthData?.todaySummary) {
      const h = contextData.healthData.todaySummary;
      prompt += `\n### Today's Health Summary:\n`;
      if (h.steps > 0) prompt += `- Steps: ${h.steps.toLocaleString()}\n`;
      if (h.calories > 0) prompt += `- Calories burned: ${h.calories.toLocaleString()}\n`;
      if (h.activeMinutes > 0) prompt += `- Active minutes: ${h.activeMinutes}\n`;
      if (h.sleepHours > 0) prompt += `- Sleep: ${h.sleepHours.toFixed(1)} hours\n`;
      if (h.heartRateAvg > 0) prompt += `- Avg heart rate: ${h.heartRateAvg} bpm\n`;
      if (h.weight) prompt += `- Weight: ${h.weight} kg\n`;
    }

    // Weekly health trends
    if (contextData.healthData?.weeklyData?.length > 0) {
      const weekData = contextData.healthData.weeklyData;
      const totalSteps = weekData.reduce((sum: number, d: any) => sum + (d.steps || 0), 0);
      const avgSteps = Math.round(totalSteps / weekData.length);
      const avgSleep = weekData.reduce((sum: number, d: any) => sum + (d.sleepHours || 0), 0) / weekData.length;
      prompt += `\n### Week Overview (${weekData.length} days):\n`;
      prompt += `- Average daily steps: ${avgSteps.toLocaleString()}\n`;
      if (avgSleep > 0) prompt += `- Average sleep: ${avgSleep.toFixed(1)} hours\n`;
    }

    // Habits summary
    if (contextData.habitData?.habits?.length > 0) {
      prompt += `\n### Active Habits:\n`;
      contextData.habitData.habits.slice(0, 5).forEach((h: any) => {
        prompt += `- ${h.icon} ${h.name} (${h.frequency})\n`;
      });
    }

    // Today's tasks
    if (contextData.todayTasks?.length > 0) {
      prompt += `\n### Today's Tasks:\n`;
      contextData.todayTasks.forEach((t: any) => {
        prompt += `- "${t.title}" (${t.priority} priority)\n`;
      });
    }

    // Overdue tasks
    if (contextData.overdueTasks?.length > 0) {
      prompt += `\n### Overdue Tasks:\n`;
      contextData.overdueTasks.forEach((t: any) => {
        prompt += `- "${t.title}" - was due ${t.dueDate?.split('T')[0]}\n`;
      });
    }

    // Upcoming events
    if (contextData.upcomingEvents?.length > 0) {
      prompt += `\n### Upcoming Events:\n`;
      contextData.upcomingEvents.forEach((e: any) => {
        const date = new Date(e.startTime).toLocaleDateString();
        const time = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        prompt += `- "${e.title}" on ${date} at ${time}${e.location ? ` at ${e.location}` : ''}\n`;
      });
    }

    // Contacts due for follow-up
    if (contextData.contactsDue?.length > 0) {
      prompt += `\n### Contacts Due for Follow-up:\n`;
      contextData.contactsDue.forEach((c: any) => {
        prompt += `- ${c.name}${c.company ? ` at ${c.company}` : ''}\n`;
      });
    }

    // Contracts with upcoming renewals
    if (contextData.contractsWithRenewals?.length > 0) {
      prompt += `\n### Contracts Expiring Soon:\n`;
      contextData.contractsWithRenewals.forEach((c: any) => {
        prompt += `- ${c.name} - renews ${c.renewalDate?.split('T')[0]}${c.costAmount ? ` ($${c.costAmount}/${c.costFrequency})` : ''}\n`;
      });
    }

    // Projects summary (keep short)
    if (contextData.allProjects?.length > 0) {
      prompt += `\n### Projects:\n`;
      contextData.allProjects.slice(0, 10).forEach((p: any) => {
        prompt += `- "${p.name}"${p.description ? `: ${p.description}` : ''}\n`;
      });
    }

  }

  return prompt;
}
