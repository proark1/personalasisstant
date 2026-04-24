import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { recordUndo } from "../_shared/dori-undo.ts";

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

interface WorkspaceMemberCtx {
  user_id: string;
  display_name: string | null;
  role: string;
}

interface WorkspaceCtx {
  id: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  members: WorkspaceMemberCtx[];
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
  // Workspace context (set when the user is acting inside a team space)
  workspace?: WorkspaceCtx;
  workspaceId?: string;  // short-hand if the caller didn't preload members
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
- "assignee": string (OPTIONAL — only valid inside a workspace; a teammate's display name or @handle. Use the ACTIVE WORKSPACE members list to pick one)
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
- "assignee": string (OPTIONAL — a teammate's display name when inside a workspace)

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

TOOL: manage_event
Use this to UPDATE or DELETE existing calendar events (use schedule_event for creation).
Format: <tool>manage_event</tool><action>update|delete|search</action><event>JSON_OBJECT</event>
Event JSON fields:
- "query": string (required — matches event title to find it, e.g. "dentist", "team meeting")
- "title": string (optional — new title)
- "startTime": ISO date string (optional — new start)
- "endTime": ISO date string (optional — new end)
- "location": string (optional — new location)

TOOL: manage_property
Use this to create, update, delete, or search the user's properties (homes, apartments, rentals).
Format: <tool>manage_property</tool><action>create|update|delete|search|list</action><property>JSON_OBJECT</property>
Property JSON fields:
- "name": string (required for create, e.g. "Main apartment Mönchengladbach")
- "propertyType": "apartment" | "house" | "rental" | "office" | "land" (default "apartment")
- "address": string (optional)
- "city": string (optional)
- "country": string (optional)
- "purchasePrice": number (optional)
- "currentValue": number (optional)
- "sizeSqm": number (optional)
- "notes": string (optional)
- "query": string (for update/delete/search — matches name or address)

TOOL: manage_business
Use this to create, update, delete, or search the user's startups/businesses/business ideas.
Format: <tool>manage_business</tool><action>create|update|delete|search|list</action><business>JSON_OBJECT</business>
Business JSON fields:
- "name": string (required for create)
- "description": string (optional)
- "problemStatement": string (optional)
- "targetAudience": string (optional)
- "businessModel": string (optional)
- "uniqueValueProposition": string (optional)
- "status": "idea" | "validating" | "building" | "launched" | "paused" (optional)
- "tags": string[] (optional)
- "notes": string (optional)
- "query": string (for update/delete/search — matches name)

TOOL: manage_family_member
Use this to add, update, or delete a family member (spouse, child, parent, etc.).
Format: <tool>manage_family_member</tool><action>create|update|delete|search</action><member>JSON_OBJECT</member>
Member JSON fields:
- "name": string (required for create)
- "relationship": "spouse" | "child" | "parent" | "sibling" | "grandparent" | "other" (required for create)
- "birthDate": ISO date string (optional)
- "email": string (optional)
- "phone": string (optional)
- "schoolName": string (optional)
- "schoolGrade": string (optional)
- "allergies": string[] (optional)
- "medicalNotes": string (optional)
- "notes": string (optional)
- "query": string (for update/delete/search — matches name)

TOOL: fetch_emails
Use this to fetch the user's most recent or important emails (read-only inspection).
Format: <tool>fetch_emails</tool><filter>JSON_OBJECT</filter>
Filter JSON fields:
- "scope": "latest" | "important" | "unread" | "from" (default "latest")
- "from": string (optional — sender email or name when scope="from")
- "limit": number (optional, default 5, max 20)

When to use:
- "Show me the latest emails" → scope="latest"
- "Any important emails?" → scope="important"
- "Anything from John?" → scope="from", from="john"
After fetching, summarize each: subject, sender, key point. Then ask if user wants to draft a reply.

TOOL: draft_email_reply
Use this to draft a reply to an email and save it for the user to review/send. The draft is saved to the database; you should describe it to the user.
Format: <tool>draft_email_reply</tool><draft>JSON_OBJECT</draft>
Draft JSON fields:
- "emailQuery": string (required — matches subject or sender of the email to reply to, e.g. "the invoice from Vodafone")
- "instruction": string (optional — e.g. "Politely decline", "Confirm meeting at 3pm", "Ask for an update")
- "tone": "professional" | "friendly" | "formal" | "brief" (default "professional")

When to use:
- "Reply to the email from X saying Y" → use this tool
- "Draft a response to the dentist" → use this tool
- After fetch_emails, if user says "reply to the second one" → identify the email and draft

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

// ============================================================================
// SERVER-SIDE TOOL EXECUTOR (used for Telegram + non-browser surfaces)
// Parses XML tool tags emitted by the AI and executes the corresponding DB ops.
// Returns a list of human-readable results for surfaces that want to display them.
// ============================================================================

function stripAllToolTags(text: string): string {
  return text
    .replace(/<tool>[\s\S]*?<\/(?:task|event|note|criteria|plan|item|contact|contract|project|habit|email|reminder|memory|query|type|property|business|member|filter|draft)>/g, '')
    .replace(/<tool>[\s\S]*?<\/tool>/g, '')
    .replace(/<action>[\s\S]*?<\/action>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Every mutating tool Dori can emit. Each entry lets the approval gate
// recognize the tool, figure out whether it's a create/update/delete, and
// produce a human-readable summary for the action-confirmation prompt
// (shown in the web inbox and/or sent as a Telegram confirmation message).
type OpKind = 'create' | 'update' | 'delete';
interface MutatingTool {
  tool: string;
  entity: string;   // logical module name used for per-entity overrides
  // Regex capturing (action?, payload?) for the tool XML block.
  // Groups vary per tool: provide a `parse` to normalize to { action, data, fullMatch }.
  regex: RegExp;
  parse: (m: RegExpMatchArray) => { action: string; data: any; fullMatch: string } | null;
  // Given action + data return OpKind (or null to skip confirmation for that action).
  classify: (action: string, data: any) => OpKind | null;
  summarize: (action: string, data: any) => string;
}

const safeParseJson = (s: string): any => { try { return JSON.parse(s); } catch { return null; } };

const MUTATING_TOOLS: MutatingTool[] = [
  {
    tool: 'manage_task', entity: 'task',
    regex: /<tool>manage_task<\/tool>\s*<action>(\w+)<\/action>\s*<task>(\{[\s\S]*?\})<\/task>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'add' ? 'create'
      : action === 'update' ? 'update'
      : action === 'delete' ? 'delete'
      : null, // 'complete' is not a mutation we gate
    summarize: (action, d) => {
      const label = d.title || d.id || 'task';
      if (action === 'add') return `Add task: ${label}${d.dueDate ? ` (due ${d.dueDate})` : ''}`;
      if (action === 'update') return `Update task: ${label}`;
      if (action === 'delete') return `Delete task: ${label}`;
      return `Task action: ${label}`;
    },
  },
  {
    tool: 'schedule_event', entity: 'event',
    regex: /<tool>schedule_event<\/tool>\s*<event>(\{[\s\S]*?\})<\/event>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'create', data, fullMatch: m[0] };
    },
    classify: () => 'create',
    summarize: (_a, d) => `Schedule event: ${d.title || '(untitled)'}${d.startTime ? ` at ${new Date(d.startTime).toLocaleString()}` : ''}${d.location ? ` (${d.location})` : ''}`,
  },
  {
    tool: 'manage_event', entity: 'event',
    regex: /<tool>manage_event<\/tool>\s*<action>(\w+)<\/action>\s*<event>(\{[\s\S]*?\})<\/event>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.query || d.title || 'event';
      if (action === 'update') return `Update event: ${who}`;
      if (action === 'delete') return `Delete event: ${who}`;
      return `Event action: ${who}`;
    },
  },
  {
    tool: 'manage_contact', entity: 'contact',
    regex: /<tool>manage_contact<\/tool>\s*<action>(\w+)<\/action>\s*<contact>(\{[\s\S]*?\})<\/contact>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.name || d.query || 'contact';
      if (action === 'create') return `Add contact: ${who}${d.company ? ` (${d.company})` : ''}`;
      if (action === 'update') return `Update contact: ${who}`;
      if (action === 'delete') return `Delete contact: ${who}`;
      return `Contact action: ${who}`;
    },
  },
  {
    tool: 'manage_contract', entity: 'contract',
    regex: /<tool>manage_contract<\/tool>\s*<action>(\w+)<\/action>\s*<contract>(\{[\s\S]*?\})<\/contract>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.name || d.query || 'contract';
      const cost = d.costAmount ? ` (€${d.costAmount}/${d.costFrequency || 'mo'})` : '';
      if (action === 'create') return `Add contract: ${who}${cost}`;
      if (action === 'update') return `Update contract: ${who}${cost}`;
      if (action === 'delete') return `Delete contract: ${who}`;
      return `Contract action: ${who}`;
    },
  },
  {
    tool: 'manage_property', entity: 'property',
    regex: /<tool>manage_property<\/tool>\s*<action>(\w+)<\/action>\s*<property>(\{[\s\S]*?\})<\/property>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.name || d.query || 'property';
      if (action === 'create') return `Add property: ${who}`;
      if (action === 'update') return `Update property: ${who}`;
      if (action === 'delete') return `Delete property: ${who}`;
      return `Property action: ${who}`;
    },
  },
  {
    tool: 'manage_business', entity: 'business',
    regex: /<tool>manage_business<\/tool>\s*<action>(\w+)<\/action>\s*<business>(\{[\s\S]*?\})<\/business>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.name || d.query || 'business';
      if (action === 'create') return `Add business: ${who}`;
      if (action === 'update') return `Update business: ${who}`;
      if (action === 'delete') return `Delete business: ${who}`;
      return `Business action: ${who}`;
    },
  },
  {
    tool: 'manage_family_member', entity: 'family_member',
    regex: /<tool>manage_family_member<\/tool>\s*<action>(\w+)<\/action>\s*<member>(\{[\s\S]*?\})<\/member>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'update' ? 'update' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.name || d.query || 'family member';
      if (action === 'create') return `Add family member: ${who}${d.relationship ? ` (${d.relationship})` : ''}`;
      if (action === 'update') return `Update family member: ${who}`;
      if (action === 'delete') return `Remove family member: ${who}`;
      return `Family-member action: ${who}`;
    },
  },
  {
    tool: 'manage_note', entity: 'note',
    regex: /<tool>manage_note<\/tool>\s*<action>(\w+)<\/action>\s*<note>(\{[\s\S]*?\})<\/note>/g,
    parse: (m) => {
      const data = safeParseJson(m[2]); if (!data) return null;
      return { action: m[1], data, fullMatch: m[0] };
    },
    classify: (action) => action === 'create' ? 'create' : action === 'delete' ? 'delete' : null,
    summarize: (action, d) => {
      const who = d.title || d.query || 'note';
      if (action === 'create') return `Save note: ${who}`;
      if (action === 'delete') return `Delete note: ${who}`;
      return `Note action: ${who}`;
    },
  },
  {
    tool: 'create_note', entity: 'note',
    regex: /<tool>create_note<\/tool>\s*<note>(\{[\s\S]*?\})<\/note>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'create', data, fullMatch: m[0] };
    },
    classify: () => 'create',
    summarize: (_a, d) => `Save note: ${d.title || '(untitled)'}`,
  },
  {
    tool: 'add_shopping_item', entity: 'shopping_item',
    regex: /<tool>add_shopping_item<\/tool>\s*<item>(\{[\s\S]*?\})<\/item>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'create', data, fullMatch: m[0] };
    },
    classify: () => 'create',
    summarize: (_a, d) => `Add to shopping: ${d.quantity && d.quantity > 1 ? `${d.quantity}× ` : ''}${d.name || '(item)'}`,
  },
  {
    tool: 'set_reminder', entity: 'reminder',
    regex: /<tool>set_reminder<\/tool>\s*<reminder>(\{[\s\S]*?\})<\/reminder>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'create', data, fullMatch: m[0] };
    },
    classify: () => 'create',
    summarize: (_a, d) => `Set reminder${d.triggerAt ? ` for ${new Date(d.triggerAt).toLocaleString()}` : ''}: ${d.message || ''}`,
  },
];

// Resolve whether a given op on a given entity requires user confirmation.
// Precedence: per-entity override > global op flag > master toggle.
function requiresConfirmation(
  settings: Record<string, any> | null,
  entity: string,
  op: OpKind,
): boolean {
  if (!settings) return op === 'delete'; // sensible default until prefs are stored
  if (settings.require_action_confirmation === false) return false;
  const overrides = (settings.confirmation_overrides as Record<string, Record<string, boolean>> | null) || {};
  const entOverride = overrides?.[entity];
  if (entOverride && typeof entOverride[op] === 'boolean') return entOverride[op];
  if (op === 'create') return !!settings.confirm_creates;
  if (op === 'update') return settings.confirm_updates !== false; // default true
  if (op === 'delete') return settings.confirm_deletes !== false; // default true
  return false;
}

async function loadConfirmationSettings(supabase: any, userId: string): Promise<Record<string, any> | null> {
  try {
    const { data } = await supabase
      .from('proactive_settings')
      .select('require_action_confirmation, confirm_creates, confirm_updates, confirm_deletes, confirmation_overrides')
      .eq('user_id', userId)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

interface ToolExecResult {
  tool: string;
  ok: boolean;
  message: string;
  data?: any;
  queued?: boolean;
  actionId?: string;   // set when the call was queued for approval
  summary?: string;    // human-readable summary shown in confirmation prompts
  undoId?: string;     // set when the executed mutation can be reversed via /undo or an inline button
  entityId?: string;   // id of the row this result refers to (for row-level inline buttons)
}

interface ServerExecOpts {
  skipApprovalGate?: boolean;
  source?: string;       // 'web' | 'tg_private' | 'tg_family' | 'voice' | 'proactive'
  sourceRef?: string | null;
  // When set, every NEW row the executor creates is tagged with this workspace.
  workspaceId?: string | null;
  // Member list used to resolve assignee names ("Alice" / "@alice") to user ids.
  workspaceMembers?: WorkspaceMemberCtx[];
}

// Match an "assignee"-like field in the AI's payload against the workspace
// member list. Accepts user_id, display_name, or @handle. Returns null if no
// member matches — caller keeps assignee_id NULL in that case.
function resolveAssignee(
  raw: unknown,
  members: WorkspaceMemberCtx[] | undefined,
): string | null {
  if (!raw || typeof raw !== 'string' || !members?.length) return null;
  const needle = raw.trim().replace(/^@+/, '').toLowerCase();
  if (!needle) return null;
  // Exact UUID match first (AI may already know the id).
  const exactId = members.find((m) => m.user_id === raw);
  if (exactId) return exactId.user_id;
  // Case-insensitive display-name match.
  const byName = members.find((m) => (m.display_name || '').toLowerCase() === needle);
  if (byName) return byName.user_id;
  // Loose prefix/contains on display name, as a fallback.
  const byLoose = members.find((m) => (m.display_name || '').toLowerCase().includes(needle));
  return byLoose?.user_id || null;
}

async function executeToolsServerSide(
  text: string,
  userId: string,
  supabase: any,
  opts?: ServerExecOpts,
): Promise<ToolExecResult[]> {
  const out: ToolExecResult[] = [];
  if (!userId || userId === 'anonymous') return out;

  // Approval gate: inspect every mutating tool, look up the user's confirmation
  // preferences, and for any op that requires acknowledgment queue it in
  // auto_actions_log (stripping it from the text so it's NOT executed this round).
  if (!opts?.skipApprovalGate) {
    const settings = await loadConfirmationSettings(supabase, userId);
    let strippedText = text;
    for (const spec of MUTATING_TOOLS) {
      const fullRegex = new RegExp(spec.regex.source, 'g');
      const matches = [...text.matchAll(fullRegex)];
      for (const m of matches) {
        const parsed = spec.parse(m);
        if (!parsed) continue;
        const op = spec.classify(parsed.action, parsed.data);
        if (!op) continue;
        if (!requiresConfirmation(settings, spec.entity, op)) continue;

        const summary = spec.summarize(parsed.action, parsed.data);
        const actionType = `${op}_${spec.entity}`;
        try {
          const { data: inserted, error } = await supabase.from('auto_actions_log').insert({
            user_id: userId,
            action_type: actionType,
            entity_type: spec.entity,
            action_data: { tool_xml: parsed.fullMatch, parsed: parsed.data, op },
            reason: summary,
            status: 'pending',
            source: opts?.source || 'web',
            source_ref: opts?.sourceRef || null,
            // 24h TTL — if the user doesn't respond in a day, the prompt is stale.
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }).select('id').single();
          if (error) throw error;
          out.push({
            tool: spec.tool,
            ok: true,
            queued: true,
            actionId: inserted?.id,
            summary,
            message: `⏸️ Needs your OK: ${summary}`,
          });
        } catch (e) {
          out.push({ tool: spec.tool, ok: false, message: `Could not queue: ${(e as Error).message}` });
        }
        strippedText = strippedText.replace(parsed.fullMatch, '');
      }
    }
    text = strippedText;
  }

  const safeJSON = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  const isoOrNull = (s?: string) => { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString(); };

  // Per-surface undo bookkeeping. Every successful mutation records a short-TTL
  // row so the Telegram surface (or the web app) can offer an Undo button.
  // Returns the undo id to attach to the corresponding ToolExecResult.
  const undoMeta = {
    source: opts?.source || 'web',
    source_ref: opts?.sourceRef || null,
  };
  const undoCreate = (table: string, id: string, label: string, entity: string) =>
    recordUndo(supabase, {
      user_id: userId, op: 'create', entity_type: entity, entity_id: String(id),
      label, inverse_tool_xml: null,
      snapshot: { kind: 'delete_by_id', table, id },
      ...undoMeta,
    });
  const undoDelete = (table: string, row: any, label: string, entity: string) =>
    recordUndo(supabase, {
      user_id: userId, op: 'delete', entity_type: entity, entity_id: row?.id ?? null,
      label, inverse_tool_xml: null,
      snapshot: { kind: 'reinsert', table, row },
      ...undoMeta,
    });
  const undoPatch = (table: string, id: string, oldPatch: any, label: string, entity: string) =>
    recordUndo(supabase, {
      user_id: userId, op: 'update', entity_type: entity, entity_id: String(id),
      label, inverse_tool_xml: null,
      snapshot: { kind: 'patch', table, id, patch: oldPatch },
      ...undoMeta,
    });

  // ---------- manage_task ----------
  for (const m of text.matchAll(/<tool>manage_task<\/tool>\s*<action>(\w+)<\/action>\s*<task>(\{[\s\S]*?\})<\/task>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'add') {
        const assigneeId = resolveAssignee(data.assignee, opts?.workspaceMembers);
        const { data: t, error } = await supabase.from('tasks').insert({
          user_id: userId, title: data.title, category: data.category || 'personal',
          priority: data.priority || 'medium', due_date: isoOrNull(data.dueDate),
          recurrence_rule: data.recurrenceRule || null,
          workspace_id: opts?.workspaceId || null,
          assignee_id: assigneeId,
        }).select('id, title, due_date').single();
        if (error) throw error;
        const undoId = await undoCreate('tasks', t.id, `added task "${t.title}"`, 'task');
        const assigneeName = assigneeId
          ? (opts?.workspaceMembers?.find((m) => m.user_id === assigneeId)?.display_name || 'teammate')
          : null;
        out.push({
          tool: 'manage_task', ok: true,
          message: `✅ Added task: ${t.title}${t.due_date ? ` (due ${new Date(t.due_date).toLocaleString()})` : ''}${assigneeName ? ` — for ${assigneeName}` : ''}`,
          data: t, undoId, entityId: t.id,
        });
      } else if (action === 'complete' && data.id) {
        const { data: before } = await supabase.from('tasks')
          .select('title, completed, completed_at').eq('id', data.id).eq('user_id', userId).maybeSingle();
        await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', data.id).eq('user_id', userId);
        const undoId = await undoPatch('tasks', data.id,
          { completed: before?.completed ?? false, completed_at: before?.completed_at ?? null },
          `marked "${before?.title || 'task'}" complete`, 'task');
        out.push({ tool: 'manage_task', ok: true, message: `✅ Marked task complete`, undoId, entityId: data.id });
      } else if (action === 'delete' && data.id) {
        const { data: before } = await supabase.from('tasks')
          .select('*').eq('id', data.id).eq('user_id', userId).maybeSingle();
        if (!before) { out.push({ tool: 'manage_task', ok: false, message: `Task not found.` }); continue; }
        await supabase.from('tasks').delete().eq('id', data.id).eq('user_id', userId);
        const undoId = await undoDelete('tasks', before, `deleted task "${before.title}"`, 'task');
        out.push({ tool: 'manage_task', ok: true, message: `🗑️ Deleted task: ${before.title}`, undoId });
      } else if (action === 'update' && data.id) {
        const upd: any = {};
        if (data.title) upd.title = data.title;
        if (data.category) upd.category = data.category;
        if (data.priority) upd.priority = data.priority;
        if (data.dueDate) upd.due_date = isoOrNull(data.dueDate);
        const { data: before } = await supabase.from('tasks')
          .select(Object.keys(upd).join(', ') + ', title').eq('id', data.id).eq('user_id', userId).maybeSingle();
        await supabase.from('tasks').update(upd).eq('id', data.id).eq('user_id', userId);
        const oldPatch: any = {};
        for (const k of Object.keys(upd)) oldPatch[k] = before?.[k] ?? null;
        const undoId = await undoPatch('tasks', data.id, oldPatch, `edited task "${before?.title || data.id}"`, 'task');
        out.push({ tool: 'manage_task', ok: true, message: `✏️ Updated task`, undoId, entityId: data.id });
      }
    } catch (e) { out.push({ tool: 'manage_task', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- schedule_event (create) ----------
  for (const m of text.matchAll(/<tool>schedule_event<\/tool>\s*<event>(\{[\s\S]*?\})<\/event>/g)) {
    const data = safeJSON(m[1]); if (!data?.title || !data.startTime) continue;
    try {
      const start = isoOrNull(data.startTime)!;
      const end = isoOrNull(data.endTime) || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
      const assigneeId = resolveAssignee(data.assignee, opts?.workspaceMembers);
      const { data: e, error } = await supabase.from('events').insert({
        user_id: userId, title: data.title, start_time: start, end_time: end,
        location: data.location || null, attendees: data.attendees || null,
        recurrence_rule: data.recurrenceRule || null, category: data.category || 'personal',
        workspace_id: opts?.workspaceId || null,
        assignee_id: assigneeId,
      }).select('id, title, start_time').single();
      if (error) throw error;
      const undoId = await undoCreate('events', e.id, `scheduled "${e.title}"`, 'event');
      out.push({ tool: 'schedule_event', ok: true, message: `📅 Scheduled: ${e.title} — ${new Date(e.start_time).toLocaleString()}`, data: e, undoId, entityId: e.id });
    } catch (e) { out.push({ tool: 'schedule_event', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_event (update / delete / search) ----------
  for (const m of text.matchAll(/<tool>manage_event<\/tool>\s*<action>(\w+)<\/action>\s*<event>(\{[\s\S]*?\})<\/event>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      let target: any = null;
      if (data.query) {
        const { data: rows } = await supabase.from('events').select('*')
          .eq('user_id', userId).ilike('title', `%${data.query}%`)
          .gte('end_time', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .order('start_time').limit(1);
        target = rows?.[0];
      }
      if (!target) { out.push({ tool: 'manage_event', ok: false, message: `Could not find event matching "${data.query}"` }); continue; }
      if (action === 'delete') {
        await supabase.from('events').delete().eq('id', target.id).eq('user_id', userId);
        const undoId = await undoDelete('events', target, `deleted event "${target.title}"`, 'event');
        out.push({ tool: 'manage_event', ok: true, message: `🗑️ Deleted event: ${target.title}`, undoId });
      } else if (action === 'update') {
        const upd: any = {};
        if (data.title) upd.title = data.title;
        if (data.startTime) upd.start_time = isoOrNull(data.startTime);
        if (data.endTime) upd.end_time = isoOrNull(data.endTime);
        if (data.location !== undefined) upd.location = data.location;
        const oldPatch: any = {};
        for (const k of Object.keys(upd)) oldPatch[k] = target[k] ?? null;
        await supabase.from('events').update(upd).eq('id', target.id).eq('user_id', userId);
        const undoId = await undoPatch('events', target.id, oldPatch, `edited event "${target.title}"`, 'event');
        out.push({ tool: 'manage_event', ok: true, message: `✏️ Updated event: ${target.title}`, undoId, entityId: target.id });
      } else {
        out.push({ tool: 'manage_event', ok: true, message: `Found: ${target.title} on ${new Date(target.start_time).toLocaleString()}`, entityId: target.id });
      }
    } catch (e) { out.push({ tool: 'manage_event', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_contact ----------
  for (const m of text.matchAll(/<tool>manage_contact<\/tool>\s*<action>(\w+)<\/action>\s*<contact>(\{[\s\S]*?\})<\/contact>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: c, error } = await supabase.from('user_contacts').insert({
          user_id: userId, name: data.name, email: data.email || null, phone: data.phone || null,
          company: data.company || null, role: data.role || null, city: data.city || null,
          country: data.country || null, contact_type: data.contactType || 'business',
          notes: data.notes || null,
        }).select('id, name').single();
        if (error) throw error;
        const undoId = await undoCreate('user_contacts', c.id, `added contact ${c.name}`, 'contact');
        out.push({ tool: 'manage_contact', ok: true, message: `👤 Added contact: ${c.name}`, data: c, undoId, entityId: c.id });
      } else {
        const { data: rows } = await supabase.from('user_contacts').select('*')
          .eq('user_id', userId)
          .or(`name.ilike.%${data.query}%,email.ilike.%${data.query}%,company.ilike.%${data.query}%`).limit(1);
        const target = rows?.[0];
        if (!target) { out.push({ tool: 'manage_contact', ok: false, message: `No contact matches "${data.query}"` }); continue; }
        if (action === 'delete') {
          await supabase.from('user_contacts').delete().eq('id', target.id).eq('user_id', userId);
          const undoId = await undoDelete('user_contacts', target, `deleted contact ${target.name}`, 'contact');
          out.push({ tool: 'manage_contact', ok: true, message: `🗑️ Deleted contact: ${target.name}`, undoId });
        } else if (action === 'update') {
          const upd: any = {};
          ['name','email','phone','company','role','city','country','notes'].forEach(k => { if (data[k] !== undefined) upd[k] = data[k]; });
          const oldPatch: any = {};
          for (const k of Object.keys(upd)) oldPatch[k] = target[k] ?? null;
          await supabase.from('user_contacts').update(upd).eq('id', target.id).eq('user_id', userId);
          const undoId = await undoPatch('user_contacts', target.id, oldPatch, `edited contact ${target.name}`, 'contact');
          out.push({ tool: 'manage_contact', ok: true, message: `✏️ Updated contact: ${target.name}`, undoId, entityId: target.id });
        } else if (action === 'mark_contacted') {
          await supabase.from('contact_interactions').insert({ user_id: userId, contact_id: target.id, interaction_type: 'note', notes: 'Logged via Dori' });
          out.push({ tool: 'manage_contact', ok: true, message: `✅ Logged interaction with ${target.name}`, entityId: target.id });
        } else {
          out.push({ tool: 'manage_contact', ok: true, message: `Found contact: ${target.name}`, entityId: target.id });
        }
      }
    } catch (e) { out.push({ tool: 'manage_contact', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_contract ----------
  for (const m of text.matchAll(/<tool>manage_contract<\/tool>\s*<action>(\w+)<\/action>\s*<contract>(\{[\s\S]*?\})<\/contract>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: c, error } = await supabase.from('contracts').insert({
          user_id: userId, name: data.name, provider: data.provider || null,
          category: data.category || 'subscription', cost_amount: data.costAmount || null,
          cost_frequency: data.costFrequency || null, renewal_date: isoOrNull(data.renewalDate),
          auto_renews: data.autoRenews ?? null, notes: data.notes || null,
        }).select('id, name').single();
        if (error) throw error;
        out.push({ tool: 'manage_contract', ok: true, message: `📄 Added contract: ${c.name}`, data: c });
      } else if (action === 'get_costs') {
        const { data: rows } = await supabase.from('contracts').select('name, cost_amount, cost_frequency').eq('user_id', userId).eq('is_active', true);
        let monthly = 0;
        rows?.forEach((r: any) => {
          if (!r.cost_amount) return;
          if (r.cost_frequency === 'monthly') monthly += r.cost_amount;
          else if (r.cost_frequency === 'yearly') monthly += r.cost_amount / 12;
          else if (r.cost_frequency === 'weekly') monthly += r.cost_amount * 4.33;
        });
        out.push({ tool: 'manage_contract', ok: true, message: `💰 Total active contracts: ${rows?.length || 0}, ~${monthly.toFixed(2)}/month` });
      } else {
        const { data: rows } = await supabase.from('contracts').select('id, name')
          .eq('user_id', userId)
          .or(`name.ilike.%${data.query}%,provider.ilike.%${data.query}%`).limit(1);
        const target = rows?.[0];
        if (!target) { out.push({ tool: 'manage_contract', ok: false, message: `No contract matches "${data.query}"` }); continue; }
        if (action === 'delete') {
          await supabase.from('contracts').delete().eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_contract', ok: true, message: `🗑️ Deleted contract: ${target.name}` });
        } else if (action === 'update') {
          const upd: any = {};
          if (data.name) upd.name = data.name;
          if (data.provider) upd.provider = data.provider;
          if (data.category) upd.category = data.category;
          if (data.costAmount !== undefined) upd.cost_amount = data.costAmount;
          if (data.costFrequency) upd.cost_frequency = data.costFrequency;
          if (data.renewalDate) upd.renewal_date = isoOrNull(data.renewalDate);
          if (data.autoRenews !== undefined) upd.auto_renews = data.autoRenews;
          if (data.notes !== undefined) upd.notes = data.notes;
          await supabase.from('contracts').update(upd).eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_contract', ok: true, message: `✏️ Updated contract: ${target.name}` });
        } else {
          out.push({ tool: 'manage_contract', ok: true, message: `Found contract: ${target.name}` });
        }
      }
    } catch (e) { out.push({ tool: 'manage_contract', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_property ----------
  for (const m of text.matchAll(/<tool>manage_property<\/tool>\s*<action>(\w+)<\/action>\s*<property>(\{[\s\S]*?\})<\/property>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: p, error } = await supabase.from('properties').insert({
          user_id: userId, name: data.name, property_type: data.propertyType || 'apartment',
          address: data.address || null, city: data.city || null, country: data.country || null,
          purchase_price: data.purchasePrice || null, current_value: data.currentValue || null,
          size_sqm: data.sizeSqm || null, notes: data.notes || null,
        }).select('id, name').single();
        if (error) throw error;
        out.push({ tool: 'manage_property', ok: true, message: `🏠 Added property: ${p.name}`, data: p });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('properties').select('name, property_type, city').eq('user_id', userId).eq('is_active', true);
        out.push({ tool: 'manage_property', ok: true, message: `🏠 Properties (${rows?.length || 0}): ${rows?.map((r: any) => `${r.name}${r.city ? ` (${r.city})` : ''}`).join(', ') || 'none'}` });
      } else {
        const { data: rows } = await supabase.from('properties').select('id, name')
          .eq('user_id', userId)
          .or(`name.ilike.%${data.query}%,address.ilike.%${data.query}%,city.ilike.%${data.query}%`).limit(1);
        const target = rows?.[0];
        if (!target) { out.push({ tool: 'manage_property', ok: false, message: `No property matches "${data.query}"` }); continue; }
        if (action === 'delete') {
          await supabase.from('properties').delete().eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_property', ok: true, message: `🗑️ Deleted property: ${target.name}` });
        } else if (action === 'update') {
          const upd: any = {};
          if (data.name) upd.name = data.name;
          if (data.propertyType) upd.property_type = data.propertyType;
          ['address','city','country','notes'].forEach(k => { if (data[k] !== undefined) upd[k] = data[k]; });
          if (data.purchasePrice !== undefined) upd.purchase_price = data.purchasePrice;
          if (data.currentValue !== undefined) upd.current_value = data.currentValue;
          if (data.sizeSqm !== undefined) upd.size_sqm = data.sizeSqm;
          await supabase.from('properties').update(upd).eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_property', ok: true, message: `✏️ Updated property: ${target.name}` });
        } else {
          out.push({ tool: 'manage_property', ok: true, message: `Found property: ${target.name}` });
        }
      }
    } catch (e) { out.push({ tool: 'manage_property', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_business (startup_ideas) ----------
  for (const m of text.matchAll(/<tool>manage_business<\/tool>\s*<action>(\w+)<\/action>\s*<business>(\{[\s\S]*?\})<\/business>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: b, error } = await supabase.from('startup_ideas').insert({
          user_id: userId, name: data.name, description: data.description || null,
          problem_statement: data.problemStatement || null, target_audience: data.targetAudience || null,
          business_model: data.businessModel || null, unique_value_proposition: data.uniqueValueProposition || null,
          status: data.status || 'idea', tags: data.tags || null, notes: data.notes || null,
        }).select('id, name').single();
        if (error) throw error;
        out.push({ tool: 'manage_business', ok: true, message: `🚀 Added business: ${b.name}`, data: b });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('startup_ideas').select('name, status').eq('user_id', userId);
        out.push({ tool: 'manage_business', ok: true, message: `🚀 Businesses (${rows?.length || 0}): ${rows?.map((r: any) => `${r.name} [${r.status || 'idea'}]`).join(', ') || 'none'}` });
      } else {
        const { data: rows } = await supabase.from('startup_ideas').select('id, name').eq('user_id', userId).ilike('name', `%${data.query}%`).limit(1);
        const target = rows?.[0];
        if (!target) { out.push({ tool: 'manage_business', ok: false, message: `No business matches "${data.query}"` }); continue; }
        if (action === 'delete') {
          await supabase.from('startup_ideas').delete().eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_business', ok: true, message: `🗑️ Deleted business: ${target.name}` });
        } else if (action === 'update') {
          const upd: any = {};
          ['name','description','status','notes'].forEach(k => { if (data[k] !== undefined) upd[k] = data[k]; });
          if (data.problemStatement !== undefined) upd.problem_statement = data.problemStatement;
          if (data.targetAudience !== undefined) upd.target_audience = data.targetAudience;
          if (data.businessModel !== undefined) upd.business_model = data.businessModel;
          if (data.uniqueValueProposition !== undefined) upd.unique_value_proposition = data.uniqueValueProposition;
          if (data.tags !== undefined) upd.tags = data.tags;
          await supabase.from('startup_ideas').update(upd).eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_business', ok: true, message: `✏️ Updated business: ${target.name}` });
        } else {
          out.push({ tool: 'manage_business', ok: true, message: `Found business: ${target.name}` });
        }
      }
    } catch (e) { out.push({ tool: 'manage_business', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_family_member ----------
  for (const m of text.matchAll(/<tool>manage_family_member<\/tool>\s*<action>(\w+)<\/action>\s*<member>(\{[\s\S]*?\})<\/member>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: f, error } = await supabase.from('family_members').insert({
          user_id: userId, name: data.name, relationship: data.relationship || 'other',
          birth_date: isoOrNull(data.birthDate), email: data.email || null, phone: data.phone || null,
          school_name: data.schoolName || null, school_grade: data.schoolGrade || null,
          allergies: data.allergies || null, medical_notes: data.medicalNotes || null,
          notes: data.notes || null,
        }).select('id, name').single();
        if (error) throw error;
        out.push({ tool: 'manage_family_member', ok: true, message: `👨‍👩‍👧 Added family member: ${f.name}`, data: f });
      } else {
        const { data: rows } = await supabase.from('family_members').select('id, name').eq('user_id', userId).ilike('name', `%${data.query}%`).limit(1);
        const target = rows?.[0];
        if (!target) { out.push({ tool: 'manage_family_member', ok: false, message: `No family member matches "${data.query}"` }); continue; }
        if (action === 'delete') {
          await supabase.from('family_members').update({ is_active: false }).eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_family_member', ok: true, message: `🗑️ Removed family member: ${target.name}` });
        } else if (action === 'update') {
          const upd: any = {};
          ['name','relationship','email','phone','notes'].forEach(k => { if (data[k] !== undefined) upd[k] = data[k]; });
          if (data.birthDate) upd.birth_date = isoOrNull(data.birthDate);
          if (data.schoolName !== undefined) upd.school_name = data.schoolName;
          if (data.schoolGrade !== undefined) upd.school_grade = data.schoolGrade;
          if (data.allergies !== undefined) upd.allergies = data.allergies;
          if (data.medicalNotes !== undefined) upd.medical_notes = data.medicalNotes;
          await supabase.from('family_members').update(upd).eq('id', target.id).eq('user_id', userId);
          out.push({ tool: 'manage_family_member', ok: true, message: `✏️ Updated family member: ${target.name}` });
        } else {
          out.push({ tool: 'manage_family_member', ok: true, message: `Found family member: ${target.name}` });
        }
      }
    } catch (e) { out.push({ tool: 'manage_family_member', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- create_note / manage_note ----------
  for (const m of text.matchAll(/<tool>(?:create_note|manage_note)<\/tool>(?:\s*<action>(\w+)<\/action>)?\s*<note>(\{[\s\S]*?\})<\/note>/g)) {
    const action = m[1] || 'create'; const data = safeJSON(m[2]); if (!data) continue;
    try {
      if (action === 'create') {
        const { data: n, error } = await supabase.from('notes').insert({
          user_id: userId, title: data.title || 'Note', content: data.content || '', tags: data.tags || null,
          workspace_id: opts?.workspaceId || null,
        }).select('id, title').single();
        if (error) throw error;
        const undoId = await undoCreate('notes', n.id, `saved note "${n.title}"`, 'note');
        out.push({ tool: 'manage_note', ok: true, message: `📝 Saved note: ${n.title}`, data: n, undoId, entityId: n.id });
      } else if (action === 'delete' && data.query) {
        const { data: rows } = await supabase.from('notes').select('*').eq('user_id', userId).ilike('title', `%${data.query}%`).limit(1);
        if (rows?.[0]) {
          const snap = rows[0];
          await supabase.from('notes').delete().eq('id', snap.id).eq('user_id', userId);
          const undoId = await undoDelete('notes', snap, `deleted note "${snap.title}"`, 'note');
          out.push({ tool: 'manage_note', ok: true, message: `🗑️ Deleted note: ${snap.title}`, undoId });
        }
      }
    } catch (e) { out.push({ tool: 'manage_note', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- add_shopping_item ----------
  for (const m of text.matchAll(/<tool>add_shopping_item<\/tool>\s*<item>(\{[\s\S]*?\})<\/item>/g)) {
    const data = safeJSON(m[1]); if (!data?.name) continue;
    try {
      let { data: list } = await supabase.from('shopping_lists').select('id').eq('user_id', userId).eq('is_completed', false).order('created_at').limit(1).maybeSingle();
      if (!list) {
        const { data: newList } = await supabase.from('shopping_lists').insert({ user_id: userId, name: 'Shopping', category: 'grocery' }).select('id').single();
        list = newList;
      }
      const { data: item } = await supabase.from('shopping_list_items')
        .insert({ list_id: list.id, user_id: userId, name: data.name, quantity: data.quantity || 1, category: data.category || null })
        .select('id, name').single();
      const undoId = item ? await undoCreate('shopping_list_items', item.id, `added ${data.name} to shopping`, 'shopping_item') : undefined;
      out.push({ tool: 'add_shopping_item', ok: true, message: `🛒 Added to shopping: ${data.quantity && data.quantity > 1 ? `${data.quantity}× ` : ''}${data.name}`, undoId, entityId: item?.id });
    } catch (e) { out.push({ tool: 'add_shopping_item', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- set_reminder ----------
  for (const m of text.matchAll(/<tool>set_reminder<\/tool>\s*<reminder>(\{[\s\S]*?\})<\/reminder>/g)) {
    const data = safeJSON(m[1]); if (!data?.message || !data.triggerAt) continue;
    try {
      const trigger = isoOrNull(data.triggerAt);
      if (!trigger) continue;
      // Store reminders as scheduled tasks with due_date
      await supabase.from('tasks').insert({
        user_id: userId, title: data.message, category: 'personal', priority: 'medium', due_date: trigger,
      });
      out.push({ tool: 'set_reminder', ok: true, message: `⏰ Reminder set for ${new Date(trigger).toLocaleString()}: ${data.message}` });
    } catch (e) { out.push({ tool: 'set_reminder', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- compose_email ----------
  for (const m of text.matchAll(/<tool>compose_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g)) {
    const data = safeJSON(m[1]); if (!data?.to) continue;
    out.push({ tool: 'compose_email', ok: true, message: `✉️ Email draft prepared for ${data.to} — Subject: "${data.subject || ''}"\n\n${data.body || ''}`, data });
  }

  // ---------- fetch_emails ----------
  for (const m of text.matchAll(/<tool>fetch_emails<\/tool>\s*<filter>(\{[\s\S]*?\})<\/filter>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      // On-demand sync: if last Gmail sync was >2h ago, trigger a refresh first (throttled).
      try {
        const { data: conn } = await supabase
          .from('external_calendar_connections')
          .select('last_synced_at')
          .eq('user_id', userId).eq('provider', 'google').eq('sync_enabled', true)
          .order('last_synced_at', { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle();
        const lastSync = conn?.last_synced_at ? new Date(conn.last_synced_at).getTime() : 0;
        const twoHoursMs = 2 * 60 * 60 * 1000;
        if (Date.now() - lastSync > twoHoursMs) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
          console.log(`[fetch_emails] Triggering on-demand sync for ${userId} (last sync ${lastSync ? new Date(lastSync).toISOString() : 'never'})`);
          await fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
              'x-internal-user-id': userId,
            },
            body: JSON.stringify({ maxResults: 30 }),
          }).catch(e => console.error('[fetch_emails] sync trigger failed:', e));
        }
      } catch (e) {
        console.error('[fetch_emails] throttle check failed:', e);
      }

      const limit = Math.min(data.limit || 5, 20);
      let q = supabase.from('user_emails').select('id, subject, from_name, from_email, snippet, received_at, priority_score, is_important, is_read').eq('user_id', userId).eq('user_archived', false);
      if (data.scope === 'important') q = q.eq('is_important', true);
      if (data.scope === 'unread') q = q.eq('is_read', false);
      if (data.scope === 'from' && data.from) q = q.or(`from_name.ilike.%${data.from}%,from_email.ilike.%${data.from}%`);
      const { data: rows } = await q.order('received_at', { ascending: false }).limit(limit);
      if (!rows?.length) { out.push({ tool: 'fetch_emails', ok: true, message: `📭 No emails found.` }); continue; }
      const lines = rows.map((e: any, i: number) => `${i + 1}. ${e.is_important ? '⭐ ' : ''}${e.subject || '(no subject)'} — ${e.from_name || e.from_email}\n   ${(e.snippet || '').slice(0, 120)}`);
      out.push({ tool: 'fetch_emails', ok: true, message: `📬 Recent emails:\n${lines.join('\n\n')}`, data: rows });
    } catch (e) { out.push({ tool: 'fetch_emails', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- draft_email_reply ----------
  for (const m of text.matchAll(/<tool>draft_email_reply<\/tool>\s*<draft>(\{[\s\S]*?\})<\/draft>/g)) {
    const data = safeJSON(m[1]); if (!data?.emailQuery) continue;
    try {
      const { data: rows } = await supabase.from('user_emails').select('id, subject, from_name, from_email, snippet, ai_summary').eq('user_id', userId)
        .or(`subject.ilike.%${data.emailQuery}%,from_name.ilike.%${data.emailQuery}%,from_email.ilike.%${data.emailQuery}%`)
        .order('received_at', { ascending: false }).limit(1);
      const target = rows?.[0];
      if (!target) { out.push({ tool: 'draft_email_reply', ok: false, message: `No email matches "${data.emailQuery}"` }); continue; }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: `You draft email replies. Tone: ${data.tone || 'professional'}. Keep it concise (2-5 sentences). Return only the reply body, no subject.` },
            { role: 'user', content: `Reply to email:\nFrom: ${target.from_name} <${target.from_email}>\nSubject: ${target.subject}\nContent: ${target.snippet || target.ai_summary || ''}\n\nInstruction: ${data.instruction || 'Write an appropriate reply.'}` },
          ],
        }),
      });
      const aiJson = await aiResp.json();
      const draft = aiJson.choices?.[0]?.message?.content?.trim() || '';
      // Save draft on the email row (best-effort — column may or may not exist)
      try { await supabase.from('user_emails').update({ ai_drafted_reply: draft }).eq('id', target.id).eq('user_id', userId); } catch { /* column optional */ }
      out.push({ tool: 'draft_email_reply', ok: true, message: `✉️ Draft ready (re: "${target.subject}" from ${target.from_name || target.from_email}):\n\n${draft}\n\nOpen the email in the app to send or edit.`, data: { emailId: target.id, draft } });
    } catch (e) { out.push({ tool: 'draft_email_reply', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- save_memory ----------
  for (const m of text.matchAll(/<tool>save_memory<\/tool>\s*<memory>(\{[\s\S]*?\})<\/memory>/g)) {
    const data = safeJSON(m[1]); if (!data?.key || !data.value) continue;
    try {
      await supabase.from('ai_memory').upsert({
        user_id: userId, memory_type: data.type || 'fact', category: data.category || null,
        key: data.key, value: data.value, source: 'chat',
      }, { onConflict: 'user_id,key' });
    } catch { /* silent */ }
  }

  // ---------- learn_preference (auto-learned behavioral patterns) ----------
  for (const m of text.matchAll(/<tool>learn_preference<\/tool>\s*<pref>(\{[\s\S]*?\})<\/pref>/g)) {
    const data = safeJSON(m[1]); if (!data?.key || !data.value) continue;
    try {
      const { data: existing } = await supabase
        .from('dori_learned_preferences')
        .select('id, times_seen, confidence')
        .eq('user_id', userId)
        .eq('key', data.key)
        .maybeSingle();
      if (existing) {
        const newSeen = (existing.times_seen || 1) + 1;
        const newConf = Math.min(0.99, (existing.confidence || 0.5) + 0.1);
        await supabase.from('dori_learned_preferences').update({
          value: data.value,
          times_seen: newSeen,
          confidence: newConf,
          last_seen_at: new Date().toISOString(),
          source: data.source || 'chat',
        }).eq('id', existing.id);
      } else {
        await supabase.from('dori_learned_preferences').insert({
          user_id: userId,
          key: data.key,
          value: data.value,
          confidence: data.confidence || 0.6,
          source: data.source || 'chat',
        });
      }
    } catch (e) { console.error('learn_preference failed', e); }
  }

  return out;
}

// Persist a turn into the unified cross-channel conversation log
async function logDoriTurn(
  supabase: any,
  userId: string,
  channel: string,
  role: string,
  content: string,
  channelRef?: string | null,
) {
  if (!userId || userId === 'anonymous' || !content) return;
  try {
    await supabase.from('dori_conversations').insert({
      user_id: userId,
      channel,
      channel_ref: channelRef || null,
      role,
      content: content.slice(0, 8000),
    });
  } catch (e) {
    console.error('logDoriTurn failed', e);
  }
}

// Load recent cross-channel turns + learned preferences for prompt injection
async function loadDoriIntelligence(supabase: any, userId: string, currentChannel: string) {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: turns }, { data: prefs }] = await Promise.all([
    supabase
      .from('dori_conversations')
      .select('channel, role, content, created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('dori_learned_preferences')
      .select('key, value, confidence')
      .eq('user_id', userId)
      .gte('confidence', 0.5)
      .order('confidence', { ascending: false })
      .limit(15),
  ]);

  let memoryBlock = '';
  if (turns && turns.length > 0) {
    const otherChannelTurns = turns.filter((t: any) => t.channel !== currentChannel).slice(0, 12).reverse();
    if (otherChannelTurns.length > 0) {
      memoryBlock += '\n\n## RECENT CROSS-CHANNEL CONVERSATIONS (last 24h, other channels)';
      memoryBlock += '\nUse these to maintain context across web, Telegram private, and Telegram family group:';
      for (const t of otherChannelTurns) {
        const when = new Date(t.created_at).toISOString().slice(11, 16);
        memoryBlock += `\n[${t.channel} ${when}] ${t.role}: ${String(t.content).slice(0, 200)}`;
      }
    }
  }

  let prefsBlock = '';
  if (prefs && prefs.length > 0) {
    prefsBlock += '\n\n## AUTO-LEARNED USER PREFERENCES (apply these silently to every action)';
    for (const p of prefs) {
      prefsBlock += `\n- ${p.key}: ${p.value}`;
    }
  }

  return memoryBlock + prefsBlock;
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
      const { data, error } = await (supabase.auth as any).getClaims(token);
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
    const reqBody = await req.json();
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
      workspace,
      workspaceId,
      // Smart payload fields
      statsSummary,
      emailSummary,
      notesSummary,
      habitsSummary,
      // AI Memory
      memories,
      // Server-side execution flag (for Telegram and other non-browser surfaces)
      executeServerSide = false,
      skipApprovalGate = false,
      preformedToolText,
      // Where this request originated. Queued actions carry this so the originating
      // surface (e.g. a Telegram chat) can be notified back when the user approves.
      actionSource,
      actionSourceRef,
    }: ChatRequest & {
      executeServerSide?: boolean;
      skipApprovalGate?: boolean;
      preformedToolText?: string;
      actionSource?: string;
      actionSourceRef?: string | null;
    } = reqBody;

    const personalityAddition = personalityPrompts[personality] || personalityPrompts.balanced;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Resolve the active workspace server-side — but NEVER trust the caller's
    // claim without checking the authenticated user is actually a member.
    // Since the executor uses the service-role client (bypasses RLS), a
    // missing membership check would let a caller read any workspace's
    // members or write rows into workspaces they don't belong to.
    let activeWorkspace: WorkspaceCtx | null = null;
    const requestedWorkspaceId = workspace?.id || workspaceId || null;
    if (requestedWorkspaceId && userId && userId !== 'anonymous') {
      try {
        const { data: membership } = await supabaseAdmin
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', requestedWorkspaceId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!membership) {
          console.warn(`workspace IDOR attempt: user=${userId} ws=${requestedWorkspaceId}`);
        } else {
          // Always fetch fresh server-side — ignore the client-supplied
          // member list so a crafted request can't seed a fake "@alice".
          const [{ data: ws }, { data: mems }] = await Promise.all([
            supabaseAdmin.from('workspaces').select('id, name, icon, description').eq('id', requestedWorkspaceId).maybeSingle(),
            supabaseAdmin.from('workspace_members').select('user_id, display_name, role').eq('workspace_id', requestedWorkspaceId),
          ]);
          if (ws) {
            activeWorkspace = {
              id: ws.id, name: ws.name, icon: ws.icon ?? null, description: ws.description ?? null,
              members: (mems || []) as WorkspaceMemberCtx[],
            };
          }
        }
      } catch (e) {
        console.warn('workspace lookup failed', e);
      }
    }

    // preformedToolText path: skip AI call, just execute the queued tool XML directly.
    if (preformedToolText && executeServerSide && userId && userId !== 'anonymous') {
      const supabaseAdminEarly = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const execResults = await executeToolsServerSide(preformedToolText, userId, supabaseAdminEarly, {
        skipApprovalGate,
        source: actionSource,
        sourceRef: actionSourceRef ?? null,
        workspaceId: activeWorkspace?.id ?? null,
        workspaceMembers: activeWorkspace?.members,
      });
      return new Response(JSON.stringify({ reply: '', toolResults: execResults }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!messages?.length) {
      throw new Error("At least one message is required");
    }
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine which channel this request is coming from (for unified memory)
    const telegramUserIdHeader = req.headers.get('x-telegram-user-id');
    const tgChannelHint = req.headers.get('x-dori-channel'); // 'tg_private' | 'tg_family'
    const tgChannelRef = req.headers.get('x-dori-channel-ref') || null;
    const currentChannel = telegramUserIdHeader
      ? (tgChannelHint === 'tg_family' ? 'tg_family' : 'tg_private')
      : 'web';

    // Load unified cross-channel memory + auto-learned preferences
    const intelligenceBlock = await loadDoriIntelligence(supabaseAdmin, userId, currentChannel);

    // Persist the latest user turn into the unified log (fire-and-forget)
    const lastUserTurn = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserTurn?.content) {
      logDoriTurn(supabaseAdmin, userId, currentChannel, 'user', lastUserTurn.content, tgChannelRef);
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

    const intelligenceAndConfirmAddon = intelligenceBlock + `

## CONFIRM-BEFORE-ACT (CRITICAL)
When the user says "the meeting", "that contract", "delete it", "update him", or any reference that could match MORE THAN ONE existing item, do NOT guess. Reply with ONE short clarifying question listing the candidates (max 3) and ask which one. Only execute the tool once the user confirms.
Examples that REQUIRE confirmation:
- "delete the meeting" when there are 2+ upcoming meetings
- "cancel that contract" when not previously discussed in this conversation
- "remind him tomorrow" when multiple contacts match
Skip confirmation when the reference is unambiguous (e.g. user just mentioned the item by name in the last 2 turns, or only one candidate exists).

## TOOL: learn_preference (silent self-improvement)
When you notice a recurring user behavior or stated preference, save it so future Doris act on it automatically.
Format: <tool>learn_preference</tool><pref>{"key":"snake_case_key","value":"the rule in one sentence","confidence":0.7,"source":"observation"}</pref>
Examples:
- User confirms every email draft before sending → {"key":"always_confirm_email_send","value":"User wants to review all email drafts before they are sent."}
- User rejects family tasks before 9am → {"key":"family_tasks_after_9am","value":"Do not schedule family-facing tasks before 9am local time."}
- User prefers German for personal, English for business → {"key":"language_by_category","value":"Reply in German for personal/family topics, English for business/startup topics."}
Do NOT announce this tool to the user — it's silent. Only emit it 0–1 times per response, when you genuinely learned something new.

## CROSS-MODULE THINKING (CRITICAL — this is what makes you intelligent)
NEVER treat a user request as a single-module action. Before responding, ask yourself: "Does this touch contacts, calendar, tasks, contracts, family, health, or email?" If 2+ apply, chain the tools in ONE response.

Concrete chains you should execute automatically:
- "Sarah's birthday next month" → search contacts (find Sarah) + create event (her birthday, recurring yearly) + create task ("Buy gift for Sarah", due 3 days before) + suggest a draft message
- "Plan dinner with the Khans on Friday" → find contact + create calendar event Fri 7pm + create task "Confirm with Khans 1 day before" + offer to draft a WhatsApp/email message
- "Cancel the Netflix contract" → find contract + propose cancellation email draft + create task "Verify Netflix cancelled" due in 7 days
- "I have a doctor appointment Tuesday" → create event + create task "Prepare questions for doctor" + check for related family medications/conditions to mention
- "Travelling to Dubai next week" → find contacts in Dubai + suggest reaching out + create task "Pack for Dubai" 2 days before + create event for travel days
- "Mom's medication runs out Friday" → find family member + check medications table + create task "Refill mom's prescription" due Thursday + create reminder event
- Any task with a date → ALSO create a calendar event for it (per user's stated preference). Tasks without dates stay tasks-only.

When chaining: emit ALL the tool calls in the same response, then give ONE short confirmation listing what you did. Don't ask permission for obvious chains; just do them and tell the user.

## TOOL: propose_plan (for big multi-step requests)
When the user says "plan", "organize", "set up", "handle", "take care of", or asks something that needs 4+ separate actions across modules, do NOT execute immediately. Instead emit a numbered plan and wait for "do it" / "go" / "skip 2" / etc.

Format: <tool>propose_plan</tool><plan>{"title":"Plan for X","steps":["1. Find contacts in Dubai","2. Draft intro emails to top 3","3. Block calendar Tue–Thu","4. Create packing task"]}</plan>

After the user approves (any affirmative reply), execute all steps using the normal tools in ONE response. If they say "skip 2", omit step 2.
This avoids wrong actions on big asks. Skip propose_plan for simple 1–3 action chains — just do those directly.
`;
    let workspaceBlock = '';
    if (activeWorkspace) {
      workspaceBlock = `\n\n## ACTIVE WORKSPACE\nYou are currently acting inside the workspace "${activeWorkspace.name}"${activeWorkspace.icon ? ` (${activeWorkspace.icon})` : ''}${activeWorkspace.description ? ` — ${activeWorkspace.description}` : ''}.\n`;
      if (activeWorkspace.members?.length) {
        workspaceBlock += `\n### Workspace members (${activeWorkspace.members.length})\n`;
        for (const m of activeWorkspace.members) {
          workspaceBlock += `- ${m.display_name || m.user_id} (${m.role})\n`;
        }
        workspaceBlock += `\nWhen the user references a teammate by name (e.g. "Alice", "@alice"), treat it as an assignee for the relevant tool call. You can include an "assignee" field in task or event payloads with the person's display name; the executor resolves it to a user id. If the referenced person isn't in the list above, ask before assuming.`;
      }
      workspaceBlock += `\n\nEVERY task / event / note / project you create here will be scoped to this workspace automatically — never mix in personal items.`;
    } else {
      workspaceBlock = `\n\n## ACTIVE WORKSPACE\nThe user is in their PERSONAL space right now. Do NOT assign things to teammates or reference workspace members; those are only relevant inside a workspace.`;
    }

    const fullSystemPrompt = baseSystemPrompt + '\n\nPersonality: ' + personalityAddition + contextMessage + workspaceBlock + intelligenceAndConfirmAddon;

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

    // ===== SERVER-SIDE EXECUTION BRANCH (Telegram, voice, agent loop) =====
    // Multi-step agentic loop: AI proposes tools → we execute → feed results back → AI decides next step.
    // Stops when AI returns no new tool calls, or after MAX_AGENT_ROUNDS.
    if (executeServerSide) {
      const MAX_AGENT_ROUNDS = 4;
      const conversationMsgs: { role: string; content: string | any[] }[] = [...allMessages];
      const allExecResults: ToolExecResult[] = [];
      let finalText = '';
      let totalPromptTokens = 0;
      let totalCompletionTokens = 0;

      for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
        const fullResp = await callAI(conversationMsgs, false);
        if (!fullResp.ok) {
          const t = await fullResp.text();
          console.error(`Lovable AI (agent round ${round}) error:`, fullResp.status, t);
          if (round === 0) {
            return new Response(JSON.stringify({ error: 'AI service error', detail: t }), {
              status: fullResp.status === 429 ? 429 : fullResp.status === 402 ? 402 : 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          break;
        }
        const aiData = await fullResp.json();
        const roundText: string = aiData.choices?.[0]?.message?.content || '';
        finalText = roundText;
        totalPromptTokens += aiData.usage?.prompt_tokens || 0;
        totalCompletionTokens += aiData.usage?.completion_tokens || 0;

        // Default the action source from the channel if caller didn't specify one.
        const effectiveSource = actionSource || (currentChannel === 'tg_family' ? 'tg_family'
          : currentChannel === 'tg_private' ? 'tg_private'
          : 'web');
        const effectiveSourceRef = actionSourceRef ?? tgChannelRef ?? null;
        const roundResults = await executeToolsServerSide(roundText, userId, supabaseAdmin, {
          source: effectiveSource,
          sourceRef: effectiveSourceRef,
          workspaceId: activeWorkspace?.id ?? null,
          workspaceMembers: activeWorkspace?.members,
        });
        allExecResults.push(...roundResults);

        if (roundResults.length === 0) break;

        conversationMsgs.push({ role: 'assistant', content: roundText });
        const observation = roundResults.map((r, i) =>
          `[${i + 1}] ${r.tool} → ${r.ok ? 'OK' : 'FAIL'}: ${r.message}`
        ).join('\n');
        conversationMsgs.push({
          role: 'system',
          content: `Tool results from your last turn:\n${observation}\n\nIf the user's request is fully satisfied, reply with a brief natural-language confirmation and DO NOT emit more tools. If more steps are needed, emit the next tool(s).`,
        });
      }

      const cleanText = stripAllToolTags(finalText);

      await logAIUsage(supabaseAdmin, userId, 'chat-agent-loop', model,
        totalPromptTokens || Math.ceil((fullSystemPrompt + JSON.stringify(messages)).length / 4),
        totalCompletionTokens || Math.ceil(finalText.length / 4),
        (totalPromptTokens + totalCompletionTokens) || Math.ceil((fullSystemPrompt + finalText).length / 4),
        'success', { personality, executeServerSide: true, agentResultsCount: allExecResults.length });

      logDoriTurn(supabaseAdmin, userId, currentChannel, 'assistant', cleanText.trim(), tgChannelRef);

      return new Response(JSON.stringify({
        reply: cleanText.trim(),
        toolResults: allExecResults,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ===== STREAMING BRANCH (web app default) =====
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
          // Persist assistant turn to unified cross-channel log
          try {
            const cleaned = stripAllToolTags(fullResponseText).trim();
            if (cleaned) {
              await logDoriTurn(supabaseAdmin, userId, currentChannel, 'assistant', cleaned, tgChannelRef);
            }
          } catch (e) {
            console.error('Failed to log assistant turn', e);
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
