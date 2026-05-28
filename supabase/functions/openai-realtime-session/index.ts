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
      unreadEmails: contextData?.totalUnreadEmails || 0,
      familyMembers: contextData?.familyMembers?.length || 0,
      shoppingLists: contextData?.shoppingLists?.length || 0,
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
      },

      // ==================== NOTE TOOLS ====================
      {
        type: "function",
        name: "create_note",
        description: "Create a new note. Use when user wants to write down, note, or remember something. Good for quick thoughts, ideas, or anything the user wants to save.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Note title (optional, will use 'Untitled' if not provided)" },
            content: { type: "string", description: "Note content/body - what the user wants to save" },
            tags: { type: "array", items: { type: "string" }, description: "Optional tags to organize the note" }
          },
          required: ["content"]
        }
      },
      {
        type: "function",
        name: "search_notes",
        description: "Search for notes by title, content, or tags. Use when user wants to find a note they created.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term - note title, content keyword, or tag" }
          },
          required: ["query"]
        }
      },
      {
        type: "function",
        name: "delete_note",
        description: "Move a note to trash. Use when user wants to delete or remove a note.",
        parameters: {
          type: "object",
          properties: {
            note_query: { type: "string", description: "Note title to search for" }
          },
          required: ["note_query"]
        }
      },

      // ==================== HABIT CREATION TOOLS ====================
      {
        type: "function",
        name: "create_habit",
        description: "Create a new habit to track. Use when user wants to start tracking a new habit or daily routine.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Habit name (e.g., 'Drink 8 glasses of water', 'Meditate', 'Exercise')" },
            description: { type: "string", description: "Optional description of the habit" },
            icon: { type: "string", description: "Emoji icon for the habit (e.g., '💧', '🧘', '🏃')" },
            frequency: { type: "string", enum: ["daily", "weekly", "custom"], description: "How often the habit should be done" },
            target_count: { type: "number", description: "How many times per day/week to complete (default 1)" }
          },
          required: ["name"]
        }
      },
      {
        type: "function",
        name: "log_habit",
        description: "Mark a habit as completed/done for today. Use when user says they did their habit.",
        parameters: {
          type: "object",
          properties: {
            habit_query: { type: "string", description: "Habit name to search for" }
          },
          required: ["habit_query"]
        }
      },
      {
        type: "function",
        name: "delete_habit",
        description: "Remove/deactivate a habit. Use when user wants to stop tracking a habit.",
        parameters: {
          type: "object",
          properties: {
            habit_query: { type: "string", description: "Habit name to search for" }
          },
          required: ["habit_query"]
        }
      },

      // ==================== CHAT/MESSAGE TOOLS ====================
      {
        type: "function",
        name: "send_chat_message",
        description: "Send a direct message/chat to a contact. Supports family relationships like 'my wife', 'my mom', etc. Use when user wants to message someone.",
        parameters: {
          type: "object",
          properties: {
            recipient_query: { type: "string", description: "Contact name OR family relationship (e.g., 'John', 'my wife', 'mom')" },
            message: { type: "string", description: "Message content to send" }
          },
          required: ["recipient_query", "message"]
        }
      },

      // ==================== CALL TOOLS ====================
      {
        type: "function",
        name: "initiate_call",
        description: "Start a voice or video call to a contact. Supports family relationships like 'my wife', 'my husband', 'my mom'. Use when user says 'call [someone]'.",
        parameters: {
          type: "object",
          properties: {
            contact_query: { type: "string", description: "Contact name OR family relationship (e.g., 'John Smith', 'my wife', 'mom')" },
            call_type: { type: "string", enum: ["voice", "video"], description: "Type of call (default voice)" }
          },
          required: ["contact_query"]
        }
      },

      // ==================== STARTUP BRAINSTORMING TOOLS ====================
      {
        type: "function",
        name: "brainstorm_startup",
        description: "Help the user brainstorm and develop a startup idea. Use this when the user wants to discuss a new business, startup, venture, or company idea. This triggers a structured brainstorming session.",
        parameters: {
          type: "object",
          properties: {
            idea_name: { type: "string", description: "A name or title for the startup idea" },
            problem_statement: { type: "string", description: "The problem this startup solves" },
            target_audience: { type: "string", description: "Who this startup serves" },
            initial_thoughts: { type: "string", description: "Any initial ideas or context provided by the user" }
          },
          required: ["idea_name"]
        }
      },
      {
        type: "function",
        name: "save_startup_idea",
        description: "Save a startup idea that was discussed during brainstorming. Use this when the user wants to save or capture the current startup discussion for later review.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the startup idea" },
            description: { type: "string", description: "Brief description of the idea" },
            problem_statement: { type: "string", description: "The problem being solved" },
            target_audience: { type: "string", description: "Target customers/users" },
            unique_value_proposition: { type: "string", description: "What makes this unique" },
            key_features: { type: "array", items: { type: "string" }, description: "Main features or capabilities" },
            business_model: { type: "string", description: "How it will make money" },
            competitive_advantage: { type: "string", description: "Competitive differentiators" },
            next_steps: { type: "string", description: "Suggested next steps" }
          },
          required: ["name", "description"]
        }
      },
      {
        type: "function",
        name: "list_startup_ideas",
        description: "List the user's saved startup ideas. Use when user wants to see their previous startup brainstorms or continue working on an idea.",
        parameters: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["brainstorming", "researching", "validating", "building", "launched", "all"], description: "Filter by idea status (default: all)" }
          },
          required: []
        }
      },

      // ==================== EMAIL TOOLS ====================
      {
        type: "function",
        name: "get_email_summary",
        description: "Get a summary of the user's unread emails including count and top priority emails. Use when user asks about their inbox, emails, or messages.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        type: "function",
        name: "search_emails",
        description: "Search emails by sender name, subject, or keyword. Use when user asks about specific emails or emails from a specific person.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search term - sender name, subject keyword, or email content" }
          },
          required: ["query"]
        }
      },
      // ==================== EMAIL REPLY/COMPOSE TOOLS ====================
      {
        type: "function",
        name: "reply_to_email",
        description: "Reply to an email that the user has received. Use this when the user wants to respond to an email. The email_query is used to identify which email to reply to (match by sender name, subject, or keyword). The reply_body is the content of the reply.",
        parameters: {
          type: "object",
          properties: {
            email_query: { type: "string", description: "Identifier to match the email — sender name, subject keyword, or partial match (e.g., 'Eurowings', 'the flight email')" },
            reply_body: { type: "string", description: "The reply message content" }
          },
          required: ["email_query", "reply_body"]
        }
      },
      {
        type: "function",
        name: "compose_new_email",
        description: "Compose and send a new email (not a reply). Use when the user wants to write a fresh email to someone. Requires the recipient email address.",
        parameters: {
          type: "object",
          properties: {
            to: { type: "string", description: "Recipient email address" },
            subject: { type: "string", description: "Email subject line" },
            body: { type: "string", description: "Email body content" }
          },
          required: ["to", "subject", "body"]
        }
      },
      // ==================== Phase 3: voice parity tools ====================
      // These mirror the chat-edge tools. Execution is proxied through the
      // chat function via the default-case fallback in useOpenAIRealtime.
      { type: "function", name: "log_expense", description: "Log a personal expense. Amount + category required.", parameters: { type: "object", properties: { amount: { type: "number" }, category: { type: "string" }, note: { type: "string" }, currency: { type: "string" } }, required: ["amount", "category"] } },
      { type: "function", name: "query_expenses", description: "Show recent expenses or totals by category/period.", parameters: { type: "object", properties: { period: { type: "string", description: "today|week|month|year" }, category: { type: "string" } } } },
      { type: "function", name: "weather", description: "Get current weather / forecast for a city.", parameters: { type: "object", properties: { city: { type: "string" }, days: { type: "number" } }, required: ["city"] } },
      { type: "function", name: "find_time", description: "Find free meeting slots with named participants (workspace mode).", parameters: { type: "object", properties: { participants: { type: "array", items: { type: "string" } }, durationMinutes: { type: "number" }, withinDays: { type: "number" } }, required: ["participants", "durationMinutes"] } },
      { type: "function", name: "web_search", description: "Search the web for real-time / factual / news info.", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } },
      { type: "function", name: "undo", description: "Undo the last destructive action.", parameters: { type: "object", properties: {} } },
      { type: "function", name: "set_language", description: "Set preferred language (e.g. en, de).", parameters: { type: "object", properties: { lang: { type: "string" } }, required: ["lang"] } },
      { type: "function", name: "log_wellbeing", description: "Log mood/energy/sleep/water/exercise/stress for today.", parameters: { type: "object", properties: { mood: { type: "number" }, energy_level: { type: "number" }, sleep_hours: { type: "number" }, water_glasses: { type: "number" }, exercise_minutes: { type: "number" }, stress_level: { type: "number" }, notes: { type: "string" } } } },
      { type: "function", name: "manage_goal", description: "Create/progress/list/delete a long-term goal.", parameters: { type: "object", properties: { action: { type: "string", enum: ["create", "progress", "list", "delete"] }, name: { type: "string" }, target_value: { type: "number" }, current_value: { type: "number" }, add: { type: "number" }, unit: { type: "string" }, target_date: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "bulk_reschedule", description: "Shift many open tasks at once. when=today|overdue|tomorrow plus shift_days.", parameters: { type: "object", properties: { when: { type: "string" }, date: { type: "string" }, shift_days: { type: "number" } }, required: ["shift_days"] } },
      { type: "function", name: "summarize_emails", description: "Summarise recent unread emails into a short digest.", parameters: { type: "object", properties: { limit: { type: "number" } } } },
      { type: "function", name: "email_action", description: "Star/unstar/archive/trash/snooze/mark_read/mark_unread/forward/unsubscribe an email.", parameters: { type: "object", properties: { action: { type: "string" }, query: { type: "string" }, messageId: { type: "string" }, snoozeUntil: { type: "string" }, forwardTo: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "task_filter", description: "List tasks by status, tag, priority, or due window.", parameters: { type: "object", properties: { status: { type: "string" }, priority: { type: "string" }, tag: { type: "string" }, when: { type: "string" } } } },
      { type: "function", name: "task_tag", description: "Add or remove tags on a task.", parameters: { type: "object", properties: { query: { type: "string" }, add: { type: "array", items: { type: "string" } }, remove: { type: "array", items: { type: "string" } } }, required: ["query"] } },
      { type: "function", name: "task_estimate", description: "Set estimated minutes on a task.", parameters: { type: "object", properties: { query: { type: "string" }, minutes: { type: "number" } }, required: ["query", "minutes"] } },
      { type: "function", name: "task_complete_note", description: "Complete a task with a short note.", parameters: { type: "object", properties: { query: { type: "string" }, note: { type: "string" } }, required: ["query", "note"] } },
      { type: "function", name: "task_duplicate", description: "Duplicate a task.", parameters: { type: "object", properties: { query: { type: "string" }, title: { type: "string" }, dueDate: { type: "string" } }, required: ["query"] } },
      { type: "function", name: "task_subtask", description: "Add a subtask under a parent task.", parameters: { type: "object", properties: { parentQuery: { type: "string" }, title: { type: "string" } }, required: ["parentQuery", "title"] } },
      { type: "function", name: "task_assign", description: "Assign a task to a workspace member by display name.", parameters: { type: "object", properties: { query: { type: "string" }, assignee: { type: "string" } }, required: ["query", "assignee"] } },
      { type: "function", name: "period_log", description: "Log a period entry.", parameters: { type: "object", properties: { date: { type: "string" }, flow: { type: "string" }, symptoms: { type: "array", items: { type: "string" } }, notes: { type: "string" } } } },
      { type: "function", name: "fasting_log", description: "Log a fast (start/end times).", parameters: { type: "object", properties: { startedAt: { type: "string" }, endedAt: { type: "string" }, type: { type: "string" }, notes: { type: "string" } } } },
      { type: "function", name: "pantry", description: "Manage household pantry: add/remove/list/low.", parameters: { type: "object", properties: { action: { type: "string" }, name: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "flight_track", description: "Track a flight by number and date.", parameters: { type: "object", properties: { flightNumber: { type: "string" }, date: { type: "string" }, from: { type: "string" }, to: { type: "string" } }, required: ["flightNumber", "date"] } },
      { type: "function", name: "presence", description: "Set or query household presence (home/away/work/travel).", parameters: { type: "object", properties: { action: { type: "string" }, status: { type: "string" }, location: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "budget", description: "Set/check/list a monthly category budget.", parameters: { type: "object", properties: { action: { type: "string" }, category: { type: "string" }, amount: { type: "number" }, month: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "meds", description: "Log meds taken or schedule reminders.", parameters: { type: "object", properties: { action: { type: "string" }, name: { type: "string" }, dose: { type: "string" }, time: { type: "string" } }, required: ["action"] } },
      { type: "function", name: "zakat", description: "Calculate Zakat (2.5%).", parameters: { type: "object", properties: { wealth: { type: "number" }, currency: { type: "string" } }, required: ["wealth"] } },
      { type: "function", name: "timezone", description: "Get current local time / timezone for a city.", parameters: { type: "object", properties: { city: { type: "string" } }, required: ["city"] } },
      { type: "function", name: "currency", description: "Convert amount between currencies.", parameters: { type: "object", properties: { amount: { type: "number" }, from: { type: "string" }, to: { type: "string" } }, required: ["amount", "from", "to"] } },
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

  let prompt = `You are a powerful, friendly personal assistant with FULL access to the user's productivity platform. You can manage their tasks, calendar events, contacts, contracts, projects, notes, habits, and communications through voice commands.

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
- UNDERSTAND FAMILY RELATIONSHIPS: "my wife", "my husband", "my mom", "my dad" etc.

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

### Notes
- CREATE notes when user wants to save thoughts, ideas, or information
- Search notes by title, content, or tags
- Delete notes when requested

### Habits
- View habit tracking data and streaks
- CREATE new habits to track (e.g., "drink water", "meditate", "exercise")
- LOG habits as completed when user says they did something
- Delete habits when requested

### Calls & Messaging
- INITIATE CALLS to contacts (supports family relationships like "call my wife")
- SEND CHAT MESSAGES to contacts (supports family relationships)

### Startup Brainstorming
- BRAINSTORM new startup/business ideas with the user through structured questions
- Help develop ideas by asking about problem, target audience, unique value, business model, etc.
- SAVE startup ideas for later review and continuation
- LIST previous startup ideas the user has discussed
- When brainstorming, be a helpful co-founder: ask probing questions, suggest improvements, identify potential challenges

### Email/Inbox
- View unread emails and inbox summary
- Search emails by sender, subject, or keyword
- Summarize inbox status and priority emails
- Help user understand what needs attention in their email

## Family Relationship Understanding:
When the user says "my wife", "my husband", "my mom", "my dad", "my sister", etc., you can find the corresponding contact based on their saved family relationship. For example:
- "Call my wife" → finds contact with spouse/wife relationship
- "Send a message to my mom" → finds contact with mother relationship
- "Text my husband hello" → finds spouse contact and sends message

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
10. For notes, USE create_note when user wants to save anything - don't say you can't!
11. For habits, USE create_habit and log_habit - these are fully functional
12. ALL CONVERSATIONS ARE AUTOMATICALLY SAVED - the user can review them later in their conversation history

## Startup Brainstorming Guidelines:
When the user wants to discuss a new startup or business idea:
1. Start with "brainstorm_startup" to initiate the session
2. Ask probing questions one at a time: What problem are you solving? Who is your target customer? How is this different from existing solutions?
3. Provide constructive feedback and suggestions
4. Challenge assumptions respectfully
5. Help identify potential revenue models
6. Point out potential challenges and how to address them
7. When the user seems ready to save, use "save_startup_idea" to capture everything discussed
8. Let them know they can continue the discussion anytime by asking about their startup ideas

## Conversation Style:
- Warm and encouraging
- Natural speech (contractions, casual language)
- Brief responses for voice
- Clear confirmations: "Done!", "Got it!", "Created!"
- Proactive suggestions when relevant

## Session Start Greeting:
When you receive [SESSION_START], this means the voice session just began. Greet the user warmly and briefly based on the time of day. Keep it to 1-2 short sentences. Examples:
- Morning (before noon): "Good morning! How can I help you today?"
- Afternoon (noon to 5pm): "Hey there! What can I do for you?"
- Evening (after 5pm): "Good evening! What's on your mind?"
If you know the user's name, include it: "Hey [Name]! What can I help with?"
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

    // Unread emails
    if (contextData.unreadEmails?.length > 0) {
      prompt += `\n### Unread Emails (${contextData.totalUnreadEmails || contextData.unreadEmails.length} total):\n`;
      contextData.unreadEmails.forEach((e: any) => {
        const time = new Date(e.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        prompt += `- From ${e.from}: "${e.subject || '(no subject)'}" (${time})${e.snippet ? ` — ${e.snippet.substring(0, 80)}` : ''}\n`;
      });
    } else if (contextData.totalUnreadEmails === 0) {
      prompt += `\n### Email: Inbox is clear — no unread emails.\n`;
    }

    // Family members
    if (contextData.familyMembers?.length > 0) {
      prompt += `\n### Family Members:\n`;
      contextData.familyMembers.forEach((m: any) => {
        let info = `- **${m.name}** (${m.relationship}${m.age !== null ? `, ${m.age} years old` : ''})`;
        if (m.school) info += ` — School: ${m.school}${m.grade ? `, Grade: ${m.grade}` : ''}`;
        if (m.kindergarten) info += ` — Kindergarten: ${m.kindergarten}`;
        if (m.activities?.length > 0) info += ` — Activities: ${m.activities.map((a: any) => `${a.name} (${a.schedule})`).join(', ')}`;
        if (m.allergies?.length > 0) info += ` — ⚠️ Allergies: ${m.allergies.join(', ')}`;
        prompt += info + '\n';
      });
    }

    // Family schedule
    if (contextData.familySchedule?.todayEvents?.length > 0) {
      prompt += `\n### Today's Family Schedule:\n`;
      contextData.familySchedule.todayEvents.forEach((e: any) => {
        const time = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        prompt += `- ${e.title} at ${time}${e.location ? ` (${e.location})` : ''}\n`;
      });
    }
    if (contextData.familySchedule?.tomorrowEvents?.length > 0) {
      prompt += `\n### Tomorrow's Family Schedule:\n`;
      contextData.familySchedule.tomorrowEvents.forEach((e: any) => {
        const time = new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        prompt += `- ${e.title} at ${time}${e.location ? ` (${e.location})` : ''}\n`;
      });
    }
    if (contextData.familySchedule?.upcomingBirthdays?.length > 0) {
      prompt += `\n### Upcoming Family Birthdays:\n`;
      contextData.familySchedule.upcomingBirthdays.forEach((b: any) => {
        const daysUntil = Math.ceil((new Date(b.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        prompt += `- ${b.member} turns ${b.age} in ${daysUntil} days\n`;
      });
    }

    // Shopping lists
    if (contextData.shoppingLists?.length > 0) {
      prompt += `\n### Active Shopping Lists:\n`;
      contextData.shoppingLists.forEach((l: any) => {
        prompt += `- ${l.name}${l.dueDate ? ` (due ${l.dueDate})` : ''}\n`;
      });
    }

  }

  return prompt;
}
