import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
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

interface HealthData {
  medications?: { name: string; dosage?: string; frequency?: string; isActive: boolean; refillDate?: string }[];
  appointments?: { title: string; date: string; provider?: string; type?: string; isCompleted: boolean }[];
  vaccinations?: { name: string; date: string; nextDose?: string }[];
  metrics?: { type: string; value: number; unit: string; date: string; source: string }[];
  // Daily health summary with detailed data
  dailySummary?: {
    date: string;
    steps: number;
    calories: number;
    activeMinutes: number;
    sleepHours: number;
    heartRateAvg: number;
    weight?: number;
    waterIntake: number;
    restingHeartRate?: number;
    hrv?: number;
    bloodOxygen?: number;
    distance?: number;
    flightsClimbed?: number;
    mindfulnessMinutes?: number;
    // Detailed sleep data
    sleepStartTime?: string;
    sleepEndTime?: string;
    sleepRemMinutes?: number;
    sleepDeepMinutes?: number;
    sleepCoreMinutes?: number;
    sleepAwakeMinutes?: number;
    sleepEfficiency?: number;
    sleepInBedMinutes?: number;
  };
  weeklyTrends?: {
    date: string;
    steps: number;
    sleepHours: number;
    calories: number;
    activeMinutes: number;
    heartRateAvg: number;
  }[];
  appleHealthConnected?: boolean;
}

interface OverdueTask {
  id: string;
  title: string;
  category: string;
  priority: string;
  dueDate?: string;
}

interface FamilyMemberContext {
  id: string;
  name: string;
  relationship: string;
  age: number | null;
  school: string | null;
  grade: string | null;
  teacherName: string | null;
  teacherContact: string | null;
  kindergarten: string | null;
  kindergartenTeacher: string | null;
  activities: { name: string; schedule: string; location?: string }[];
  allergies: string[];
  medicalNotes: string | null;
  livesWithUser: boolean;
}

interface FamilyEvent {
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  relatedMember: string | null;
}

interface FamilyContext {
  members: FamilyMemberContext[];
  todayEvents: FamilyEvent[];
  tomorrowEvents: FamilyEvent[];
  upcomingBirthdays: { member: string; date: string; age: number }[];
  shoppingLists: { name: string; itemCount: number }[];
}

interface ChatRequest {
  messages: Message[];
  imageUrl?: string; // Base64 data URL for image input
  tasks?: { id: string; title: string; completed: boolean; category: string; priority: string; dueDate?: string }[];
  events?: { id: string; title: string; startTime: string; endTime: string }[];
  overdueTasks?: OverdueTask[];
  todayTasks?: OverdueTask[];
  personality?: 'balanced' | 'strict' | 'supportive' | 'creative';
  // Enhanced context
  userProfile?: UserProfile;
  relevantContacts?: RelevantContact[];
  relevantContracts?: RelevantContract[];
  contextSummary?: string;
  healthData?: HealthData;
  // Family context
  familyContext?: FamilyContext;
  // Smart payload fields
  statsSummary?: string;
  emailSummary?: { subject: string; from: string; priority: string; snippet: string }[];
  notesSummary?: { title: string; snippet: string; tags: string[] }[];
  habitsSummary?: { name: string; streak: number; isCompletedToday: boolean; frequency: string }[];
  // AI Memory
  memories?: { type: string; key: string; value: string; category?: string }[];
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

const baseSystemPrompt = `You are DarAI, an intelligent AI productivity assistant that KNOWS the user AND THEIR FAMILY personally. You help users manage tasks, schedule events, connect with contacts, coordinate family activities, and stay organized.

## CRITICAL: RESPONDING TO PERSONAL IDENTITY QUESTIONS
When the user asks "What do you know about me?", "Who am I?", "Tell me about myself", or similar identity questions:
- Focus ONLY on their personal profile: name, role, businesses, interests, skills, goals, location, bio
- Do NOT list their current tasks - those are work items, not their identity
- Make it feel like you truly know them as a person
- Be warm and personal, like a trusted assistant who knows their story

## FOLLOW_UP_RULES (IMPORTANT)
After successfully executing a tool (like creating a task, event, etc.), you MUST proactively suggest the next logical step to the user in your text response.
- After creating a task: "Would you like me to break this down into smaller subtasks?" or "Should we schedule a time for this?"
- After creating an event: "Should I invite anyone to this?" or "Do you need a reminder?"
- After noting overdue tasks: "Which of these should we tackle first, or should I reschedule them?"
- After creating a project: "What's the first step we should add as a task?"
- Always end your response with a helpful, context-aware question.


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

TOOL: create_note
Use this to save notes or ideas the user wants to remember.
Format: <tool>create_note</tool><note>JSON_OBJECT</note>
Note JSON fields:
- "title": string (required) - A short descriptive title for the note
- "content": string (required) - The full content/body of the note
- "tags": string[] (optional) - Tags to categorize the note

When to use this tool:
- When user says "make a note", "save this", "remember this", "note down", "write down"
- When user shares ideas, thoughts, or information they want to keep
- When user dictates content they want saved for later
- Extract a clear title from what they're saying
- The content should capture the full idea/information

TOOL: add_shopping_item
Use this to add items to the family shopping list.
Format: <tool>add_shopping_item</tool><item>JSON_OBJECT</item>
Item JSON fields:
- "name": string (required) - Name of the item
- "quantity": number (optional, default 1)
- "category": string (optional) - Category like "produce", "dairy", "meat", etc.

TOOL: suggest_contacts
Use this to suggest relevant contacts based on criteria.
Format: <tool>suggest_contacts</tool><criteria>{"location": "city_name", "type": "investor|developer|designer|etc", "keywords": ["tag1", "tag2"]}</criteria>

TOOL: create_meeting_plan
Use this to create a structured meeting itinerary.
Format: <tool>create_meeting_plan</tool><plan>{"city": "location", "contacts": ["name1", "name2"], "dates": ["date1", "date2"]}</plan>

TOOL: manage_contact
Use this to create, update, delete, search contacts, or mark a contact as contacted.
Format: <tool>manage_contact</tool><action>create|update|delete|mark_contacted|search</action><contact>JSON_OBJECT</contact>
Contact JSON fields:
- "name": string (required for create)
- "email": string (optional)
- "phone": string (optional)
- "company": string (optional)
- "role": string (optional)
- "city": string (optional)
- "country": string (optional)
- "contactType": "personal" | "business" | "family" (optional)
- "notes": string (optional)
- "query": string (for search/update/delete — matches name, email, or company)

TOOL: manage_contract
Use this to create, update, delete, or search contracts and subscriptions.
Format: <tool>manage_contract</tool><action>create|update|delete|search|get_costs</action><contract>JSON_OBJECT</contract>
Contract JSON fields:
- "name": string (required for create)
- "provider": string (optional)
- "category": string (optional, e.g. "insurance", "subscription", "telecom")
- "costAmount": number (optional)
- "costFrequency": "monthly" | "yearly" | "weekly" (optional)
- "renewalDate": ISO date string (optional)
- "autoRenews": boolean (optional)
- "notes": string (optional)
- "query": string (for search/update/delete — matches name or provider)

TOOL: manage_project
Use this to create, update, delete, list, or get status of projects.
Format: <tool>manage_project</tool><action>create|update|delete|list|get_status</action><project>JSON_OBJECT</project>
Project JSON fields:
- "name": string (required for create)
- "description": string (optional)
- "color": string (optional)
- "query": string (for update/delete/get_status — matches project name)

TOOL: manage_habit
Use this to create, log completion, or delete habits.
Format: <tool>manage_habit</tool><action>create|log|delete|summary</action><habit>JSON_OBJECT</habit>
Habit JSON fields:
- "name": string (required for create)
- "description": string (optional)
- "icon": string (optional)
- "frequency": "daily" | "weekly" | "monthly" (optional, default daily)
- "targetCount": number (optional, default 1)
- "query": string (for log/delete — matches habit name)

TOOL: manage_note
Use this to create, search, or delete notes. Replaces the simpler create_note tool.
Format: <tool>manage_note</tool><action>create|search|delete</action><note>JSON_OBJECT</note>
Note JSON fields:
- "title": string (required for create)
- "content": string (required for create)
- "tags": string[] (optional)
- "query": string (for search/delete — matches title or content)

TOOL: compose_email
Use this to draft an email for the user.
Format: <tool>compose_email</tool><email>JSON_OBJECT</email>
Email JSON fields:
- "to": string (required — email address of recipient)
- "subject": string (required)
- "body": string (required — the email body text)

TOOL: get_summary
Use this to retrieve a summary of specific data the user asks about.
Format: <tool>get_summary</tool><type>health|email|contacts_due|contract_costs|habits</type>
Use this when the user asks "what are my costs?", "how's my health?", "any emails?", "who should I contact?", "how are my habits?"

TOOL: set_reminder
Use this to set a timed reminder/alarm for the user.
Format: <tool>set_reminder</tool><reminder>JSON_OBJECT</reminder>
Reminder JSON fields:
- "message": string (required — what to remind the user about)
- "triggerAt": ISO date string (required — when to trigger the reminder)

When to use:
- "Remind me in 30 minutes to..." → calculate triggerAt = now + 30 minutes
- "Remind me at 3pm to..." → set triggerAt to today at 3pm (or tomorrow if 3pm has passed)
- "Remind me tomorrow morning to..." → set triggerAt to tomorrow at 9am
- Always confirm what you set and when it will trigger

## FAMILY-AWARE AI CAPABILITIES

### 1. Family Context Awareness
You have complete knowledge of the user's family:
- Children: names, ages, schools, grades, teachers, activities, allergies, medical notes
- Spouse: name and details
- Extended family: grandparents, siblings, etc.
- Family schedule: today's and tomorrow's family events
- Shopping lists: active lists for the household

### 2. Family-Specific Commands
When the user asks about family, respond with specific knowledge:
- "What does the family have planned today?" → List all family events with times
- "When is [child]'s next [activity]?" → Reference the child's activities
- "Add milk to the shopping list" → Use add_shopping_item tool
- "Remind me about [child]'s parent-teacher conference" → Create appropriate task/event
- "What time does my son need to be at soccer?" → Check activities and events

### 3. Proactive Family Coordination
- Notice scheduling conflicts between family members
- Suggest coordination: "Both kids have early dismissal on Friday - you might want to arrange a sitter"
- Remind about upcoming birthdays, school events, activities
- Consider allergies when discussing meals or activities
- Factor in school schedules and activity times

### 4. Child-Aware Responses
When a question relates to a specific child:
- Use the child's name in your response
- Consider their age for age-appropriate suggestions
- Reference their school, activities, or medical info as relevant
- Mention relevant upcoming events for them

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

### 4. Health & Wellness Awareness
When the user asks about their health, medications, or appointments:
- Reference their active medications, dosages, and refill dates
- Mention upcoming medical appointments
- Note any vaccinations and when next doses are due
- Be proactive about medication refill reminders
- You can help track symptoms, remind about appointments, or discuss health-related tasks

### 5. Fitness & Health Metrics Tracking
When the user asks about their steps, fitness, weight, blood pressure, or other health metrics:
- You have access to their recent health metrics including steps, weight, blood pressure, heart rate, sleep, etc.
- Summarize their recent data trends (e.g., "Over the past week, you averaged 7,500 steps per day")
- Provide insights on their progress and patterns
- Help them set and track health goals
- Note the source of data (Apple Health, manual entry, etc.)

### 6. Pattern Recognition & Suggestions
When you notice patterns in the user's tasks or behavior, proactively suggest:
- "I notice you usually [pattern]. Would you like me to schedule that?"
- "Based on your routine, should I add [suggestion]?"
- Look for: recurring task types, time preferences, category patterns

### 7. PROACTIVE OVERDUE TASK MANAGEMENT
When you see overdue tasks:
- Proactively mention them at the start of conversations
- Suggest realistic reschedule options (e.g., "I see you have 3 overdue tasks. Want me to reschedule them?")
- Offer to prioritize or break down large overdue tasks
- Never be judgmental - be supportive and solution-focused
- Example: "Good morning! I noticed your task 'Call dentist' was due yesterday. Would you like to reschedule it for today or later this week?"

### 8. Task Breakdown
When a user mentions a complex task, automatically break it into subtasks:
- "Let me break that down into manageable steps..."
- Create 3-5 actionable subtasks with clear titles
- Set appropriate priorities (main task = high, subtasks = medium/low)

### 9. Context-Aware Responses
Adapt your tone and suggestions based on time:
- Morning: Focus on planning, priorities, energetic tone. Mention any overdue tasks or today's priorities.
- Afternoon: Check-ins on progress, encourage momentum  
- Evening: Summarize accomplishments, plan for tomorrow, calmer tone

### 10. Smart Scheduling
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
- Reference the user by name when appropriate to make interactions personal
- PROACTIVELY mention overdue tasks and offer to reschedule them
- USE FAMILY MEMBER NAMES when discussing family matters - make it personal!

## MEMORY MANAGEMENT

TOOL: save_memory
Use this to remember important facts, preferences, or patterns about the user for future conversations.
Format: <tool>save_memory</tool><memory>JSON_OBJECT</memory>
Fields:
- "type": "preference" | "fact" | "pattern" | "goal" | "milestone"
- "key": short unique key (snake_case, e.g. "morning_routine", "wife_name")
- "value": what to remember (concise sentence)
- "category": optional grouping ("health", "family", "work", "lifestyle", "food", "travel")

WHEN TO USE save_memory:
- User states a preference ("I like...", "I prefer...", "I always...", "I hate...")
- User shares a personal fact ("My wife's name is...", "I work from...", "I'm allergic to...")
- User mentions routines or patterns ("I usually...", "Every morning I...")
- User sets or achieves a goal
- User corrects you about something — save the correction

IMPORTANT: Use save_memory naturally without telling the user you're saving it. Just acknowledge what they said and silently save it. Do NOT say "I'll remember that" — just do it.

TOOL: web_search
Use this to search the web for real-time information, current events, recommendations, how-to guides, or any question outside the user's personal data.
Format: <tool>web_search</tool><query>{"q": "the search query"}</query>

WHEN TO USE web_search:
- User asks a general knowledge question ("What is...", "How do I...", "Why does...")
- User asks about current events, news, weather, sports scores
- User asks for recommendations ("Best restaurant near...", "Top rated...")
- User asks about prices, products, or services
- User asks how to do something you're not confident about
- User asks about specific companies, people, or places
- ANY question that is NOT about their personal tasks, events, contacts, contracts, family, or health data

IMPORTANT: When you need real-time or factual information, ALWAYS use web_search. Do NOT make up facts or give outdated information. After receiving search results, synthesize a clear answer with the sources cited as [1], [2], etc.

## MULTI-TOOL CHAINING
You CAN use multiple tools in a single response. For example:
- Create a task AND set a reminder for it
- Add a contact AND schedule a meeting with them
- Create multiple tasks at once when breaking down a project
Just include multiple tool XML blocks in your response. Each will be executed.

## REASONING GUIDELINES
Before responding, think step by step:
1. What is the user actually asking for?
2. Do I have the data in my context to answer, or do I need a tool?
3. What's the most helpful thing I can do beyond just answering the question?
4. Is there something proactive I should mention (overdue tasks, upcoming deadlines, health trends)?`;


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

// Detect if user's message likely needs a web search (avoids two-pass)
function detectWebSearchIntent(msg: string): boolean {
  const searchPatterns = [
    /^(what|who|where|when|why|how)\s+(is|are|was|were|do|does|did|can|could|should|would)/i,
    /\b(latest|current|recent|today'?s?|news|price|cost of|weather|score|recipe for|best|top|review|recommend)\b/i,
    /\b(search|look up|find out|google|tell me about)\b/i,
    /\b(what happened|what's happening|trending)\b/i,
  ];
  
  // Don't trigger for personal data queries
  const personalPatterns = [
    /\b(my task|my event|my contact|my contract|my habit|my note|my email|my family|my health|my calendar|my schedule|add|create|delete|update|complete|mark|remind me|set reminder)\b/i,
    /\b(shopping list|brain dump|how am i doing|life score)\b/i,
  ];
  
  if (personalPatterns.some(p => p.test(msg))) return false;
  return searchPatterns.some(p => p.test(msg));
}

// Extract a clean search query from the user message
function extractSearchQuery(msg: string): string {
  // Remove common prefixes
  return msg
    .replace(/^(hey dori|dori|can you|could you|please|search for|look up|google|find out|tell me)\s*/i, '')
    .replace(/\?$/, '')
    .trim() || msg;
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
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  let userId: string;

  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    // Trusted server-to-server call (e.g. Telegram bot): accept service-role token + explicit user id header
    const telegramUserId = req.headers.get('x-telegram-user-id');
    if (telegramUserId && token === supabaseServiceKey) {
      userId = telegramUserId;
    } else {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims?.sub) throw new Error('No user');
      userId = data.claims.sub;
    }
  } catch (e) {
    console.error('Auth error:', e);
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Create service role client for logging
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      messages, 
      imageUrl,
      tasks, 
      events,
      overdueTasks: clientOverdueTasks,
      todayTasks: clientTodayTasks,
      personality = 'balanced',
      userProfile,
      relevantContacts,
      relevantContracts,
      contextSummary,
      healthData,
      familyContext,
      // Smart payload fields
      statsSummary,
      emailSummary,
      notesSummary,
      habitsSummary,
      // AI Memory
      memories,
    }: ChatRequest = await req.json();
    
    const personalityAddition = personalityPrompts[personality] || personalityPrompts.balanced;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!messages?.length) {
      throw new Error("At least one message is required");
    }
    
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
    
    // Add overdue tasks prominently if provided by client (for proactive suggestions)
    if (clientOverdueTasks && clientOverdueTasks.length > 0) {
      contextMessage += `\n\n## ⚠️ OVERDUE TASKS REQUIRING ATTENTION (${clientOverdueTasks.length} total)`;
      contextMessage += `\nThese tasks are past their due date and need to be addressed. Proactively mention these and offer to reschedule!`;
      for (const task of clientOverdueTasks) {
        const daysOverdue = task.dueDate 
          ? Math.floor((Date.now() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        contextMessage += `\n- "${task.title}" (${task.priority} priority, ${task.category}) - ${daysOverdue} day(s) overdue`;
      }
    }

    // Add today's tasks
    if (clientTodayTasks && clientTodayTasks.length > 0) {
      contextMessage += `\n\n## 📅 TODAY'S TASKS (${clientTodayTasks.length} total)`;
      for (const task of clientTodayTasks) {
        contextMessage += `\n- "${task.title}" (${task.priority} priority, ${task.category})`;
      }
    }

    // Add all tasks and events context
    if (tasks && tasks.length > 0) {
      const pendingTasks = tasks.filter(t => !t.completed);
      const overdueCount = clientOverdueTasks?.length || pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
      const todayCount = clientTodayTasks?.length || pendingTasks.filter(t => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate).toDateString();
        const today = new Date().toDateString();
        return taskDate === today;
      }).length;
      
      contextMessage += `\n\n## CURRENT WORK ITEMS (Not their identity - these are just things they're working on)`;
      contextMessage += `\n${pendingTasks.length} pending tasks, ${overdueCount} overdue, ${todayCount} due today`;
      contextMessage += `\nPending tasks:\n${pendingTasks.slice(0, 10).map(t => `- ${t.title} (${t.category}, ${t.priority} priority${t.dueDate ? `, due ${t.dueDate}` : ''})`).join('\n')}`;
    }
    
    if (events && events.length > 0) {
      // Filter to only future events (in case client sends mixed data)
      const now = new Date();
      const futureEvents = events.filter(e => new Date(e.startTime) > now);
      
      if (futureEvents.length > 0) {
        contextMessage += `\n\n## UPCOMING CALENDAR EVENTS (Future events the user has scheduled)`;
        contextMessage += `\nTotal upcoming events: ${futureEvents.length}`;
        
        // Group by time period for better context
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() + 7);
        
        const todayEvents = futureEvents.filter(e => new Date(e.startTime) <= today);
        const tomorrowEvents = futureEvents.filter(e => {
          const eventDate = new Date(e.startTime);
          return eventDate > today && eventDate <= tomorrow;
        });
        const thisWeekEvents = futureEvents.filter(e => {
          const eventDate = new Date(e.startTime);
          return eventDate > tomorrow && eventDate <= thisWeek;
        });
        const laterEvents = futureEvents.filter(e => new Date(e.startTime) > thisWeek);
        
        if (todayEvents.length > 0) {
          contextMessage += `\n\n### Today:`;
          contextMessage += `\n${todayEvents.map(e => `- ${e.title} at ${new Date(e.startTime).toLocaleTimeString()}`).join('\n')}`;
        }
        
        if (tomorrowEvents.length > 0) {
          contextMessage += `\n\n### Tomorrow:`;
          contextMessage += `\n${tomorrowEvents.map(e => `- ${e.title} at ${new Date(e.startTime).toLocaleTimeString()}`).join('\n')}`;
        }
        
        if (thisWeekEvents.length > 0) {
          contextMessage += `\n\n### This week:`;
          contextMessage += `\n${thisWeekEvents.map(e => `- ${e.title} on ${new Date(e.startTime).toLocaleDateString()} at ${new Date(e.startTime).toLocaleTimeString()}`).join('\n')}`;
        }
        
        if (laterEvents.length > 0) {
          contextMessage += `\n\n### Later (next 30 days):`;
          contextMessage += `\n${laterEvents.slice(0, 10).map(e => `- ${e.title} on ${new Date(e.startTime).toLocaleDateString()}`).join('\n')}`;
          if (laterEvents.length > 10) {
            contextMessage += `\n... and ${laterEvents.length - 10} more events`;
          }
        }
      } else {
        contextMessage += `\n\n## UPCOMING CALENDAR EVENTS: None scheduled in the near future`;
      }
    } else {
      contextMessage += `\n\n## UPCOMING CALENDAR EVENTS: None scheduled`;
    }

    // Add health data
    if (healthData) {
      contextMessage += `\n\n## HEALTH & WELLNESS DATA`;
      
      // Daily summary from Apple Health / fitness tracking
      if (healthData.dailySummary) {
        const ds = healthData.dailySummary;
        contextMessage += `\n\n### Today's Health Summary (${ds.date}):`;
        contextMessage += `\n- Steps: ${ds.steps.toLocaleString()}`;
        contextMessage += `\n- Calories burned: ${ds.calories.toLocaleString()}`;
        contextMessage += `\n- Active minutes: ${ds.activeMinutes}`;
        if (ds.distance) contextMessage += `\n- Distance: ${ds.distance.toFixed(1)} km`;
        if (ds.flightsClimbed) contextMessage += `\n- Flights climbed: ${ds.flightsClimbed}`;
        contextMessage += `\n- Heart rate (avg): ${ds.heartRateAvg} bpm`;
        if (ds.restingHeartRate) contextMessage += `\n- Resting heart rate: ${ds.restingHeartRate} bpm`;
        if (ds.hrv) contextMessage += `\n- Heart Rate Variability (HRV): ${ds.hrv} ms`;
        if (ds.bloodOxygen) contextMessage += `\n- Blood oxygen: ${ds.bloodOxygen}%`;
        if (ds.weight) contextMessage += `\n- Weight: ${ds.weight} kg`;
        contextMessage += `\n- Water intake: ${ds.waterIntake} glasses`;
        if (ds.mindfulnessMinutes) contextMessage += `\n- Mindfulness: ${ds.mindfulnessMinutes} minutes`;
        
        // Detailed sleep data
        if (ds.sleepHours > 0) {
          contextMessage += `\n\n### Last Night's Sleep:`;
          contextMessage += `\n- Total sleep: ${ds.sleepHours.toFixed(1)} hours`;
          if (ds.sleepStartTime && ds.sleepEndTime) {
            const startTime = new Date(ds.sleepStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(ds.sleepEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            contextMessage += `\n- Bedtime: ${startTime} → Woke up: ${endTime}`;
          }
          if (ds.sleepInBedMinutes) contextMessage += `\n- Time in bed: ${Math.round(ds.sleepInBedMinutes / 60 * 10) / 10} hours`;
          if (ds.sleepEfficiency) contextMessage += `\n- Sleep efficiency: ${ds.sleepEfficiency}%`;
          
          // Sleep stages
          if (ds.sleepDeepMinutes || ds.sleepRemMinutes || ds.sleepCoreMinutes) {
            contextMessage += `\n- Sleep stages:`;
            if (ds.sleepDeepMinutes) contextMessage += `\n  - Deep sleep: ${ds.sleepDeepMinutes} min (${Math.round(ds.sleepDeepMinutes / (ds.sleepHours * 60) * 100)}%)`;
            if (ds.sleepRemMinutes) contextMessage += `\n  - REM sleep: ${ds.sleepRemMinutes} min (${Math.round(ds.sleepRemMinutes / (ds.sleepHours * 60) * 100)}%)`;
            if (ds.sleepCoreMinutes) contextMessage += `\n  - Core/Light sleep: ${ds.sleepCoreMinutes} min`;
            if (ds.sleepAwakeMinutes) contextMessage += `\n  - Awake time: ${ds.sleepAwakeMinutes} min`;
          }
        }
      }
      
      // Weekly trends
      if (healthData.weeklyTrends && healthData.weeklyTrends.length > 0) {
        const avgSteps = healthData.weeklyTrends.reduce((sum, d) => sum + d.steps, 0) / healthData.weeklyTrends.length;
        const avgSleep = healthData.weeklyTrends.reduce((sum, d) => sum + d.sleepHours, 0) / healthData.weeklyTrends.length;
        const avgCalories = healthData.weeklyTrends.reduce((sum, d) => sum + d.calories, 0) / healthData.weeklyTrends.length;
        
        contextMessage += `\n\n### Weekly Health Trends (last ${healthData.weeklyTrends.length} days):`;
        contextMessage += `\n- Avg daily steps: ${Math.round(avgSteps).toLocaleString()}`;
        contextMessage += `\n- Avg sleep: ${avgSleep.toFixed(1)} hours/night`;
        contextMessage += `\n- Avg calories burned: ${Math.round(avgCalories).toLocaleString()}`;
      }
      
      if (healthData.medications && healthData.medications.length > 0) {
        const activeMeds = healthData.medications.filter(m => m.isActive);
        if (activeMeds.length > 0) {
          contextMessage += `\n\n### Active Medications (${activeMeds.length}):`;
          for (const med of activeMeds) {
            const details = [med.dosage, med.frequency].filter(Boolean).join(', ');
            const refill = med.refillDate ? ` - Refill: ${med.refillDate}` : '';
            contextMessage += `\n- ${med.name}${details ? `: ${details}` : ''}${refill}`;
          }
        }
      }
      
      if (healthData.appointments && healthData.appointments.length > 0) {
        const upcomingAppts = healthData.appointments.filter(a => !a.isCompleted);
        if (upcomingAppts.length > 0) {
          contextMessage += `\n\n### Upcoming Medical Appointments (${upcomingAppts.length}):`;
          for (const appt of upcomingAppts.slice(0, 5)) {
            const provider = appt.provider ? ` with ${appt.provider}` : '';
            const type = appt.type ? ` (${appt.type})` : '';
            contextMessage += `\n- ${appt.title}${provider}${type}: ${appt.date}`;
          }
        }
      }
      
      if (healthData.vaccinations && healthData.vaccinations.length > 0) {
        const recentVax = healthData.vaccinations.slice(0, 5);
        if (recentVax.length > 0) {
          contextMessage += `\n\n### Recent Vaccinations:`;
          for (const vax of recentVax) {
            const nextDose = vax.nextDose ? ` - Next dose: ${vax.nextDose}` : '';
            contextMessage += `\n- ${vax.name}: ${vax.date}${nextDose}`;
          }
        }
      }

      if (healthData.metrics && healthData.metrics.length > 0) {
        contextMessage += `\n\n### Health Metrics (last 30 days):`;
        
        // Group metrics by type
        const metricsByType: Record<string, typeof healthData.metrics> = {};
        for (const metric of healthData.metrics) {
          if (!metricsByType[metric.type]) {
            metricsByType[metric.type] = [];
          }
          metricsByType[metric.type].push(metric);
        }
        
        for (const [type, metrics] of Object.entries(metricsByType)) {
          const sortedMetrics = metrics.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const latestValue = sortedMetrics[0];
          const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
          
          contextMessage += `\n- ${type}: Latest: ${latestValue.value} ${latestValue.unit} (${latestValue.date.split('T')[0]})`;
          if (metrics.length > 1) {
            contextMessage += `, Avg: ${avgValue.toFixed(1)} ${latestValue.unit} over ${metrics.length} readings`;
          }
          contextMessage += ` [Source: ${latestValue.source}]`;
        }
      }
    }

    // Add family context
    if (familyContext && familyContext.members.length > 0) {
      contextMessage += `\n\n## FAMILY INFORMATION`;
      
      const children = familyContext.members.filter(m => m.relationship === 'child');
      const spouse = familyContext.members.find(m => m.relationship === 'spouse');
      const otherMembers = familyContext.members.filter(m => m.relationship !== 'child' && m.relationship !== 'spouse');
      
      if (children.length > 0) {
        contextMessage += `\n\n### Children (${children.length}):`;
        for (const child of children) {
          let childInfo = `\n- **${child.name}** (${child.age || 'age unknown'} years old)`;
          if (child.school) {
            childInfo += `\n  - School: ${child.school}${child.grade ? `, Grade: ${child.grade}` : ''}`;
            if (child.teacherName) {
              childInfo += `\n  - Teacher: ${child.teacherName}${child.teacherContact ? ` (${child.teacherContact})` : ''}`;
            }
          }
          if (child.kindergarten) {
            childInfo += `\n  - Kindergarten: ${child.kindergarten}`;
            if (child.kindergartenTeacher) {
              childInfo += `\n  - Teacher: ${child.kindergartenTeacher}`;
            }
          }
          if (child.activities && child.activities.length > 0) {
            childInfo += `\n  - Activities: ${child.activities.map(a => `${a.name} (${a.schedule}${a.location ? ` at ${a.location}` : ''})`).join(', ')}`;
          }
          if (child.allergies && child.allergies.length > 0) {
            childInfo += `\n  - ⚠️ ALLERGIES: ${child.allergies.join(', ')}`;
          }
          if (child.medicalNotes) {
            childInfo += `\n  - Medical notes: ${child.medicalNotes}`;
          }
          contextMessage += childInfo;
        }
      }
      
      if (spouse) {
        contextMessage += `\n\n### Spouse: ${spouse.name}`;
      }
      
      if (otherMembers.length > 0) {
        contextMessage += `\n\n### Other Family Members:`;
        for (const member of otherMembers) {
          contextMessage += `\n- ${member.name} (${member.relationship}${member.age ? `, ${member.age} years old` : ''})`;
        }
      }
      
      if (familyContext.todayEvents && familyContext.todayEvents.length > 0) {
        contextMessage += `\n\n### Today's Family Schedule:`;
        for (const event of familyContext.todayEvents) {
          const time = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const member = event.relatedMember ? ` (${event.relatedMember})` : '';
          contextMessage += `\n- ${event.title}: ${time} - ${endTime}${event.location ? ` at ${event.location}` : ''}${member}`;
        }
      }
      
      if (familyContext.tomorrowEvents && familyContext.tomorrowEvents.length > 0) {
        contextMessage += `\n\n### Tomorrow's Family Schedule:`;
        for (const event of familyContext.tomorrowEvents) {
          const time = new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          contextMessage += `\n- ${event.title} at ${time}${event.location ? ` (${event.location})` : ''}`;
        }
      }
      
      if (familyContext.upcomingBirthdays && familyContext.upcomingBirthdays.length > 0) {
        contextMessage += `\n\n### Upcoming Family Birthdays:`;
        for (const bday of familyContext.upcomingBirthdays) {
          const daysUntil = Math.ceil((new Date(bday.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          contextMessage += `\n- 🎂 ${bday.member} turns ${bday.age} in ${daysUntil} days (${bday.date})`;
        }
      }
      
      if (familyContext.shoppingLists && familyContext.shoppingLists.length > 0) {
        contextMessage += `\n\n### Active Shopping Lists:`;
        contextMessage += familyContext.shoppingLists.map(l => `\n- ${l.name} (${l.itemCount} items)`).join('');
      }
    }

    // Smart payload: stats summary
    if (statsSummary) {
      contextMessage += `\n\n## USER DATA OVERVIEW: ${statsSummary}`;
    }

    // Smart payload: emails
    if (emailSummary && emailSummary.length > 0) {
      contextMessage += `\n\n## RECENT UNREAD EMAILS (${emailSummary.length}):`;
      for (const e of emailSummary) {
        contextMessage += `\n- [${e.priority}] "${e.subject}" from ${e.from}${e.snippet ? ` — ${e.snippet}` : ''}`;
      }
      contextMessage += `\nYou can help the user triage, summarize, or respond to these emails.`;
    }

    // Smart payload: notes
    if (notesSummary && notesSummary.length > 0) {
      contextMessage += `\n\n## RECENT NOTES (${notesSummary.length}):`;
      for (const n of notesSummary) {
        const tags = n.tags.length > 0 ? ` [${n.tags.join(', ')}]` : '';
        contextMessage += `\n- "${n.title}"${tags}: ${n.snippet}...`;
      }
      contextMessage += `\nYou can reference these notes when the user asks about things they've written down.`;
    }

    // Smart payload: habits
    if (habitsSummary && habitsSummary.length > 0) {
      contextMessage += `\n\n## ACTIVE HABITS:`;
      for (const h of habitsSummary) {
        const status = h.isCompletedToday ? '✅' : '⬜';
        contextMessage += `\n- ${status} ${h.name} (${h.frequency}) — ${h.streak} day streak`;
      }
      contextMessage += `\nEncourage the user about their streaks and remind about incomplete habits.`;
    }

    // Inject AI Memory into prompt
    if (memories && memories.length > 0) {
      contextMessage += `\n\n## LONG-TERM MEMORY (Things you've learned about this user from previous conversations)`;
      contextMessage += `\nUse this knowledge naturally in your responses. Reference it when relevant.`;
      for (const mem of memories) {
        contextMessage += `\n- [${mem.type}]${mem.category ? ` (${mem.category})` : ''} ${mem.key}: "${mem.value}"`;
      }
    }

    const fullSystemPrompt = baseSystemPrompt + '\n\nPersonality: ' + personalityAddition + contextMessage;

    console.log("Chat request with enhanced context:", {
      hasUserProfile: !!userProfile,
      relevantContactsCount: relevantContacts?.length || 0,
      relevantContractsCount: relevantContracts?.length || 0,
      tasksCount: tasks?.length || 0,
      eventsCount: events?.length || 0,
      familyMembersCount: familyContext?.members?.length || 0,
      familyTodayEvents: familyContext?.todayEvents?.length || 0,
      healthData: healthData ? {
        medications: healthData.medications?.length || 0,
        appointments: healthData.appointments?.length || 0,
        vaccinations: healthData.vaccinations?.length || 0,
        metrics: healthData.metrics?.length || 0,
      } : null,
    });

    const model = 'google/gemini-3-flash-preview';
    
    // Helper: call Lovable AI (supports multimodal messages)
    async function callAI(msgs: { role: string; content: string | any[] }[], stream: boolean) {
      return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages: msgs, stream }),
      });
    }

    // Helper: call Perplexity web search
    async function webSearch(query: string): Promise<{ answer: string; citations: string[] }> {
      const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
      if (!PERPLEXITY_API_KEY) {
        return { answer: 'Web search is not configured.', citations: [] };
      }
      try {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'Be precise and concise. Provide factual, up-to-date information.' },
              { role: 'user', content: query },
            ],
          }),
        });
        if (!res.ok) {
          console.error('Perplexity error:', res.status, await res.text());
          return { answer: 'Web search failed.', citations: [] };
        }
        const data = await res.json();
        return {
          answer: data.choices?.[0]?.message?.content || 'No results found.',
          citations: data.citations || [],
        };
      } catch (e) {
        console.error('Web search error:', e);
        return { answer: 'Web search failed.', citations: [] };
      }
    }

    // Build messages, injecting image into the last user message if present
    const allMessages: { role: string; content: string | any[] }[] = [
      { role: 'system', content: fullSystemPrompt },
    ];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (imageUrl && i === messages.length - 1 && msg.role === 'user') {
        // Multimodal message with image
        allMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: msg.content || 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        });
      } else {
        allMessages.push(msg);
      }
    }

    // Pre-detect web search intent from the user's last message to avoid two-pass
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const isWebSearchLikely = detectWebSearchIntent(lastUserMsg);
    
    if (isWebSearchLikely) {
      // Pre-fetch search results and inject them into context (single AI call)
      const searchQuery = extractSearchQuery(lastUserMsg);
      console.log('Pre-fetching web search for:', searchQuery);
      
      const searchResult = await webSearch(searchQuery);
      
      if (searchResult.answer && searchResult.answer !== 'Web search failed.' && searchResult.answer !== 'Web search is not configured.') {
        let citationText = '';
        if (searchResult.citations.length > 0) {
          citationText = '\n\nSources:\n' + searchResult.citations.map((c: string, i: number) => `[${i + 1}] ${c}`).join('\n');
        }
        
        // Inject search results into the conversation context
        allMessages.push({
          role: 'system',
          content: `Web search results for the user's question:\n\n${searchResult.answer}${citationText}\n\nUse these results to give a comprehensive answer. Cite sources as [1], [2], etc. Do NOT use the web_search tool — results are already provided.`,
        });
      }
    }

    // Single streaming call
    const streamResponse = await callAI(allMessages, true);

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      console.error("Lovable AI error:", streamResponse.status, errorText);
      await logAIUsage(supabaseAdmin, userId, 'chat', model, 0, 0, 0, 'error', { error: errorText, personality });
      
      if (streamResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (streamResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log usage
    const inputText = fullSystemPrompt + messages.map(m => m.content).join(' ');
    const estimatedPromptTokens = Math.ceil(inputText.length / 4);
    await logAIUsage(
      supabaseAdmin, userId, 'chat', model,
      estimatedPromptTokens, 500, estimatedPromptTokens + 500,
      'success', { personality, messageCount: messages.length, webSearchUsed: isWebSearchLikely }
    );


    // Stream the response, collecting text for save_memory extraction
    const reader = streamResponse.body!.getReader();
    let fullResponseText = '';
    
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          // After stream ends, parse and persist any save_memory calls server-side
          try {
            const memoryRegex = /<tool>save_memory<\/tool>\s*<memory>(\{[\s\S]*?\})<\/memory>/g;
            const memMatches = fullResponseText.matchAll(memoryRegex);
            for (const match of memMatches) {
              try {
                const memData = JSON.parse(match[1]);
                if (memData.key && memData.value && userId !== 'anonymous') {
                  await supabaseAdmin.from('ai_memory').upsert({
                    user_id: userId,
                    memory_type: memData.type || 'fact',
                    category: memData.category || null,
                    key: memData.key,
                    value: memData.value,
                    source: 'chat',
                  }, { onConflict: 'user_id,key' });
                  console.log('Saved memory:', memData.key);
                }
              } catch (e) {
                console.error('Failed to save memory:', e);
              }
            }
          } catch (e) {
            console.error('Memory parsing error:', e);
          }
          return;
        }
        // Collect text for memory extraction
        const text = new TextDecoder().decode(value);
        for (const line of text.split('\n')) {
          if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullResponseText += content;
            } catch {}
          }
        }
        controller.enqueue(value);
      }
    });

    return new Response(stream, {
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
