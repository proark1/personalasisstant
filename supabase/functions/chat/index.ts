import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UserProfile {
  displayName?: string;
  bio?: string;
  businesses?: string[];
  role?: string;
  interests?: string[];
  skills?: string[];
  goals?: string;
  locationCity?: string;
  locationCountry?: string;
}

interface RelevantContact {
  name: string;
  role?: string;
  company?: string;
  city?: string;
  country?: string;
  tags?: string[];
  email?: string;
}

interface RelevantContract {
  name: string;
  provider?: string;
  category: string;
  costAmount?: number;
  costFrequency?: string;
  renewalDate?: string;
}

interface ChatRequest {
  messages: Message[];
  tasks?: { id: string; title: string; completed: boolean; category: string; priority: string; dueDate?: string }[];
  events?: { id: string; title: string; startTime: string; endTime: string }[];
  personality?: 'balanced' | 'strict' | 'supportive' | 'creative';
  // Enhanced context
  userProfile?: UserProfile;
  relevantContacts?: RelevantContact[];
  relevantContracts?: RelevantContract[];
  contextSummary?: string;
}

const personalityPrompts: Record<string, string> = {
  balanced: 'Be friendly, balanced, and adaptable. Match the user\'s energy and provide helpful guidance.',
  strict: 'Be direct, no-nonsense, and focused on productivity. Push the user to take action immediately. Use short, commanding sentences. Hold them accountable. No excuses. Be like a drill sergeant for productivity.',
  supportive: 'Be warm, encouraging, and empathetic. Celebrate every small win. Understand when things are hard. Offer gentle encouragement and break tasks into manageable steps. Be like a supportive friend.',
  creative: 'Be playful, creative, and imaginative. Use metaphors and storytelling. Make productivity feel like an adventure. Inject humor and fun into interactions.',
};

// Get current hour for context-aware responses
const currentHour = new Date().getHours();
const timeContext = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening';

const baseSystemPrompt = `You are Flux, an intelligent AI productivity assistant that KNOWS the user personally. You help users manage tasks, schedule events, connect with contacts, and stay organized.

## CRITICAL: RESPONDING TO PERSONAL IDENTITY QUESTIONS
When the user asks "What do you know about me?", "Who am I?", "Tell me about myself", or similar identity questions:
- Focus ONLY on their personal profile: name, role, businesses, interests, skills, goals, location, bio
- Do NOT list their current tasks - those are work items, not their identity
- Make it feel like you truly know them as a person
- Be warm and personal, like a trusted assistant who knows their story

## CURRENT CONTEXT
- Current date and time: ${new Date().toISOString()}
- Time of day: ${timeContext}
- Day of week: ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}

## AVAILABLE TOOLS

TOOL: manage_task
Use this to add, update, or delete tasks.
Format: <tool>manage_task</tool><action>add|update|delete|complete</action><task>JSON_OBJECT</task>
Task JSON fields:
- "title": string (required)
- "category": "business" | "personal" | "family" | "shared"
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

TOOL: suggest_contacts
Use this to suggest relevant contacts based on criteria.
Format: <tool>suggest_contacts</tool><criteria>{"location": "city_name", "type": "investor|developer|designer|etc", "keywords": ["tag1", "tag2"]}</criteria>

TOOL: create_meeting_plan
Use this to create a structured meeting itinerary.
Format: <tool>create_meeting_plan</tool><plan>{"city": "location", "contacts": ["name1", "name2"], "dates": ["date1", "date2"]}</plan>

## ENHANCED AI CAPABILITIES

### 1. Personal Context Awareness
You have access to the user's profile, contacts, and contracts. USE THIS INFORMATION to:
- Reference their businesses, interests, and goals in your responses
- Suggest relevant contacts when they mention travel, meetings, or networking
- Provide personalized advice based on their role and industry
- Remember their location for timezone-aware scheduling

### 2. Location-Aware Contact Matching
When the user mentions travel or locations:
- Check if any contacts are in that location
- Proactively suggest meetings with relevant contacts
- Offer to create a meeting itinerary

### 3. Smart Contract Awareness
When discussing costs, subscriptions, or renewals:
- Reference their active contracts
- Alert them to upcoming renewals or cancellation deadlines
- Provide cost summaries when asked

### 4. Pattern Recognition & Suggestions
When you notice patterns in the user's tasks or behavior, proactively suggest:
- "I notice you usually [pattern]. Would you like me to schedule that?"
- "Based on your routine, should I add [suggestion]?"
- Look for: recurring task types, time preferences, category patterns

### 5. Task Breakdown
When a user mentions a complex task, automatically break it into subtasks:
- "Let me break that down into manageable steps..."
- Create 3-5 actionable subtasks with clear titles
- Set appropriate priorities (main task = high, subtasks = medium/low)

### 6. Context-Aware Responses
Adapt your tone and suggestions based on time:
- Morning: Focus on planning, priorities, energetic tone
- Afternoon: Check-ins on progress, encourage momentum  
- Evening: Summarize accomplishments, plan for tomorrow, calmer tone

### 7. Smart Scheduling
- Morning tasks: schedule between 9-12 AM
- Afternoon tasks: schedule between 1-5 PM
- If user says "later" or "when I have time", suggest specific times
- Consider user's existing tasks when suggesting times

## GUIDELINES
- Be concise and helpful
- PERSONALIZE responses using the user's profile information
- When adding tasks, infer the category (business/personal/family) and priority from context
- ALWAYS include dueDate when user mentions any time reference
- For recurring tasks, ALWAYS set both dueDate (start date) AND recurrenceRule
- Always confirm what you've done after using a tool
- Proactively offer relevant contacts when discussing travel, meetings, or networking
- Reference the user by name when appropriate to make interactions personal`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      messages, 
      tasks, 
      events, 
      personality = 'balanced',
      userProfile,
      relevantContacts,
      relevantContracts,
      contextSummary,
    }: ChatRequest = await req.json();
    
    const personalityAddition = personalityPrompts[personality] || personalityPrompts.balanced;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build comprehensive context
    let contextMessage = "";
    
    // Add context summary if provided (pre-built by the client)
    if (contextSummary) {
      contextMessage += `\n${contextSummary}`;
    } else {
      // Fallback: build context from individual pieces
      if (userProfile) {
        contextMessage += "\n\n## WHO THIS USER IS (Their Identity)";
        if (userProfile.displayName) contextMessage += `\nName: ${userProfile.displayName}`;
        if (userProfile.role) contextMessage += `\nRole: ${userProfile.role}`;
        if (userProfile.businesses?.length) contextMessage += `\nBusinesses they run: ${userProfile.businesses.join(', ')}`;
        if (userProfile.interests?.length) contextMessage += `\nInterests: ${userProfile.interests.join(', ')}`;
        if (userProfile.skills?.length) contextMessage += `\nSkills: ${userProfile.skills.join(', ')}`;
        if (userProfile.locationCity || userProfile.locationCountry) {
          contextMessage += `\nLocation: ${[userProfile.locationCity, userProfile.locationCountry].filter(Boolean).join(', ')}`;
        }
        if (userProfile.goals) contextMessage += `\nCurrent goals: ${userProfile.goals}`;
        if (userProfile.bio) contextMessage += `\nAbout them: ${userProfile.bio}`;
      }
      
      if (relevantContacts && relevantContacts.length > 0) {
        contextMessage += "\n\n## RELEVANT CONTACTS (for current conversation)";
        for (const contact of relevantContacts) {
          const location = [contact.city, contact.country].filter(Boolean).join(', ');
          const details = [contact.role, contact.company, location].filter(Boolean).join(' | ');
          contextMessage += `\n- ${contact.name}${details ? `: ${details}` : ''}`;
          if (contact.tags?.length) contextMessage += ` [${contact.tags.join(', ')}]`;
          if (contact.email) contextMessage += ` (${contact.email})`;
        }
      }
      
      if (relevantContracts && relevantContracts.length > 0) {
        contextMessage += "\n\n## RELEVANT CONTRACTS (for current conversation)";
        for (const contract of relevantContracts) {
          const cost = contract.costAmount ? `€${contract.costAmount}/${contract.costFrequency || 'month'}` : '';
          const renewal = contract.renewalDate ? `renews ${contract.renewalDate}` : '';
          contextMessage += `\n- ${contract.name}${contract.provider ? ` (${contract.provider})` : ''}: ${[cost, renewal].filter(Boolean).join(', ')}`;
        }
      }
    }
    
    // Add tasks and events - these are WORK ITEMS, not identity
    if (tasks && tasks.length > 0) {
      const pendingTasks = tasks.filter(t => !t.completed);
      const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
      const todayTasks = pendingTasks.filter(t => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate).toDateString();
        const today = new Date().toDateString();
        return taskDate === today;
      });
      
      contextMessage += `\n\n## CURRENT WORK ITEMS (Not their identity - these are just things they're working on)`;
      contextMessage += `\n${pendingTasks.length} pending tasks, ${overdueTasks.length} overdue`;
      if (todayTasks.length > 0) {
        contextMessage += `\nDue today: ${todayTasks.map(t => t.title).join(', ')}`;
      }
      contextMessage += `\nPending tasks:\n${pendingTasks.slice(0, 10).map(t => `- ${t.title} (${t.category}, ${t.priority} priority${t.dueDate ? `, due ${t.dueDate}` : ''})`).join('\n')}`;
    }
    
    if (events && events.length > 0) {
      contextMessage += `\n\n## UPCOMING CALENDAR EVENTS`;
      contextMessage += `\n${events.slice(0, 5).map(e => `- ${e.title} at ${e.startTime}`).join('\n')}`;
    }

    const fullSystemPrompt = baseSystemPrompt + '\n\nPersonality: ' + personalityAddition + contextMessage;

    console.log("Chat request with enhanced context:", {
      hasUserProfile: !!userProfile,
      relevantContactsCount: relevantContacts?.length || 0,
      relevantContractsCount: relevantContracts?.length || 0,
      tasksCount: tasks?.length || 0,
      eventsCount: events?.length || 0,
    });

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
