import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { recordUndo } from "../_shared/dori-undo.ts";
import { buildDoriContext, formatContextForAI } from "../_shared/dori-context.ts";
import { findTimeSlots, rankProposedSlots } from "../_shared/dori-scheduling.ts";
import {
  retrieveRelevantMemories,
  rememberSemantic,
  formatMemoriesForPrompt,
} from "../_shared/dori-semantic-memory.ts";
import {
  loadConversationState,
  saveConversationState,
  formatStateForPrompt,
  type Channel,
  type RecentEntity,
} from "../_shared/dori-conversation-state.ts";
import { decideRoute, type Specialist } from "../_shared/dori-router.ts";
import { NATIVE_TOOLS, toolCallsToLegacyXml } from "../_shared/dori-tools.ts";

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
- "recurrenceRule": RRULE string for recurring tasks. ALWAYS emit this when the user says "every", "weekly", "monthly", etc. dueDate is the FIRST occurrence. Mapping:
    · "every Tuesday" / "weekly on Tuesday" → "FREQ=WEEKLY;BYDAY=TU"
    · "every Mon/Wed/Fri" → "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    · "every weekday" → "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    · "every other Tuesday" / "biweekly Tue" → "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"
    · "every day" / "daily" → "FREQ=DAILY"
    · "every month" / "monthly" → "FREQ=MONTHLY"
    · "every year" / "annually" → "FREQ=YEARLY"
    · "every Tuesday until July" → "FREQ=WEEKLY;BYDAY=TU;UNTIL=20260731T235959Z"  (append UNTIL=YYYYMMDDTHHMMSSZ when the user gives an end date / "until X" / "for the next N weeks")
  Weekday codes: MO TU WE TH FR SA SU.
  To SKIP a single occurrence of an already-existing recurring task/event ("not this Tuesday", "cancel just next week's class"), use the manage_exception tool — do NOT edit the RRULE.
- "assignee": string (OPTIONAL — only valid inside a workspace; a teammate's display name or @handle. Use the ACTIVE WORKSPACE members list to pick one)
- "status": "backlog"|"in_progress"|"blocked"|"done" (optional)
- "estimateMinutes": number (optional — saved as a comment "estimate: Nm" on the task)
- "completionNote": string (optional — for action=complete; appended as a comment)
- "fromNoteQuery": string (only for action=add — when set, look up the matching note's content and seed the task description from it)
- "id": string (preferred for update/delete/complete when you have it)
- "query": string (for update/delete/complete — title fragment to fuzzy-match the task when you don't have an id. For UPDATE: use "query" to identify the task and "title" only for the new name (otherwise the executor will treat your new title as the search key and miss). For delete/complete with no id, "query" or "title" may be used as the search key. The executor reports ambiguity if multiple match.)

TOOL: schedule_event
Use this to schedule calendar events.
Format: <tool>schedule_event</tool><event>JSON_OBJECT</event>
Event JSON fields:
- "title": string (required)
- "startTime": ISO date string (required)
- "endTime": ISO date string (required)
- "location": string (optional)
- "attendees": string[] (optional)
- "recurrenceRule": RRULE string. ALWAYS emit when the user says "every", "weekly", "monthly", etc. startTime is the FIRST occurrence. Same mapping as manage_task:
    · "every Tuesday" → "FREQ=WEEKLY;BYDAY=TU"
    · "every Wednesday from 8 to 12" → "FREQ=WEEKLY;BYDAY=WE" (startTime/endTime cover one instance)
    · "every Mon/Wed/Fri" → "FREQ=WEEKLY;BYDAY=MO,WE,FR"
    · "every weekday" → "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
    · "every other Tuesday" → "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"
    · "every day" → "FREQ=DAILY"
    · "every month on the 5th" → "FREQ=MONTHLY;BYMONTHDAY=5"
    · "every Tuesday until July" → "FREQ=WEEKLY;BYDAY=TU;UNTIL=20260731T235959Z" (append UNTIL=YYYYMMDDTHHMMSSZ for "until X" / "for the next N weeks")
  To SKIP a single occurrence ("we don't have practice this Tuesday"), use the manage_exception tool — do NOT edit the RRULE.
- "assignee": string (OPTIONAL — a teammate's display name when inside a workspace)

TOOL: find_time
Only meaningful inside an ACTIVE WORKSPACE. Returns 3-5 slots when everyone named is free.
Format: <tool>find_time</tool><query>JSON_OBJECT</query>
Query JSON fields:
- "participants": string[] (required — display names or @handles of workspace members; include the user themselves if they should attend)
- "durationMinutes": number (required)
- "withinDays": number (optional, default 7)
- "workStartHour": number (optional, default 9)
- "workEndHour": number (optional, default 18)

Use when the user asks to "find a time", "schedule with X and Y", "pick a slot this week". After find_time returns, propose the top 1-3 and ASK the user which to book before emitting schedule_event.

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
Use this to add, remove, or clear items on the family shopping list.
Format: <tool>add_shopping_item</tool><action>add|remove|clear</action><item>JSON_OBJECT</item>
The <action> tag is optional; omit it (or use "add") to add an item. Use "remove" with {"name": "..."} to delete a single item by fuzzy match. Use "clear" with an empty <item>{}</item> to wipe all unchecked items.
Item JSON fields (for add):
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

TOOL: log_wellbeing
Use this when the user reports their mood, energy, sleep, water intake, exercise, or stress.
Format: <tool>log_wellbeing</tool><wellbeing>JSON_OBJECT</wellbeing>
Wellbeing JSON fields (all optional, send only the ones the user mentioned):
- "mood": number 1-5 (1=terrible, 5=great) — also accepts "low"|"mid"|"high"
- "energy_level": "low"|"medium"|"high" (or 1-5 number)
- "sleep_hours": number (e.g. 7.5)
- "water_glasses": number (1 glass ≈ 250ml — convert ml/L if user gives those)
- "exercise_minutes": number
- "stress_level": number 1-5
- "checkin_type": "morning"|"evening" (defaults to morning)
- "notes": string
Examples:
- "Log mood 4" → mood: 4
- "I slept 8 hours" → sleep_hours: 8
- "Drank 500ml water" → water_glasses: 2
- "Did 30 min workout" → exercise_minutes: 30

TOOL: manage_goal
Use this to create, update progress on, list, or delete a long-term goal.
Format: <tool>manage_goal</tool><action>create|progress|list|delete</action><goal>JSON_OBJECT</goal>
Goal JSON fields:
- "name": string (required for create; or use "query" for progress/delete to fuzzy-match)
- "description": string (optional)
- "target_value": number (optional)
- "current_value": number (optional — set absolute progress)
- "add": number (optional — increment current by this amount)
- "unit": string (e.g. "books", "kg", "km")
- "target_date": YYYY-MM-DD
- "query": string (used by progress/delete to find the goal)
Examples:
- "Set goal: read 12 books this year" → action=create name="read 12 books" target_value=12 unit="books"
- "Logged 1 more book" → action=progress query="books" add=1
- "How am I doing on books?" → action=progress query="books" (no values → returns status)

TOOL: bulk_reschedule
Use this when the user wants to shift MANY tasks OR events at once (today, overdue, tomorrow, or a specific date).
Format: <tool>bulk_reschedule</tool><bulk>JSON_OBJECT</bulk>
Fields:
- "entity": "task" | "event" (default "task")
- "filter": { "when": "today" | "overdue" | "tomorrow" }  OR  { "date": "YYYY-MM-DD" }
- "shift_days": number (positive = later, negative = earlier)
Examples:
- "Move all today's tasks to next week" → filter.when="today" shift_days=7
- "Push all overdue tasks to tomorrow" → filter.when="overdue" shift_days=1
- "Move everything from Friday to Monday" → entity="event" filter.date="2026-05-01" shift_days=3

TOOL: bulk_delete_events
Use this when the user wants to cancel ALL events on a specific date.
Format: <tool>bulk_delete_events</tool><bulk>{"date":"YYYY-MM-DD"}</bulk>
Examples: "Cancel all my meetings on Friday" → resolve Friday's date.

TOOL: append_note
Use this when the user wants to APPEND content to an existing note (don't create a new one).
Format: <tool>append_note</tool><note>{"query":"<title fragment>","content":"<text to append>"}</note>
Examples: "Append to yesterday's journal: had a great day" → query="journal" content="had a great day"

TOOL: log_expense
Use this when the user records spending (not a recurring contract). Inserts into family_expenses.
Format: <tool>log_expense</tool><expense>JSON_OBJECT</expense>
Fields: "amount" (number, required), "currency" (default "EUR"), "category" (string), "description" (string), "date" (YYYY-MM-DD, default today)
Examples: "Log €23.50 lunch" → amount=23.5 category="food" description="lunch"

TOOL: query_expenses
Use this when the user asks how much they spent.
Format: <tool>query_expenses</tool><query>JSON_OBJECT</query>
Fields: "period": "today"|"week"|"month"|"year" (default "month"); "category": optional substring match on description.
Examples: "What did I spend on groceries this month?" → period="month" category="grocer"

TOOL: wellbeing_summary
Use this when the user asks how their mood/sleep/water/etc. trend has been.
Format: <tool>wellbeing_summary</tool><summary>JSON_OBJECT</summary>
Fields: "metric": "mood"|"sleep_hours"|"water_glasses"|"exercise_minutes"|"steps" ; "period": "week"|"month" (default "week").
Examples: "How's my mood trended this month?" → metric="mood" period="month"

TOOL: recipe_to_shopping
Use this to expand a saved recipe's ingredients onto the shopping list.
Format: <tool>recipe_to_shopping</tool><recipe>JSON_OBJECT</recipe>
Fields: "name" (string, required — fuzzy match on recipe title)
Examples: "Add the ingredients of lasagna to shopping" → name="lasagna"

TOOL: weather
Use this for short-form weather lookups (no API key needed — open-meteo).
Format: <tool>weather</tool><weather>JSON_OBJECT</weather>
Fields: "location" (city name, required), "when": "today"|"tomorrow" (default "today")
Examples: "Weather in Berlin tomorrow" → location="Berlin" when="tomorrow"

TOOL: trip_template
Use this when the user adds a multi-day trip — creates a calendar event AND seed packing tasks.
Format: <tool>trip_template</tool><trip>JSON_OBJECT</trip>
Fields: "destination" (required), "start" (YYYY-MM-DD, required), "end" (YYYY-MM-DD, required), "packing": boolean (default true)
Examples: "Add Dubai trip Jul 10-15 with packing tasks" → destination="Dubai" start="2026-07-10" end="2026-07-15" packing=true

TOOL: set_language
Use this when the user explicitly asks to switch interface/reply language.
Format: <tool>set_language</tool><lang>{"lang":"de"|"en"}</lang>
Examples: "Switch to German" → lang="de"

TOOL: manage_settings
Use this when the user wants to change a proactive-assistant preference: morning digest time, quiet hours, the kinds of proactive nudges they get, etc.
Format: <tool>manage_settings</tool><settings>JSON_OBJECT</settings>
Settings JSON fields (all optional — only include the keys the user actually wants to change):
- "morningBriefingTime": "HH:MM" (e.g. "07:30" or "09:00")
- "eveningReviewTime": "HH:MM"
- "quietHoursEnabled": boolean
- "quietHoursStart": "HH:MM"
- "quietHoursEnd": "HH:MM"
- "forgottenTasksEnabled": boolean
- "contractRenewalsEnabled": boolean
- "contactCheckinsEnabled": boolean
- "eventPrepEnabled": boolean
- "habitStreaksEnabled": boolean
- "weeklyPlanningEnabled": boolean
- "dailyReviewEnabled": boolean
- "voiceProactiveEnabled": boolean
- "pushNotificationsEnabled": boolean
- "enabled": boolean (master switch for ALL proactive nudges)
- "timezone": IANA timezone string (e.g. "Europe/Berlin", "Asia/Tokyo") — use this when the user says "I'm in Tokyo this week, treat my schedule as Tokyo time" or "set my timezone to UTC". Persists on profiles so reminders, digests, and context all pick it up.
- "pauseUntil": ISO date string OR a relative phrase the bot will parse — "2 hours", "1h", "30 minutes", "tomorrow", "tomorrow 9am", "tonight". Sets proactive_settings.focus_mode_until and the proactive engine skips every nudge until then. Use this when the user says "be quiet for the next 2 hours", "leave me alone until tomorrow", "pause notifications". Use null / "clear" to lift the pause.
Examples: "Snooze my morning digest to 9am" → {"morningBriefingTime":"09:00"}. "Quiet hours from 11pm to 7am" → {"quietHoursEnabled":true,"quietHoursStart":"23:00","quietHoursEnd":"07:00"}. "Turn off contract renewal nudges" → {"contractRenewalsEnabled":false}. "I'm in Tokyo for the week" → {"timezone":"Asia/Tokyo"}. "Be quiet for 2 hours" → {"pauseUntil":"2 hours"}. "Leave me alone until tomorrow morning" → {"pauseUntil":"tomorrow 9am"}.

TOOL: recent_actions
Use this when the user asks "what did you just do" / "show your last actions".
Format: <tool>recent_actions</tool><query>{"limit":5}</query>

TOOL: task_filter
Filter tasks by status ('blocked','backlog','in_progress','done'), priority, or tag.
Format: <tool>task_filter</tool><filter>{"status":"blocked","tag":"invoice","priority":"high"}</filter>

TOOL: task_tag
Add or remove a tag on a single task by title fragment.
Format: <tool>task_tag</tool><action>add|remove</action><tag>{"query":"pay rent","tag":"finance"}</tag>

TOOL: task_estimate
Set an estimated duration in minutes on a task.
Format: <tool>task_estimate</tool><estimate>{"query":"presentation","minutes":45}</estimate>

TOOL: task_complete_note
Complete a task with a completion comment ("paid via SEPA", "sent to John").
Format: <tool>task_complete_note</tool><complete_note>{"query":"pay rent","note":"paid via SEPA"}</complete_note>

TOOL: task_duplicate
Duplicate an existing task (creates a "(copy)" version, status backlog).
Format: <tool>task_duplicate</tool><task>{"query":"weekly report"}</task>

TOOL: task_subtask
Add a subtask under a parent task.
Format: <tool>task_subtask</tool><subtask>{"parent_query":"apartment","title":"call landlord","priority":"high"}</subtask>

TOOL: task_assign
Assign a task to a person by name or email (resolves against profiles).
Format: <tool>task_assign</tool><assign>{"task_query":"pickup Lina","assignee":"sarah"}</assign>

TOOL: email_action
Power-actions on a stored email row (Gmail or Outlook). Action ∈ star|unstar|forward|unsubscribe|snooze|translate.
Format: <tool>email_action</tool><action>star</action><email>{"email_id":"<uuid>","to":"acc@x.com","snooze_until":"2026-05-08T09:00:00Z","target_lang":"de"}</email>
Use email_id from the user's recent emails listing.

TOOL: summarize_emails
AI-summarize the user's unread inbox into a 3-5 bullet briefing.
Format: <tool>summarize_emails</tool><summary>{"limit":10}</summary>

TOOL: period_log
Log a menstrual period entry.
Format: <tool>period_log</tool><period>{"start_date":"2026-05-01","flow":"medium","symptoms":["cramps"]}</period>

TOOL: fasting_log
Log a fasting day (Ramadan or general).
Format: <tool>fasting_log</tool><fasting>{"fast_date":"2026-05-01","fast_type":"ramadan","completed":true}</fasting>

TOOL: pantry
Manage home pantry inventory.
Format: <tool>pantry</tool><action>add|list|remove</action><pantry>{"item":"olive oil","quantity":1,"unit":"L","category":"oils","expires_on":"2027-01-01"}</pantry>

TOOL: flight_track
Track a flight and auto-create a 24-hour-before check-in reminder.
Format: <tool>flight_track</tool><flight>{"flight_number":"EK123","airline":"Emirates","origin":"DXB","destination":"FRA","depart_at":"2026-05-15T08:30:00Z"}</flight>

TOOL: presence
Set or query household presence ("home", "out", "traveling"). Use query="who" to see everyone.
Format: <tool>presence</tool><presence>{"status":"out","message":"at gym","expires_at":"2026-05-01T20:00:00Z"}</presence>
Or: <tool>presence</tool><presence>{"query":"who"}</presence>

TOOL: budget
Set a monthly category budget or check progress against budgets.
Format: <tool>budget</tool><action>set|check</action><budget>{"category":"groceries","monthly_limit":400}</budget>

TOOL: meds
Add or list medications.
Format: <tool>meds</tool><action>add|list</action><meds>{"name":"Vitamin D","dose":"1000 IU","frequency":"daily"}</meds>

TOOL: zakat
Compute Zakat (2.5% of net wealth above nisab).
Format: <tool>zakat</tool><zakat>{"net_wealth":12500,"nisab":5000}</zakat>

TOOL: timezone
Look up current local time at a city.
Format: <tool>timezone</tool><timezone>{"location":"Tokyo"}</timezone>

TOOL: currency
Convert between currencies via Frankfurter.
Format: <tool>currency</tool><currency>{"amount":100,"from":"EUR","to":"USD"}</currency>

TOOL: manage_note
Use this to create, search, or delete notes. Replaces the simpler create_note tool.
Format: <tool>manage_note</tool><action>create|search|delete</action><note>JSON_OBJECT</note>
Note JSON fields:
- "title": string (required for create)
- "content": string (required for create)
- "tags": string[] (optional)
- "query": string (for search/delete — matches title or content)

TOOL: compose_email
Use this to draft an email for the user to review (does NOT send). For actually dispatching, use send_email.
Format: <tool>compose_email</tool><email>JSON_OBJECT</email>
Email JSON fields:
- "to": string (required — email address of recipient)
- "subject": string (required)
- "body": string (required — the email body text)

TOOL: send_email
Use this when the user explicitly asks you to SEND an email via Gmail (requires a connected Google account). This passes through the confirmation gate so the user sees a preview before it goes out.
Format: <tool>send_email</tool><email>JSON_OBJECT</email>
Email JSON fields:
- "to": string (required)
- "subject": string (required)
- "body": string (required)
- "threadId": string (optional — set when replying to an existing Gmail thread)
- "gmailMessageId": string (optional — the Message-ID header of the message you're replying to)
Only use send_email when the user clearly wants to send. For "draft a reply" or "write an email", use compose_email or draft_email_reply instead.

TOOL: send_family_message
Use this when the user wants the bot to relay a message to another family member ("tell my wife I'm late", "ask Salih if he did his homework", "let mom know dinner is at 7"). Delivered as a Telegram message from the bot to the target's linked private chat. Goes through the approval gate so the user confirms wording before it's sent.
Format: <tool>send_family_message</tool><msg>JSON_OBJECT</msg>
Msg JSON fields:
- "to": string OR string[] (required — one recipient or a list. Use a list for broadcasts like "tell everyone dinner is at 7" → ["wife", "Salih", "Asad"]. Each value can be a family member's name, relationship like "wife"/"mom"/"son", or workspace member display name. The literal string "everyone" / "family" expands to every linked workspace member except the sender.)
- "body": string (required — the actual message to deliver; write in the recipient's preferred language when known)
- "fromLabel": string (optional — defaults to the sender's display name; appears as "From <fromLabel>: ..." in the recipient's chat)

Resolution order per recipient: (1) workspace_members display_name, (2) family_members name. If a recipient doesn't resolve to a Telegram-linked user, that one is reported back to the sender; the others still go through. Do NOT use this for the sender themselves — for self-reminders use set_reminder.

TOOL: family_poll
Use this when the user wants to put a yes/no or multiple-choice question to the family group ("ask the family pizza or sushi tonight", "should we go to the lake on Sunday?"). Creates a native Telegram poll in the linked family group chat so everyone can tap to vote.
Format: <tool>family_poll</tool><poll>JSON_OBJECT</poll>
Poll JSON fields:
- "question": string (required, max 300 chars)
- "options": string[] (required, 2-10 items)
- "anonymous": boolean (optional, default true — non-anonymous lets the user see who voted)
- "multipleAnswers": boolean (optional, default false)
Only works when a /linkfamily group is connected; the tool reports back if no group is linked.

TOOL: manage_exception
Use this to SKIP a single occurrence of an existing recurring task or event (without touching the RRULE). Triggers: "skip next Tuesday", "no class this week", "we're not having dinner Sunday", "cancel just tomorrow's instance".
Format: <tool>manage_exception</tool><exception>JSON_OBJECT</exception>
Exception JSON fields:
- "parentKind": "task" | "event" (required)
- "query": string (required — title fragment of the recurring parent, e.g. "Kickboxen", "team standup")
- "date": ISO date string (required — the calendar date in the user's timezone that should be skipped)
- "reason": string (optional)

TOOL: manage_focus
Time tracking — start/stop deep-work sessions and answer "how much time on X this week".
Format: <tool>manage_focus</tool><action>start|stop|query</action><focus>JSON_OBJECT</focus>
Focus JSON fields:
- For action=start: "taskQuery": string (optional — title fragment of the task you're working on) OR "label": string (when not tied to a task). "category": "business"|"personal"|"family"|"shared"|"focus" (optional, default "focus").
- For action=stop: no fields needed (closes the user's currently open session).
- For action=query: "since": ISO date or "this_week"|"today"|"last_7_days"|"last_30_days" (required), "taskQuery": string (optional — narrows to one task).

TOOL: fetch_url
Use when the user pastes a URL and asks to summarise it, save it as a note, or extract action items.
Format: <tool>fetch_url</tool><url>JSON_OBJECT</url>
URL JSON fields:
- "url": string (required)
- "intent": "summarise" | "save_note" | "extract_tasks" (optional, default "summarise")

TOOL: summarise_document
Use when the user has uploaded a PDF/document to Telegram (it arrives as a multimodal attachment with mime application/pdf or text/*) and asks for a summary, contract review, or action extraction. The tool reads the cached text from the latest document, runs a structured analysis pass, and can optionally save a note + create tasks. Skip if the user only said "save it" — use manage_note instead.
Format: <tool>summarise_document</tool><doc>JSON_OBJECT</doc>
Doc JSON fields:
- "intent": "summary" | "contract_review" | "extract_tasks" (required)
- "saveNote": boolean (optional — also writes the summary to a note when true)

TOOL: translate
Translate arbitrary text (NOT a stored email — for email translation use email_action). The model can also just respond in the target language, but emit this tool when the user explicitly asks ("translate this sentence to Turkish", "say it in German").
Format: <tool>translate</tool><translate>{"text":"...","targetLang":"tr"|"de"|"en"|"fr"|"es"|"ar"|"it"|"pt"|"ru"|"zh"}</translate>

TOOL: rewrite_text
Use this to rewrite arbitrary text in a different tone or length — works for emails before send, messages before broadcast, or notes the user is drafting.
Format: <tool>rewrite_text</tool><rewrite>JSON_OBJECT</rewrite>
Rewrite JSON fields:
- "text": string (required)
- "tone": "formal"|"casual"|"friendly"|"brief"|"warm"|"firm" (optional)
- "length": "shorter"|"longer"|"same" (optional, default "same")
- "language": ISO language code (optional — defaults to the input's language)

TOOL: email_to_task
Use this when the user pastes / forwards an email and says "turn this into a task" / "make a to-do out of this" / "remind me to follow up on this email".
Format: <tool>email_to_task</tool><e2t>JSON_OBJECT</e2t>
JSON fields:
- "subject": string (required — the email subject or a short title)
- "body": string (required — the email content; will be stored as the task description)
- "from": string (optional — sender name/email; appended to the task description)
- "dueDate": ISO date string (optional — when the AI infers a deadline from the body)
- "priority": "high" | "medium" | "low" (optional, default medium)

TOOL: get_capabilities
Use this when the user asks "what can you do?" / "help" / "what are your features?" / "list your commands". Returns the structured capability sheet so you can summarise it back in the user's language.
Format: <tool>get_capabilities</tool><q>{}</q>

TOOL: daily_recap
Use this when the user asks "what did I do today / yesterday / this week" or "give me my standup". Joins completed tasks, attended events, logged habits, and bot mutations to produce a one-screen recap.
Format: <tool>daily_recap</tool><recap>JSON_OBJECT</recap>
Recap JSON fields:
- "period": "today" | "yesterday" | "this_week" | "last_7_days" (default "today")

TOOL: pick_random
Use this when the user wants the bot to decide for them: "pick one of my open tasks for me to do now", "give me a random note to revisit", "which contact should I check in with today?".
Format: <tool>pick_random</tool><pick>JSON_OBJECT</pick>
Pick JSON fields:
- "kind": "task" | "note" | "contact" | "habit" (required)
- "filters": object (optional — e.g. {"priority":"high","completed":false})

TOOL: log_symptom
Track a symptom day-over-day (separate from log_wellbeing which is a single-shot mood/energy snapshot). Use for "headache day 3", "throat still sore", "back pain getting worse".
Format: <tool>log_symptom</tool><symptom>JSON_OBJECT</symptom>
Symptom JSON fields:
- "symptom": string (required — e.g. "headache", "back_pain", "sore_throat")
- "severity": number 1-10 (optional)
- "notes": string (optional)
- "date": ISO date (optional — defaults to today in the user's timezone). Same symptom logged on the same day UPDATES the row instead of duplicating.
- "query": when set, the tool returns the symptom's streak (consecutive days logged) and recent severity trend instead of writing a new row.

TOOL: manage_anniversary
Companion to manage_family_member.birthDate for non-birthday yearly milestones (wedding anniversary, work anniversary, sober anniversary). Use action="add" to store the date on a family member and optionally chain a yearly schedule_event + prep manage_task.
Format: <tool>manage_anniversary</tool><action>add|remove</action><anniversary>JSON_OBJECT</anniversary>
JSON fields: "memberQuery" (required — matches family member name), "anniversaryDate" (ISO for add), "label" (optional, e.g. "Wedding").

TOOL: get_summary
Use this to retrieve a summary of specific data the user asks about.
Format: <tool>get_summary</tool><type>health|email|contacts_due|contract_costs|habits</type>
Use this when the user asks "what are my costs?", "how's my health?", "any emails?", "who should I contact?", "how are my habits?"

TOOL: set_reminder
Use this to set a timed reminder/alarm for the user.
Format: <tool>set_reminder</tool><reminder>JSON_OBJECT</reminder>
Reminder JSON fields:
- "message": string (required — what to remind the user about)
- "triggerAt": ISO date string (required — when the FIRST reminder fires)
- "recurrenceRule": RRULE string (optional, same mapping as manage_task — emit when the user says "every", "weekly", "every Sunday at 6 PM", "every 3 days", etc.)

When to use:
- "Remind me in 30 minutes to..." → calculate triggerAt = now + 30 minutes
- "Remind me at 3pm to..." → set triggerAt to today at 3pm (or tomorrow if 3pm has passed)
- "Remind me tomorrow morning to..." → set triggerAt to tomorrow at 9am
- "Remind me every Sunday at 6 PM to call mom" → triggerAt = next Sunday 18:00, recurrenceRule = "FREQ=WEEKLY;BYDAY=SU"
- "Remind me every weekday at 9 to take my vitamin" → triggerAt = next weekday 09:00, recurrenceRule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
- Always confirm what you set and when it will trigger

TOOL: manage_event
Use this to UPDATE, DELETE, SEARCH, or LIST existing calendar events (use schedule_event for creation).
Format: <tool>manage_event</tool><action>update|delete|search|list</action><event>JSON_OBJECT</event>
Event JSON fields:
- "query": string (REQUIRED for update / delete / search — matches event title, e.g. "dentist", "team meeting"). OMIT for action="list".
- "limit": number (optional, used with action="list", default 5, max 20)
- "title": string (optional — new title, update only)
- "startTime": ISO date string (optional — new start, update only)
- "endTime": ISO date string (optional — new end, update only)
- "location": string (optional — new location, update only)

Use action="list" when the user says "show me my next events", "what's on my calendar", "next N entries", etc. Prefer answering from the LIVE CONTEXT block when those events are already there; fall back to action="list" only if context doesn't have them.

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
- "anniversaryDate": ISO date string (optional — wedding / partnership / work anniversary; powers the same yearly reminder chain birthdays do)
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
- "Block my calendar 2-4 PM tomorrow" / "block focus time" / "mark me busy" → use `schedule_event` with `category: "focus"`, a clear title like `🎯 Focus block` (or whatever the user named it), and the requested time range. Treat this as a real event so other planners (find_time, plan_my_week) see the slot as busy. Apply the same pattern for "block this for deep work" / "I'm doing a workout from 6-7" etc.
- Travel time: when scheduling an event with a `location` and the user hints at travel ("dentist at 3", "soccer game across town"), CHAIN a `set_reminder` for `triggerAt = event.startTime - estimatedMinutes`. Estimate 15 min in-city, 30 min cross-city, 45 min airport, or use any explicit number the user gave. The reminder message should be "🚗 Leave for <event title> (<location>)" so the user sees what's coming. Skip when the event has no location or when the user is clearly home (presence=home, virtual meeting, etc.).

## GUIDELINES
- Be concise and helpful
- PERSONALIZE responses using the user's profile information
- When adding tasks, infer the category (business/personal/family) and priority from context
- ALWAYS include dueDate when user mentions any time reference
- For recurring tasks/events, ALWAYS set both dueDate/startTime (the FIRST occurrence) AND recurrenceRule. Trigger phrases include "every", "weekly", "daily", "monthly", "every Tuesday", "every other week", "Mondays and Wednesdays". Do NOT create a single one-off row for a recurring request — the row must carry the RRULE so future occurrences appear automatically.
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

## FORWARDED MESSAGES
If the incoming user turn starts with `[forwarded from <name>]`, the body that follows was written by someone else, NOT the current user. Default behavior:
- Do NOT silently create tasks/events from third-party text. Instead, briefly summarise what was forwarded (1 sentence) and ASK what to do: save as note, create a task, add an event, save sender as contact, draft a reply, ignore.
- If the user previously said something like "save anything Mom forwards as a contract reminder", honour that preference.
- Sender name = the value after `forwarded from`. Treat it as a candidate contact / family-member if the user wants to save it.

## VISION (when the user attaches a photo)
The photo arrives as a multimodal user turn — describe what you see, THEN propose the matching action:
- Receipt / bill → `query_expenses` or log via the expense tools, plus a "verify" task.
- Business card → `manage_contact` create.
- Flyer / poster / invitation → `schedule_event` (extract date, time, location).
- Prescription / medication label → `manage_family_member` update with medication notes, plus a refill task.
- Whiteboard / handwritten notes → `manage_note` create, set tags from the topic.
- Calendar screenshot → `schedule_event` for each visible entry.
- Fridge / pantry / outfit / room photo (creative ask) → answer descriptively with 2-3 ideas; do NOT silently create tasks unless the user asks ("save these recipes", "add the missing items to the shopping list").
- Always say what you see in 1-2 sentences before acting so the user can correct misreads.

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
    .replace(/<tool>[\s\S]*?<\/(?:task|event|note|criteria|plan|item|contact|contract|project|habit|email|reminder|memory|query|type|property|business|member|filter|draft|meeting|target|packing|prep|cancel|wellbeing|bulk|goal|pref|expense|summary|recipe|weather|trip|lang|tag|estimate|subtask|assign|period|fasting|pantry|flight|presence|budget|zakat|timezone|currency|snooze|forward|star|unsubscribe|translate|duplicate|complete_note|status_filter)>/g, '')
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
  {
    // send_email is always gated: sending is irreversible so the user must
    // explicitly approve the destination + body before it hits Gmail.
    // Classified as 'delete' so the default confirm_deletes=true rule
    // catches it; per-module overrides can opt out for power users.
    tool: 'send_email', entity: 'email',
    regex: /<tool>send_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'send', data, fullMatch: m[0] };
    },
    classify: () => 'delete',
    summarize: (_a, d) => `📧 Send email to ${d.to}${d.subject ? ` — "${d.subject}"` : ''}`,
  },
  {
    // send_family_message is gated like send_email: relaying to a third party
    // is user-visible and not silently reversible, so the sender must approve
    // the recipient + body before the bot posts it.
    tool: 'send_family_message', entity: 'family_message',
    regex: /<tool>send_family_message<\/tool>\s*<msg>(\{[\s\S]*?\})<\/msg>/g,
    parse: (m) => {
      const data = safeParseJson(m[1]); if (!data) return null;
      return { action: 'send', data, fullMatch: m[0] };
    },
    classify: () => 'delete',
    summarize: (_a, d) => `💬 Send to ${d.to || '(?)'}: "${String(d.body || '').slice(0, 60)}${(d.body || '').length > 60 ? '…' : ''}"`,
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
  planId?: string;     // set when the tool created a multi-step plan (propose_plan)
  payload?: any;       // tool-specific structured payload (e.g. propose_plan steps)
}

interface ServerExecOpts {
  skipApprovalGate?: boolean;
  source?: string;       // 'web' | 'tg_private' | 'tg_family' | 'voice' | 'proactive'
  sourceRef?: string | null;
  // When set, every NEW row the executor creates is tagged with this workspace.
  workspaceId?: string | null;
  // Member list used to resolve assignee names ("Alice" / "@alice") to user ids.
  workspaceMembers?: WorkspaceMemberCtx[];
  // User's IANA timezone — makes find_time and date summaries locale-correct.
  timezone?: string;
}

// Fire-and-forget notification to a teammate when something gets assigned
// to them — push-delivery handles the quiet-hours/focus gate so we don't
// replicate those checks here. The caller never waits on this.
async function notifyAssignee(
  userId: string,
  entityType: 'task' | 'event',
  entityId: string,
  title: string,
  assigneeName: string | null,
  fromDisplayName: string | null,
): Promise<void> {
  if (!userId) return;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return;
  const from = fromDisplayName ? ` from ${fromDisplayName}` : '';
  const body = entityType === 'task'
    ? `New task${from}: ${title}`
    : `You've been added to an event${from}: ${title}`;
  try {
    await fetch(`${supabaseUrl}/functions/v1/push-delivery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_ids: [userId],
        title: assigneeName ? `For ${assigneeName}` : 'You were tagged',
        body,
        data: { entity_type: entityType, entity_id: entityId, source: 'assignment' },
      }),
    });
  } catch (e) { console.warn('notifyAssignee failed', e); }
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

// Insert and, if PostgREST's schema cache is missing one of the optional
// columns (e.g. workspace_id / assignee_id when the workspaces migration
// hasn't propagated yet), retry without those columns. Lets event / task
// creation succeed in personal mode instead of failing the user's request
// with a confusing "Could not find the 'X' column of 'Y' in the schema
// cache" error.
async function insertWithSchemaCacheFallback(
  supabase: any,
  table: string,
  row: Record<string, unknown>,
  optionalCols: string[],
  selectCols: string,
) {
  let res = await supabase.from(table).insert(row).select(selectCols).single();
  const msg = (res?.error?.message || '') as string;
  const isSchemaCacheMiss = msg.includes('schema cache') && optionalCols.some((c) => msg.includes(`'${c}'`));
  if (!isSchemaCacheMiss) return res;
  const stripped: Record<string, unknown> = { ...row };
  for (const c of optionalCols) delete stripped[c];
  console.warn(`[${table}] schema cache missing one of [${optionalCols.join(', ')}] — retrying without them`);
  res = await supabase.from(table).insert(stripped).select(selectCols).single();
  return res;
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

  // Human-readable short summary of an RRULE so the confirmation message
  // tells the user "every Tuesday" was actually persisted as recurring,
  // not as a one-off due-date. Covers the common phrasings the prompt
  // teaches the model to emit; falls back to the raw rule for anything
  // exotic.
  const summarizeRRule = (rule?: string | null): string | null => {
    if (!rule) return null;
    const parts: Record<string, string> = {};
    for (const seg of rule.split(';')) {
      const [k, v] = seg.split('=');
      if (k && v) parts[k.trim().toUpperCase()] = v.trim().toUpperCase();
    }
    const freq = parts.FREQ;
    const interval = parts.INTERVAL ? parseInt(parts.INTERVAL, 10) : 1;
    const byday = parts.BYDAY ? parts.BYDAY.split(',') : [];
    const dayNames: Record<string, string> = {
      MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
    };
    const days = byday.map((d) => dayNames[d] || d).join(', ');
    const every = (n: number, unit: string) =>
      n === 1 ? `every ${unit}` : `every ${n} ${unit}s`;
    // "UNTIL=YYYYMMDDTHHMMSSZ" — render as " until 31 Jul" so the confirmation
    // tells the user the recurrence has an end date.
    let untilSuffix = '';
    if (parts.UNTIL) {
      const m = parts.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
      if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (!isNaN(d.getTime())) {
          untilSuffix = ` until ${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;
        }
      }
    }
    let base = rule;
    if (freq === 'DAILY') base = every(interval, 'day');
    else if (freq === 'WEEKLY') {
      base = days
        ? (interval === 1 ? `every ${days}` : `every ${interval} weeks on ${days}`)
        : every(interval, 'week');
    } else if (freq === 'MONTHLY') {
      base = parts.BYMONTHDAY ? `every month on the ${parts.BYMONTHDAY}` : every(interval, 'month');
    } else if (freq === 'YEARLY') base = every(interval, 'year');
    return base + untilSuffix;
  };

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
        const { data: t, error } = await insertWithSchemaCacheFallback(
          supabase,
          'tasks',
          {
            user_id: userId, title: data.title, category: data.category || 'personal',
            priority: data.priority || 'medium', due_date: isoOrNull(data.dueDate),
            recurrence_rule: data.recurrenceRule || null,
            workspace_id: opts?.workspaceId || null,
            assignee_id: assigneeId,
          },
          ['workspace_id', 'assignee_id'],
          'id, title, due_date',
        );
        if (error) throw error;
        const undoId = await undoCreate('tasks', t.id, `added task "${t.title}"`, 'task');
        const assigneeName = assigneeId
          ? (opts?.workspaceMembers?.find((m) => m.user_id === assigneeId)?.display_name || 'teammate')
          : null;
        // Ping the assignee so they actually find out — previously assignee_id
        // was set silently and the teammate had to notice the new row.
        if (assigneeId && assigneeId !== userId) {
          const self = opts?.workspaceMembers?.find((m) => m.user_id === userId)?.display_name || null;
          notifyAssignee(assigneeId, 'task', t.id, t.title, assigneeName, self);
        }
        const recurrenceLabel = summarizeRRule(data.recurrenceRule);
        out.push({
          tool: 'manage_task', ok: true,
          message: `✅ Added task: ${t.title}${t.due_date ? ` (${recurrenceLabel ? `🔁 ${recurrenceLabel}, starting ` : 'due '}${new Date(t.due_date).toLocaleString()})` : ''}${assigneeName ? ` — for ${assigneeName}` : ''}`,
          data: t, undoId, entityId: t.id,
        });
      } else if (action === 'complete' || action === 'delete' || action === 'update') {
        // Resolve the target row. The model is supposed to send `id`, but the
        // user's task list isn't always exposed to it with IDs — and even when
        // it is, the model often hands back the title instead. Mirror the
        // manage_event pattern: if `id` is missing, fuzzy-match by title
        // (or an explicit `query` field) inside the caller's task list. If
        // the match is ambiguous, bail out with a clarifying message instead
        // of silently picking one and replying "done".
        let targetId: string | undefined = data.id;
        if (!targetId) {
          // For update, `title` is the NEW value — never use it as the search
          // key, otherwise the model's rename ("change buy milk to buy oat
          // milk") would search for the new name and fail. delete/complete
          // can still fall back to `title` because there's no ambiguity:
          // there's no "new title" in those flows.
          const needle = ((action === 'update' ? data.query : (data.query || data.title)) || '').trim();
          if (!needle) {
            out.push({ tool: 'manage_task', ok: false, message: `I need a task ${action === 'update' ? 'query' : 'title'} (or id) to ${action} — which one?` });
            continue;
          }
          // Only look at the caller's still-actionable tasks. Completed/
          // trashed rows would surface stale targets ("delete buy milk" →
          // matches a milk task from last month) and the morning digest
          // already excludes them.
          const { data: matches } = await supabase.from('tasks')
            .select('id, title, completed, trashed, due_date')
            .eq('user_id', userId)
            .eq('trashed', false)
            .ilike('title', `%${needle}%`)
            .order('created_at', { ascending: false })
            .limit(5);
          const candidates = (matches || []).filter((r: any) =>
            action === 'complete' ? !r.completed : true);
          if (!candidates.length) {
            out.push({ tool: 'manage_task', ok: false, message: `No task matches "${needle}".` });
            continue;
          }
          if (candidates.length > 1) {
            const list = candidates.map((r: any, i: number) => {
              const status = r.completed ? ' (completed)' : '';
              const due = r.due_date ? ` [due ${new Date(r.due_date).toLocaleDateString()}]` : '';
              return `${i + 1}. ${r.title}${status}${due}`;
            }).join('\n');
            out.push({ tool: 'manage_task', ok: false, message: `Multiple tasks match "${needle}":\n${list}\n\nWhich one?` });
            continue;
          }
          targetId = candidates[0].id;
        }

        if (action === 'complete') {
          const { data: before } = await supabase.from('tasks')
            .select('title, completed, completed_at').eq('id', targetId!).eq('user_id', userId).maybeSingle();
          if (!before) { out.push({ tool: 'manage_task', ok: false, message: `Task not found.` }); continue; }
          await supabase.from('tasks').update({ completed: true, completed_at: new Date().toISOString() }).eq('id', targetId!).eq('user_id', userId);
          const undoId = await undoPatch('tasks', targetId!,
            { completed: before?.completed ?? false, completed_at: before?.completed_at ?? null },
            `marked "${before?.title || 'task'}" complete`, 'task');
          out.push({ tool: 'manage_task', ok: true, message: `✅ Marked task complete: ${before?.title || 'task'}`, undoId, entityId: targetId });
        } else if (action === 'delete') {
          const { data: before } = await supabase.from('tasks')
            .select('*').eq('id', targetId!).eq('user_id', userId).maybeSingle();
          if (!before) { out.push({ tool: 'manage_task', ok: false, message: `Task not found.` }); continue; }
          await supabase.from('tasks').delete().eq('id', targetId!).eq('user_id', userId);
          const undoId = await undoDelete('tasks', before, `deleted task "${before.title}"`, 'task');
          out.push({ tool: 'manage_task', ok: true, message: `🗑️ Deleted task: ${before.title}`, undoId });
        } else {
          const upd: any = {};
          if (data.title) upd.title = data.title;
          if (data.category) upd.category = data.category;
          if (data.priority) upd.priority = data.priority;
          if (data.dueDate) upd.due_date = isoOrNull(data.dueDate);
          if (!Object.keys(upd).length) {
            out.push({ tool: 'manage_task', ok: false, message: `Nothing to update — say what should change.` });
            continue;
          }
          const { data: before } = await supabase.from('tasks')
            .select(Object.keys(upd).join(', ') + ', title').eq('id', targetId!).eq('user_id', userId).maybeSingle();
          if (!before) { out.push({ tool: 'manage_task', ok: false, message: `Task not found.` }); continue; }
          await supabase.from('tasks').update(upd).eq('id', targetId!).eq('user_id', userId);
          const oldPatch: any = {};
          for (const k of Object.keys(upd)) oldPatch[k] = before?.[k] ?? null;
          const undoId = await undoPatch('tasks', targetId!, oldPatch, `edited task "${before?.title || targetId}"`, 'task');
          out.push({ tool: 'manage_task', ok: true, message: `✏️ Updated task: ${upd.title || before?.title || 'task'}`, undoId, entityId: targetId });
        }
      }
    } catch (e) { out.push({ tool: 'manage_task', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- schedule_event (create) ----------
  for (const m of text.matchAll(/<tool>schedule_event<\/tool>\s*<event>(\{[\s\S]*?\})<\/event>/g)) {
    const data = safeJSON(m[1]); if (!data?.title || !data.startTime) continue;
    try {
      const start = isoOrNull(data.startTime)!;
      const end = isoOrNull(data.endTime) || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
      // Inline conflict probe: warn (don't block) if the requested window
      // overlaps any existing event for this user. Cheap query, fires
      // before the insert so the confirmation message can flag it.
      let conflictNote = '';
      try {
        const { data: clash } = await supabase.from('events')
          .select('id, title, start_time, end_time')
          .eq('user_id', userId)
          .lt('start_time', end)
          .gt('end_time', start)
          .order('start_time').limit(2);
        if (clash && clash.length > 0) {
          const first = clash[0];
          const when = new Date(first.start_time).toLocaleString('en-GB', {
            weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            timeZone: opts?.timezone,
          });
          conflictNote = ` ⚠️ Overlaps "${first.title}" (${when})${clash.length > 1 ? ` and ${clash.length - 1} more` : ''}`;
        }
      } catch (e) { console.warn('schedule_event conflict probe failed', (e as Error).message); }
      const assigneeId = resolveAssignee(data.assignee, opts?.workspaceMembers);
      const { data: e, error } = await insertWithSchemaCacheFallback(
        supabase,
        'events',
        {
          user_id: userId, title: data.title, start_time: start, end_time: end,
          location: data.location || null, attendees: data.attendees || null,
          recurrence_rule: data.recurrenceRule || null, category: data.category || 'personal',
          workspace_id: opts?.workspaceId || null,
          assignee_id: assigneeId,
        },
        ['workspace_id', 'assignee_id'],
        'id, title, start_time',
      );
      if (error) throw error;
      const undoId = await undoCreate('events', e.id, `scheduled "${e.title}"`, 'event');
      if (assigneeId && assigneeId !== userId) {
        const self = opts?.workspaceMembers?.find((m) => m.user_id === userId)?.display_name || null;
        const assigneeName = opts?.workspaceMembers?.find((m) => m.user_id === assigneeId)?.display_name || null;
        notifyAssignee(assigneeId, 'event', e.id, e.title, assigneeName, self);
      }
      const recurrenceLabel = summarizeRRule(data.recurrenceRule);
      out.push({
        tool: 'schedule_event', ok: true,
        message: `📅 Scheduled: ${e.title} — ${recurrenceLabel ? `🔁 ${recurrenceLabel}, starting ` : ''}${new Date(e.start_time).toLocaleString()}${conflictNote}`,
        data: e, undoId, entityId: e.id,
      });
    } catch (e) { out.push({ tool: 'schedule_event', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_event (update / delete / search / list) ----------
  for (const m of text.matchAll(/<tool>manage_event<\/tool>\s*<action>(\w+)<\/action>\s*<event>(\{[\s\S]*?\})<\/event>/g)) {
    const action = m[1]; const data = safeJSON(m[2]); if (!data) continue;
    try {
      // List / empty-query search: surface the next upcoming events instead
      // of returning a misleading "Could not find event matching ''" error.
      // Triggered explicitly via action="list" or implicitly when the model
      // emits search/update/delete with no query.
      const wantsList = action === 'list' || !data.query;
      if (wantsList && action !== 'update' && action !== 'delete') {
        const limit = Math.max(1, Math.min(20, Number(data.limit) || 5));
        const { data: rows } = await supabase.from('events')
          .select('id, title, start_time, end_time, location')
          .eq('user_id', userId)
          .gte('start_time', new Date().toISOString())
          .order('start_time').limit(limit);
        if (!rows || rows.length === 0) {
          out.push({ tool: 'manage_event', ok: true, message: '📭 No upcoming events.' });
        } else {
          const lines = rows.map((e: any) => {
            const when = new Date(e.start_time).toLocaleString('en-GB', {
              weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              timeZone: opts?.timezone,
            });
            return `• ${when} — ${e.title}${e.location ? ` @ ${e.location}` : ''}`;
          });
          out.push({
            tool: 'manage_event', ok: true,
            message: `📅 Next ${rows.length} event${rows.length === 1 ? '' : 's'}:\n${lines.join('\n')}`,
          });
        }
        continue;
      }
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
        const updatedTitle = upd.title || target.title;
        // Echo the new time/location too so users see what actually changed,
        // not just the (possibly unchanged) title.
        const newStart = upd.start_time || target.start_time;
        const whenStr = newStart ? new Date(newStart).toLocaleString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const locStr = upd.location !== undefined ? upd.location : target.location;
        const bits = [updatedTitle];
        if (whenStr) bits.push(`→ ${whenStr}`);
        if (locStr) bits.push(`@ ${locStr}`);
        out.push({ tool: 'manage_event', ok: true, message: `✏️ Updated event: ${bits.join(' ')}`, undoId, entityId: target.id, title: updatedTitle, entityKind: 'event' });
      } else {
        out.push({ tool: 'manage_event', ok: true, message: `Found: ${target.title} on ${new Date(target.start_time).toLocaleString()}`, entityId: target.id, title: target.title, entityKind: 'event' });
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
          birth_date: isoOrNull(data.birthDate),
          anniversary_date: data.anniversaryDate ? new Date(isoOrNull(data.anniversaryDate) || data.anniversaryDate).toISOString().slice(0, 10) : null,
          email: data.email || null, phone: data.phone || null,
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
          if (data.anniversaryDate !== undefined) {
            const iso = data.anniversaryDate ? isoOrNull(data.anniversaryDate) : null;
            upd.anniversary_date = iso ? new Date(iso).toISOString().slice(0, 10) : null;
          }
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
        const { data: n, error } = await insertWithSchemaCacheFallback(
          supabase,
          'notes',
          {
            user_id: userId, title: data.title || 'Note', content: data.content || '', tags: data.tags || null,
            workspace_id: opts?.workspaceId || null,
          },
          ['workspace_id'],
          'id, title',
        );
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
  // Supports three forms (back-compat with the original add-only XML):
  //   <tool>add_shopping_item</tool><item>{...}</item>                  (add)
  //   <tool>add_shopping_item</tool><action>add|remove|clear</action><item>{...}</item>
  for (const m of text.matchAll(/<tool>add_shopping_item<\/tool>(?:\s*<action>(\w+)<\/action>)?\s*<item>(\{[\s\S]*?\})<\/item>/g)) {
    const action = (m[1] || 'add').toLowerCase();
    const data = safeJSON(m[2]) || {};
    try {
      let { data: list } = await supabase.from('shopping_lists').select('id').eq('user_id', userId).eq('is_completed', false).order('created_at').limit(1).maybeSingle();
      if (action === 'clear') {
        if (!list) { out.push({ tool: 'add_shopping_item', ok: true, message: '🛒 Shopping list is already empty.' }); continue; }
        const { count } = await supabase.from('shopping_list_items')
          .delete({ count: 'exact' }).eq('list_id', list.id).eq('is_checked', false);
        out.push({ tool: 'add_shopping_item', ok: true, message: `🗑️ Cleared ${count || 0} item${count === 1 ? '' : 's'} from shopping.` });
        continue;
      }
      if (action === 'remove') {
        if (!data?.name || !list) {
          out.push({ tool: 'add_shopping_item', ok: false, message: data?.name ? '🛒 Shopping list is empty.' : 'No item name to remove.' });
          continue;
        }
        const { data: matches } = await supabase.from('shopping_list_items')
          .select('id, name').eq('list_id', list.id).eq('is_checked', false)
          .ilike('name', `%${data.name}%`).limit(2);
        if (!matches?.length) { out.push({ tool: 'add_shopping_item', ok: false, message: `🔍 No shopping item matches "${data.name}".` }); continue; }
        if (matches.length > 1) { out.push({ tool: 'add_shopping_item', ok: false, message: `🤔 Multiple items match "${data.name}": ${matches.map((x: any) => x.name).join(', ')}. Be more specific.` }); continue; }
        const target = matches[0];
        await supabase.from('shopping_list_items').delete().eq('id', target.id);
        out.push({ tool: 'add_shopping_item', ok: true, message: `🗑️ Removed from shopping: ${target.name}` });
        continue;
      }
      // ---- add (default) ----
      if (!data?.name) continue;
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
      // Store reminders as scheduled tasks with due_date (+ recurrence_rule
      // so "every Sunday at 6 PM" fires beyond the first occurrence).
      await supabase.from('tasks').insert({
        user_id: userId, title: data.message, category: 'personal', priority: 'medium',
        due_date: trigger,
        recurrence_rule: data.recurrenceRule || null,
      });
      const recurrenceLabel = summarizeRRule(data.recurrenceRule);
      out.push({
        tool: 'set_reminder', ok: true,
        message: `⏰ Reminder set for ${new Date(trigger).toLocaleString()}${recurrenceLabel ? ` (🔁 ${recurrenceLabel})` : ''}: ${data.message}`,
      });
    } catch (e) { out.push({ tool: 'set_reminder', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- compose_email ----------
  for (const m of text.matchAll(/<tool>compose_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g)) {
    const data = safeJSON(m[1]); if (!data?.to) continue;
    out.push({ tool: 'compose_email', ok: true, message: `✉️ Email draft prepared for ${data.to} — Subject: "${data.subject || ''}"\n\n${data.body || ''}`, data });
  }

  // ---------- send_email (actually dispatches via Gmail) ----------
  // Runs only when the confirmation gate has released the XML — by default
  // confirm_deletes=true catches every send. Per-workspace / per-user
  // overrides can turn it into an auto-send for power users.
  for (const m of text.matchAll(/<tool>send_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.to || !data?.body) {
      out.push({ tool: 'send_email', ok: false, message: '⚠️ send_email needs `to` and `body`.' });
      continue;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(data.to)) {
      out.push({ tool: 'send_email', ok: false, message: `⚠️ "${data.to}" doesn't look like a valid email.` });
      continue;
    }
    try {
      // Reuse the existing Gmail pipeline. Authorization header uses the
      // service-role key + x-telegram-user-id so the chat function can
      // dispatch on behalf of any user it's already acting for.
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-send-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'x-telegram-user-id': userId,
        },
        body: JSON.stringify({
          to: data.to,
          subject: data.subject || '',
          body: data.body,
          threadId: data.threadId || null,
          gmailMessageId: data.gmailMessageId || null,
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        out.push({ tool: 'send_email', ok: false, message: `⚠️ Gmail send failed: ${err.slice(0, 200)}` });
        continue;
      }
      out.push({ tool: 'send_email', ok: true, message: `📧 Sent — "${data.subject || '(no subject)'}" to ${data.to}.` });
    } catch (e) {
      out.push({ tool: 'send_email', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- find_time (workspace scheduling helper) ----------
  for (const m of text.matchAll(/<tool>find_time<\/tool>\s*<query>(\{[\s\S]*?\})<\/query>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.participants?.length || !data.durationMinutes) {
      out.push({ tool: 'find_time', ok: false, message: '⚠️ find_time needs participants and durationMinutes.' });
      continue;
    }
    if (!opts?.workspaceId || !opts?.workspaceMembers?.length) {
      out.push({ tool: 'find_time', ok: false, message: 'find_time only works inside a workspace.' });
      continue;
    }
    // Resolve names to user ids via the workspace member list.
    const participantIds: string[] = [];
    const missing: string[] = [];
    for (const raw of data.participants as string[]) {
      const id = resolveAssignee(raw, opts.workspaceMembers);
      if (id) participantIds.push(id);
      else missing.push(String(raw));
    }
    if (missing.length) {
      out.push({ tool: 'find_time', ok: false, message: `⚠️ Not sure who ${missing.join(', ')} is — ask to clarify.` });
      continue;
    }
    try {
      const slots = await findTimeSlots(supabase, {
        workspaceId: opts.workspaceId,
        participants: participantIds,
        durationMinutes: Number(data.durationMinutes),
        withinDays: data.withinDays ? Number(data.withinDays) : undefined,
        workStartHour: data.workStartHour ? Number(data.workStartHour) : undefined,
        workEndHour: data.workEndHour ? Number(data.workEndHour) : undefined,
        timezone: opts.timezone,
      });
      const ranked = rankProposedSlots(slots).slice(0, 5);
      if (ranked.length === 0) {
        out.push({ tool: 'find_time', ok: true, message: `😕 No slot works for all ${participantIds.length} in the next week. Try a different duration or a later window.` });
      } else {
        const lines = ranked.map((s, i) => `${i + 1}. ${s.local}`);
        out.push({
          tool: 'find_time', ok: true,
          message: `🗓 Found ${ranked.length} slot${ranked.length === 1 ? '' : 's'} for ${participantIds.length} people:\n${lines.join('\n')}\n\nTap the one that works and I'll book it.`,
          data: { slots: ranked, participantIds },
        });
      }
    } catch (e) {
      out.push({ tool: 'find_time', ok: false, message: `find_time failed: ${(e as Error).message}` });
    }
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
  // Memories created inside an active workspace carry that workspace_id so
  // personal and work facts don't pollute each other (e.g. "my boss is X"
  // stays in the workspace, "my wife prefers Y" stays in personal).
  for (const m of text.matchAll(/<tool>save_memory<\/tool>\s*<memory>(\{[\s\S]*?\})<\/memory>/g)) {
    const data = safeJSON(m[1]); if (!data?.key || !data.value) continue;
    try {
      await supabase.from('ai_memory').upsert({
        user_id: userId, memory_type: data.type || 'fact', category: data.category || null,
        key: data.key, value: data.value, source: 'chat',
        workspace_id: opts?.workspaceId || null,
      }, { onConflict: 'user_id,key,workspace_scope' });
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

  // ---------- propose_plan ----------
  // Persists a multi-step plan as a real row so it survives refreshes
  // and shows up in the PlansPanel. The agent loop receives a synthetic
  // tool result back so it can reference the plan in its reply.
  for (const m of text.matchAll(/<tool>propose_plan<\/tool>\s*<plan>(\{[\s\S]*?\})<\/plan>/g)) {
    const parsed = safeJSON(m[1]);
    if (!parsed || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
      out.push({ tool: 'propose_plan', ok: false, message: 'Invalid plan payload' });
      continue;
    }
    const stepsJson = parsed.steps.map((s: unknown, i: number) => {
      // Accept two shapes: bare strings or { title, description, tool_hint }.
      if (typeof s === 'string') {
        const cleaned = s.replace(/^\d+\.\s*/, '').trim();
        return { title: cleaned.slice(0, 200), description: cleaned, requires_confirmation: true };
      }
      const obj = s as Record<string, unknown>;
      return {
        title: String(obj.title || `Step ${i + 1}`).slice(0, 200),
        description: typeof obj.description === 'string' ? obj.description.slice(0, 1000) : null,
        tool_hint: typeof obj.tool_hint === 'string' ? obj.tool_hint.slice(0, 4000) : null,
        requires_confirmation: obj.requires_confirmation !== false,
      };
    });
    try {
      const { data: planId, error } = await supabase.rpc('dori_create_plan', {
        p_user_id: userId,
        p_title: String(parsed.title || 'Untitled plan').slice(0, 200),
        p_description: typeof parsed.description === 'string' ? parsed.description.slice(0, 1000) : null,
        p_steps: stepsJson,
        p_source: opts?.source === 'auto_pilot' ? 'auto_pilot' : 'chat',
        p_channel: opts?.source || 'web',
        p_workspace_id: null,
        p_metadata: { source_ref: opts?.sourceRef ?? null },
      });
      if (error || !planId) {
        out.push({ tool: 'propose_plan', ok: false, message: `Plan create failed: ${error?.message || 'unknown'}` });
      } else {
        out.push({
          tool: 'propose_plan',
          ok: true,
          message: `📋 Plan created: ${parsed.title} (${stepsJson.length} steps). Review & approve in your Plans inbox.`,
          planId,
          payload: { title: parsed.title, steps: parsed.steps, planId },
        } as ToolExecResult);
      }
    } catch (e) {
      out.push({ tool: 'propose_plan', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- schedule_meeting_bot ----------
  for (const m of text.matchAll(/<tool>schedule_meeting_bot<\/tool>\s*<meeting>(\{[\s\S]*?\})<\/meeting>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.meeting_url) {
      out.push({ tool: 'schedule_meeting_bot', ok: false, message: 'meeting_url required' });
      continue;
    }
    const r = await invokeInternal('meeting-bot-schedule', userId, {
      meeting_url: data.meeting_url,
      title: data.title ?? null,
      join_at: data.join_at ?? null,
      record_video: !!data.record_video,
      bot_name: data.bot_name || 'Notetaker',
    });
    out.push(r.ok
      ? { tool: 'schedule_meeting_bot', ok: true, message: `📹 Meeting bot scheduled · ${data.title || data.meeting_url}`, entityId: r.body?.id }
      : { tool: 'schedule_meeting_bot', ok: false, message: `Failed: ${r.error}` });
  }

  // ---------- plan_my_week ----------
  for (const m of text.matchAll(/<tool>plan_my_week<\/tool>\s*<plan>(\{[\s\S]*?\})<\/plan>/g)) {
    const data = safeJSON(m[1]) ?? {};
    const r = await invokeInternal('propose-schedule', userId, {
      days: data.days ?? 7,
      timezone: opts?.timezone,
      deep_work_hours: data.deep_work_hours,
      constraints: Array.isArray(data.constraints) ? data.constraints : [],
    });
    if (r.ok) {
      const count = r.body?.block_count ?? 0;
      out.push({
        tool: 'plan_my_week', ok: true,
        message: `📅 Drafted a week (${count} block${count === 1 ? '' : 's'}). Open the planner inbox to review and apply.`,
        entityId: r.body?.proposal?.id,
      });
    } else {
      out.push({ tool: 'plan_my_week', ok: false, message: `Failed: ${r.error}` });
    }
  }

  // ---------- forget_memory ----------
  for (const m of text.matchAll(/<tool>forget_memory<\/tool>\s*<target>(\{[\s\S]*?\})<\/target>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.target_id || !data?.target_kind) {
      out.push({ tool: 'forget_memory', ok: false, message: 'target_kind + target_id required' });
      continue;
    }
    const body: Record<string, unknown> = { reason: data.reason ?? null };
    if (data.target_kind === 'kg_entity' && data.deep) {
      body.entity_id = data.target_id;
      body.deep = true;
    } else {
      body.target_kind = data.target_kind;
      body.target_id = data.target_id;
    }
    const r = await invokeInternal('memory-forget', userId, body);
    out.push(r.ok
      ? { tool: 'forget_memory', ok: true, message: `🗑️ Forgotten (${r.body?.forgotten ?? r.body?.cascaded_rows ?? 0} item${(r.body?.forgotten ?? r.body?.cascaded_rows ?? 0) === 1 ? '' : 's'})` }
      : { tool: 'forget_memory', ok: false, message: `Failed: ${r.error}` });
  }

  // ---------- generate_packing_list ----------
  for (const m of text.matchAll(/<tool>generate_packing_list<\/tool>\s*<packing>(\{[\s\S]*?\})<\/packing>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.trip_id) {
      out.push({ tool: 'generate_packing_list', ok: false, message: 'trip_id required' });
      continue;
    }
    const r = await invokeInternal('generate-packing-list', userId, {
      trip_id: data.trip_id,
      replace: !!data.replace,
      extra_context: data.extra_context ?? '',
    });
    out.push(r.ok
      ? { tool: 'generate_packing_list', ok: true, message: `🎒 Packing list ready (${r.body?.items_count ?? '?'} items)`, entityId: r.body?.packing_list_id }
      : { tool: 'generate_packing_list', ok: false, message: `Failed: ${r.error}` });
  }

  // ---------- prep_trip ----------
  for (const m of text.matchAll(/<tool>prep_trip<\/tool>\s*<prep>(\{[\s\S]*?\})<\/prep>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.trip_id) {
      out.push({ tool: 'prep_trip', ok: false, message: 'trip_id required' });
      continue;
    }
    const r = await invokeInternal('trip-prep', userId, {
      trip_id: data.trip_id,
      force: !!data.force,
    });
    out.push(r.ok
      ? { tool: 'prep_trip', ok: true,
          message: r.body?.skipped
            ? `🎒 Already prepped`
            : `🎒 Pack task added${r.body?.packing_kicked_off ? ' + packing list generating' : ''}`,
          entityId: r.body?.task_id }
      : { tool: 'prep_trip', ok: false, message: `Failed: ${r.error}` });
  }

  // ---------- cancel_subscription ----------
  for (const m of text.matchAll(/<tool>cancel_subscription<\/tool>\s*<cancel>(\{[\s\S]*?\})<\/cancel>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.contract_id) {
      out.push({ tool: 'cancel_subscription', ok: false, message: 'contract_id required' });
      continue;
    }
    const r = await invokeInternal('cancel-subscription', userId, {
      contract_id: data.contract_id,
      tone: data.tone ?? 'formal',
      language: data.language ?? 'en',
    });
    out.push(r.ok
      ? { tool: 'cancel_subscription', ok: true,
          message: `✉️ Cancellation drafted (${r.body?.drafts_count ?? 0} version${r.body?.drafts_count === 1 ? '' : 's'}) — review in Contracts before sending. Follow-up task added.`,
          entityId: r.body?.task_id }
      : { tool: 'cancel_subscription', ok: false, message: `Failed: ${r.error}` });
  }

  // ---------- manage_habit ----------
  // Previously documented but had no executor — silently failed. Now creates,
  // logs (today), deletes, or summarises habits for the user.
  for (const m of text.matchAll(/<tool>manage_habit<\/tool>\s*<action>(\w+)<\/action>\s*<habit>(\{[\s\S]*?\})<\/habit>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      if (action === 'create') {
        if (!data.name) { out.push({ tool: 'manage_habit', ok: false, message: 'Habit name required.' }); continue; }
        const { data: h, error } = await supabase.from('habits').insert({
          user_id: userId, name: data.name, frequency: data.frequency || 'daily',
          target_count: data.target_count || 1, icon: data.icon || null, color: data.color || null,
          is_active: true,
        }).select('id, name').single();
        if (error) throw error;
        const undoId = await undoCreate('habits', h.id, `created habit "${h.name}"`, 'habit');
        out.push({ tool: 'manage_habit', ok: true, message: `🎯 Created habit: ${h.name}`, undoId, entityId: h.id });
      } else if (action === 'log') {
        const q = (data.query || data.name || '').trim();
        if (!q) { out.push({ tool: 'manage_habit', ok: false, message: 'Habit name required.' }); continue; }
        const { data: matches } = await supabase.from('habits').select('id, name')
          .eq('user_id', userId).eq('is_active', true).ilike('name', `%${q}%`).limit(2);
        if (!matches?.length) { out.push({ tool: 'manage_habit', ok: false, message: `🔍 No habit matches "${q}".` }); continue; }
        if (matches.length > 1) { out.push({ tool: 'manage_habit', ok: false, message: `🤔 Multiple habits match: ${matches.map((x:any)=>x.name).join(', ')}` }); continue; }
        const target = matches[0];
        const today = new Date().toISOString().slice(0, 10);
        await supabase.from('habit_logs').upsert({
          habit_id: target.id, user_id: userId, log_date: today,
          completed_count: data.count || 1,
        }, { onConflict: 'habit_id,log_date' } as any);
        out.push({ tool: 'manage_habit', ok: true, message: `✅ Logged habit: ${target.name}`, entityId: target.id });
      } else if (action === 'delete') {
        const q = (data.query || data.name || '').trim();
        const { data: matches } = await supabase.from('habits').select('*')
          .eq('user_id', userId).ilike('name', `%${q}%`).limit(2);
        if (!matches?.length) { out.push({ tool: 'manage_habit', ok: false, message: `🔍 No habit matches "${q}".` }); continue; }
        if (matches.length > 1) { out.push({ tool: 'manage_habit', ok: false, message: `🤔 Multiple habits match. Be more specific.` }); continue; }
        const before = matches[0];
        await supabase.from('habits').delete().eq('id', before.id).eq('user_id', userId);
        const undoId = await undoDelete('habits', before, `deleted habit "${before.name}"`, 'habit');
        out.push({ tool: 'manage_habit', ok: true, message: `🗑️ Deleted habit: ${before.name}`, undoId });
      } else if (action === 'summary') {
        let habitsQ = supabase.from('habits').select('id, name').eq('user_id', userId).eq('is_active', true);
        if (data.query) habitsQ = habitsQ.ilike('name', `%${data.query}%`);
        const { data: hs } = await habitsQ;
        if (!hs?.length) { out.push({ tool: 'manage_habit', ok: true, message: '📭 No active habits.' }); continue; }
        const today = new Date().toISOString().slice(0, 10);
        const { data: logs } = await supabase.from('habit_logs')
          .select('habit_id, log_date').eq('user_id', userId)
          .gte('log_date', new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
        const lines = hs.map((h: any) => {
          const myLogs = (logs || []).filter((l: any) => l.habit_id === h.id).map((l:any)=>l.log_date).sort();
          const doneToday = myLogs.includes(today);
          // streak = consecutive days ending today (or yesterday if not done today)
          let streak = 0; let cursor = new Date();
          if (!doneToday) cursor.setDate(cursor.getDate() - 1);
          for (;;) {
            const ds = cursor.toISOString().slice(0, 10);
            if (myLogs.includes(ds)) { streak++; cursor.setDate(cursor.getDate() - 1); } else break;
          }
          return `• ${doneToday ? '✅' : '⬜'} ${h.name} — 🔥 ${streak}d streak`;
        });
        out.push({ tool: 'manage_habit', ok: true, message: `<b>🎯 Habits</b>\n${lines.join('\n')}` });
      }
    } catch (e) { out.push({ tool: 'manage_habit', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- log_wellbeing ----------
  // One tool covers mood / energy / sleep_hours / water / exercise — writes to
  // daily_checkins (one row per user per day, upsert-style).
  for (const m of text.matchAll(/<tool>log_wellbeing<\/tool>\s*<wellbeing>(\{[\s\S]*?\})<\/wellbeing>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      const today = new Date().toISOString().slice(0, 10);
      const patch: any = { user_id: userId, checkin_date: today, checkin_type: data.checkin_type || 'morning' };
      if (data.mood !== undefined) patch.mood = String(data.mood);
      if (data.energy_level !== undefined) patch.energy_level = String(data.energy_level);
      if (data.sleep_hours !== undefined) patch.sleep_hours = Number(data.sleep_hours);
      if (data.water_glasses !== undefined) patch.water_glasses = Number(data.water_glasses);
      if (data.exercise_minutes !== undefined) patch.exercise_minutes = Number(data.exercise_minutes);
      if (data.stress_level !== undefined) patch.stress_level = Number(data.stress_level);
      if (data.notes) patch.mood_note = String(data.notes);
      // Upsert by (user_id, checkin_date, checkin_type) — fall back to insert.
      const { data: existing } = await supabase.from('daily_checkins')
        .select('id').eq('user_id', userId).eq('checkin_date', today).eq('checkin_type', patch.checkin_type).maybeSingle();
      if (existing?.id) {
        await supabase.from('daily_checkins').update(patch).eq('id', existing.id);
      } else {
        await supabase.from('daily_checkins').insert(patch);
      }
      // Also log a mood snapshot (1-5) if numeric — keeps mood_logs as the time series.
      const moodNum = Number(data.mood);
      if (Number.isFinite(moodNum) && moodNum >= 1 && moodNum <= 5) {
        await supabase.from('mood_logs').insert({
          user_id: userId, mood_score: moodNum,
          energy_score: Number.isFinite(Number(data.energy_level)) ? Number(data.energy_level) : null,
          notes: data.notes || null,
        });
      }
      const bits: string[] = [];
      if (data.mood !== undefined) bits.push(`mood ${data.mood}`);
      if (data.energy_level !== undefined) bits.push(`energy ${data.energy_level}`);
      if (data.sleep_hours !== undefined) bits.push(`${data.sleep_hours}h sleep`);
      if (data.water_glasses !== undefined) bits.push(`${data.water_glasses} glasses water`);
      if (data.exercise_minutes !== undefined) bits.push(`${data.exercise_minutes}min exercise`);
      out.push({ tool: 'log_wellbeing', ok: true, message: `❤️ Logged${bits.length ? ': ' + bits.join(', ') : ' check-in'}.` });
    } catch (e) { out.push({ tool: 'log_wellbeing', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_goal ----------
  for (const m of text.matchAll(/<tool>manage_goal<\/tool>\s*<action>(\w+)<\/action>\s*<goal>(\{[\s\S]*?\})<\/goal>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      if (action === 'create') {
        if (!data.name) { out.push({ tool: 'manage_goal', ok: false, message: 'Goal name required.' }); continue; }
        const { data: g, error } = await supabase.from('goals').insert({
          user_id: userId, name: data.name, description: data.description || null,
          target_value: data.target_value || null, current_value: data.current_value || 0,
          unit: data.unit || null, target_date: data.target_date || null,
        }).select('id, name').single();
        if (error) throw error;
        const undoId = await undoCreate('goals', g.id, `created goal "${g.name}"`, 'goal');
        out.push({ tool: 'manage_goal', ok: true, message: `🎯 Created goal: ${g.name}`, undoId, entityId: g.id });
      } else if (action === 'progress' || action === 'update') {
        const q = (data.query || data.name || '').trim();
        const { data: rows } = await supabase.from('goals').select('*')
          .eq('user_id', userId).ilike('name', `%${q}%`).limit(2);
        if (!rows?.length) { out.push({ tool: 'manage_goal', ok: false, message: `🔍 No goal matches "${q}".` }); continue; }
        if (rows.length > 1) { out.push({ tool: 'manage_goal', ok: false, message: `🤔 Multiple goals match. Be more specific.` }); continue; }
        const target = rows[0];
        const upd: any = {};
        if (data.current_value !== undefined) upd.current_value = Number(data.current_value);
        if (data.add !== undefined) upd.current_value = Number(target.current_value || 0) + Number(data.add);
        if (data.target_value !== undefined) upd.target_value = Number(data.target_value);
        if (data.target_date) upd.target_date = data.target_date;
        if (Object.keys(upd).length === 0) {
          const pct = target.target_value ? Math.round((target.current_value / target.target_value) * 100) : 0;
          out.push({ tool: 'manage_goal', ok: true, message: `🎯 ${target.name}: ${target.current_value}/${target.target_value} ${target.unit || ''} (${pct}%)`, entityId: target.id });
          continue;
        }
        await supabase.from('goals').update(upd).eq('id', target.id).eq('user_id', userId);
        const newVal = upd.current_value ?? target.current_value;
        const tv = upd.target_value ?? target.target_value;
        const pct = tv ? Math.round((newVal / tv) * 100) : 0;
        out.push({ tool: 'manage_goal', ok: true, message: `📈 ${target.name}: ${newVal}/${tv} ${target.unit || ''} (${pct}%)`, entityId: target.id });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('goals').select('name, current_value, target_value, unit, is_completed')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
        if (!rows?.length) { out.push({ tool: 'manage_goal', ok: true, message: '📭 No goals yet.' }); continue; }
        const lines = rows.map((r: any) => {
          const pct = r.target_value ? Math.round((r.current_value / r.target_value) * 100) : 0;
          return `• ${r.is_completed ? '✅' : '🎯'} ${r.name} — ${r.current_value}/${r.target_value} ${r.unit || ''} (${pct}%)`;
        });
        out.push({ tool: 'manage_goal', ok: true, message: `<b>🎯 Goals</b>\n${lines.join('\n')}` });
      } else if (action === 'delete') {
        const q = (data.query || data.name || '').trim();
        const { data: rows } = await supabase.from('goals').select('*').eq('user_id', userId).ilike('name', `%${q}%`).limit(2);
        if (!rows?.length || rows.length > 1) { out.push({ tool: 'manage_goal', ok: false, message: rows?.length ? '🤔 Multiple match.' : `🔍 No goal matches "${q}".` }); continue; }
        const before = rows[0];
        await supabase.from('goals').delete().eq('id', before.id).eq('user_id', userId);
        const undoId = await undoDelete('goals', before, `deleted goal "${before.name}"`, 'goal');
        out.push({ tool: 'manage_goal', ok: true, message: `🗑️ Deleted goal: ${before.name}`, undoId });
      }
    } catch (e) { out.push({ tool: 'manage_goal', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- bulk_reschedule (tasks) ----------
  // Shifts every open task matching `filter` by `shift_days`. Filter is one of:
  //   { when: 'today' | 'overdue' | 'tomorrow' }  OR  { date: 'YYYY-MM-DD' }
  for (const m of text.matchAll(/<tool>bulk_reschedule<\/tool>\s*<bulk>(\{[\s\S]*?\})<\/bulk>/g)) {
    const data = safeJSON(m[1]) || {};
    const shift = Number(data.shift_days);
    if (!Number.isFinite(shift)) { out.push({ tool: 'bulk_reschedule', ok: false, message: 'shift_days (number) required.' }); continue; }
    try {
      const entity = (data.entity === 'event') ? 'event' : 'task';
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
      const dateCol = entity === 'event' ? 'start_time' : 'due_date';
      const table = entity === 'event' ? 'events' : 'tasks';
      let q = entity === 'event'
        ? supabase.from('events').select('id, title, start_time, end_time').eq('user_id', userId)
        : supabase.from('tasks').select('id, title, due_date').eq('user_id', userId).eq('completed', false);
      const when = (data.filter?.when || data.when || '').toLowerCase();
      if (when === 'today') q = q.gte(dateCol, todayStart.toISOString()).lt(dateCol, todayEnd.toISOString());
      else if (when === 'tomorrow') {
        const t1 = new Date(todayEnd); const t2 = new Date(t1); t2.setDate(t2.getDate() + 1);
        q = q.gte(dateCol, t1.toISOString()).lt(dateCol, t2.toISOString());
      } else if (when === 'overdue' && entity === 'task') q = q.lt('due_date', todayStart.toISOString()).not('due_date', 'is', null);
      else if (data.filter?.date || data.date) {
        const d = new Date(data.filter?.date || data.date); d.setHours(0,0,0,0);
        const d2 = new Date(d); d2.setDate(d2.getDate() + 1);
        q = q.gte(dateCol, d.toISOString()).lt(dateCol, d2.toISOString());
      } else { out.push({ tool: 'bulk_reschedule', ok: false, message: 'filter.when or filter.date required.' }); continue; }
      const { data: rows } = await q;
      if (!rows?.length) { out.push({ tool: 'bulk_reschedule', ok: true, message: `📭 No ${entity}s matched the filter.` }); continue; }
      const updates = (rows as any[]).map((r: any) => {
        if (entity === 'event') {
          const s = new Date(r.start_time); s.setDate(s.getDate() + shift);
          const e = r.end_time ? new Date(r.end_time) : null; if (e) e.setDate(e.getDate() + shift);
          return supabase.from('events').update({
            start_time: s.toISOString(),
            ...(e ? { end_time: e.toISOString() } : {}),
          }).eq('id', r.id).eq('user_id', userId);
        }
        const cur = new Date(r.due_date);
        cur.setDate(cur.getDate() + shift);
        return supabase.from('tasks').update({ due_date: cur.toISOString() }).eq('id', r.id).eq('user_id', userId);
      });
      await Promise.all(updates);
      out.push({ tool: 'bulk_reschedule', ok: true, message: `📅 Shifted ${rows.length} ${entity}${rows.length === 1 ? '' : 's'} by ${shift > 0 ? '+' : ''}${shift}d.` });
    } catch (e) { out.push({ tool: 'bulk_reschedule', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- bulk_delete_events ----------
  // Deletes all events on a given date (or in a date range) for the user.
  for (const m of text.matchAll(/<tool>bulk_delete_events<\/tool>\s*<bulk>(\{[\s\S]*?\})<\/bulk>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.date) { out.push({ tool: 'bulk_delete_events', ok: false, message: 'date (YYYY-MM-DD) required.' }); continue; }
    try {
      const d = new Date(data.date); d.setHours(0,0,0,0);
      const d2 = new Date(d); d2.setDate(d2.getDate() + 1);
      const { data: rows } = await supabase.from('events').select('*')
        .eq('user_id', userId).gte('start_time', d.toISOString()).lt('start_time', d2.toISOString());
      if (!rows?.length) { out.push({ tool: 'bulk_delete_events', ok: true, message: '📭 No events on that date.' }); continue; }
      await supabase.from('events').delete().eq('user_id', userId)
        .gte('start_time', d.toISOString()).lt('start_time', d2.toISOString());
      out.push({ tool: 'bulk_delete_events', ok: true, message: `🗑️ Cancelled ${rows.length} event${rows.length === 1 ? '' : 's'} on ${data.date}.` });
    } catch (e) { out.push({ tool: 'bulk_delete_events', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- append_note ----------
  // Finds a recent note by title fragment and appends new content with a separator.
  for (const m of text.matchAll(/<tool>append_note<\/tool>\s*<note>(\{[\s\S]*?\})<\/note>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.query || !data.content) { out.push({ tool: 'append_note', ok: false, message: 'query and content required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('notes').select('id, title, content')
        .eq('user_id', userId).eq('trashed', false).ilike('title', `%${data.query}%`)
        .order('updated_at', { ascending: false }).limit(1);
      if (!rows?.length) { out.push({ tool: 'append_note', ok: false, message: `🔍 No note matches "${data.query}".` }); continue; }
      const target = rows[0];
      const newContent = `${target.content || ''}\n\n---\n${new Date().toLocaleString()}\n${data.content}`;
      await supabase.from('notes').update({ content: newContent }).eq('id', target.id).eq('user_id', userId);
      out.push({ tool: 'append_note', ok: true, message: `📝 Appended to note: ${target.title}`, entityId: target.id });
    } catch (e) { out.push({ tool: 'append_note', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- log_expense ----------
  for (const m of text.matchAll(/<tool>log_expense<\/tool>\s*<expense>(\{[\s\S]*?\})<\/expense>/g)) {
    const data = safeJSON(m[1]) || {};
    const amount = Number(data.amount);
    if (!Number.isFinite(amount)) { out.push({ tool: 'log_expense', ok: false, message: 'amount required.' }); continue; }
    try {
      const desc = [data.category, data.description].filter(Boolean).join(' · ') || 'expense';
      const expense_date = (data.date && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) ? data.date : new Date().toISOString().slice(0, 10);
      const { data: row, error } = await supabase.from('family_expenses').insert({
        user_id: userId, amount, description: desc, expense_date,
      }).select('id').single();
      if (error) throw error;
      const undoId = await undoCreate('family_expenses', row.id, `logged €${amount} expense`, 'expense');
      out.push({ tool: 'log_expense', ok: true, message: `💶 Logged ${data.currency || '€'}${amount.toFixed(2)} — ${desc}`, undoId, entityId: row.id });
    } catch (e) { out.push({ tool: 'log_expense', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- query_expenses ----------
  for (const m of text.matchAll(/<tool>query_expenses<\/tool>\s*<query>(\{[\s\S]*?\})<\/query>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      const period = (data.period || 'month').toLowerCase();
      const since = new Date();
      if (period === 'today') since.setHours(0,0,0,0);
      else if (period === 'week') since.setDate(since.getDate() - 7);
      else if (period === 'year') since.setFullYear(since.getFullYear() - 1);
      else since.setMonth(since.getMonth() - 1);
      let q = supabase.from('family_expenses').select('amount, description, expense_date')
        .eq('user_id', userId).gte('expense_date', since.toISOString().slice(0,10));
      if (data.category) q = q.ilike('description', `%${data.category}%`);
      const { data: rows } = await q;
      const total = (rows || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const count = rows?.length || 0;
      const cat = data.category ? ` on "${data.category}"` : '';
      out.push({ tool: 'query_expenses', ok: true, message: `💶 You spent <b>€${total.toFixed(2)}</b>${cat} in the past ${period} (${count} item${count === 1 ? '' : 's'}).` });
    } catch (e) { out.push({ tool: 'query_expenses', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- wellbeing_summary ----------
  for (const m of text.matchAll(/<tool>wellbeing_summary<\/tool>\s*<summary>(\{[\s\S]*?\})<\/summary>/g)) {
    const data = safeJSON(m[1]) || {};
    const metric = String(data.metric || 'mood').toLowerCase();
    const period = (data.period || 'week').toLowerCase();
    try {
      const since = new Date();
      since.setDate(since.getDate() - (period === 'month' ? 30 : 7));
      const sinceDate = since.toISOString().slice(0,10);
      const validCols = new Set(['mood', 'sleep_hours', 'water_glasses', 'exercise_minutes', 'steps', 'stress_level']);
      if (!validCols.has(metric)) { out.push({ tool: 'wellbeing_summary', ok: false, message: `Unsupported metric "${metric}".` }); continue; }
      // daily_checkins stores `mood` as text — coerce; columns water_glasses/steps may not exist on every deployment, fall back gracefully.
      const safeCol = ['mood', 'sleep_hours', 'exercise_minutes', 'stress_level'].includes(metric) ? metric : null;
      if (!safeCol) { out.push({ tool: 'wellbeing_summary', ok: true, message: `📭 ${metric.replace('_',' ')} is not tracked yet — use /checkin to start logging.` }); continue; }
      const { data: rows } = await supabase.from('daily_checkins')
        .select(`checkin_date, ${safeCol}`)
        .eq('user_id', userId).gte('checkin_date', sinceDate)
        .order('checkin_date', { ascending: true });
      const moodMap: Record<string, number> = { terrible: 1, bad: 2, low: 2, ok: 3, mid: 3, neutral: 3, okay: 3, good: 4, great: 5, high: 5, amazing: 5 };
      const vals = (rows || []).map((r: any) => {
        const v = r[safeCol];
        if (typeof v === 'number') return v;
        if (typeof v === 'string') {
          const n = Number(v); if (Number.isFinite(n)) return n;
          return moodMap[v.toLowerCase()] ?? NaN;
        }
        return NaN;
      }).filter((n: number) => Number.isFinite(n));
      if (!vals.length) { out.push({ tool: 'wellbeing_summary', ok: true, message: `📭 No ${metric} entries in the last ${period}.` }); continue; }
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const min = Math.min(...vals), max = Math.max(...vals);
      out.push({ tool: 'wellbeing_summary', ok: true, message: `📊 ${metric.replace('_',' ')} (last ${period}): avg <b>${avg.toFixed(1)}</b>, range ${min}–${max}, ${vals.length} entries.` });
    } catch (e) { out.push({ tool: 'wellbeing_summary', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- recipe_to_shopping ----------
  for (const m of text.matchAll(/<tool>recipe_to_shopping<\/tool>\s*<recipe>(\{[\s\S]*?\})<\/recipe>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.name) { out.push({ tool: 'recipe_to_shopping', ok: false, message: 'name required.' }); continue; }
    try {
      const { data: recipes } = await supabase.from('recipes').select('id, name')
        .eq('user_id', userId).ilike('name', `%${data.name}%`).limit(1);
      if (!recipes?.length) { out.push({ tool: 'recipe_to_shopping', ok: false, message: `🔍 No recipe matches "${data.name}".` }); continue; }
      const recipe = recipes[0];
      const { data: ingredients } = await supabase.from('recipe_ingredients')
        .select('name, quantity, unit, category').eq('recipe_id', recipe.id);
      if (!ingredients?.length) { out.push({ tool: 'recipe_to_shopping', ok: true, message: `📭 "${recipe.name}" has no saved ingredients.` }); continue; }
      const { data: list } = await supabase.from('shopping_lists')
        .select('id').eq('user_id', userId).eq('is_completed', false)
        .order('created_at', { ascending: false }).limit(1);
      let listId = list?.[0]?.id;
      if (!listId) {
        const { data: newList } = await supabase.from('shopping_lists')
          .insert({ user_id: userId, name: 'Shopping list', is_completed: false }).select('id').single();
        listId = newList?.id;
      }
      const items = (ingredients as any[]).map((ing: any) => ({
        list_id: listId, user_id: userId, name: ing.name,
        quantity: Number.isFinite(Number(ing.quantity)) ? Math.max(1, Math.round(Number(ing.quantity))) : 1,
        unit: ing.unit || null,
        category: ing.category || 'other', is_checked: false,
      }));
      const { error } = await supabase.from('shopping_list_items').insert(items);
      if (error) throw error;
      out.push({ tool: 'recipe_to_shopping', ok: true, message: `🛒 Added ${items.length} ingredient${items.length === 1 ? '' : 's'} from "${recipe.name}" to your shopping list.` });
    } catch (e) { out.push({ tool: 'recipe_to_shopping', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- weather (open-meteo, no API key) ----------
  for (const m of text.matchAll(/<tool>weather<\/tool>\s*<weather>(\{[\s\S]*?\})<\/weather>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.location) { out.push({ tool: 'weather', ok: false, message: 'location required.' }); continue; }
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.location)}&count=1`)
        .then(r => r.json()).catch(() => null);
      const place = geo?.results?.[0];
      if (!place) { out.push({ tool: 'weather', ok: false, message: `🌍 Couldn't find "${data.location}".` }); continue; }
      const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto&forecast_days=2`)
        .then(r => r.json()).catch(() => null);
      if (!w?.daily) { out.push({ tool: 'weather', ok: false, message: `🌍 Weather lookup failed.` }); continue; }
      const idx = (data.when || 'today').toLowerCase() === 'tomorrow' ? 1 : 0;
      const hi = w.daily.temperature_2m_max?.[idx];
      const lo = w.daily.temperature_2m_min?.[idx];
      const rain = w.daily.precipitation_sum?.[idx];
      out.push({ tool: 'weather', ok: true, message: `🌤 <b>${place.name}, ${place.country_code}</b> (${idx === 0 ? 'today' : 'tomorrow'}): ${lo}°–${hi}°C, ${rain ?? 0}mm precip.` });
    } catch (e) { out.push({ tool: 'weather', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- trip_template ----------
  for (const m of text.matchAll(/<tool>trip_template<\/tool>\s*<trip>(\{[\s\S]*?\})<\/trip>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.destination || !data.start || !data.end) { out.push({ tool: 'trip_template', ok: false, message: 'destination, start, end required.' }); continue; }
    try {
      const { data: ev, error: evErr } = await supabase.from('events').insert({
        user_id: userId, title: `Trip: ${data.destination}`,
        start_time: new Date(data.start + 'T09:00:00').toISOString(),
        end_time: new Date(data.end + 'T18:00:00').toISOString(),
        category: 'personal', location: data.destination,
      }).select('id, title').single();
      if (evErr) throw evErr;
      const undoId = await undoCreate('events', ev.id, `created trip "${ev.title}"`, 'event');
      let taskCount = 0;
      if (data.packing !== false) {
        const tripStart = new Date(data.start + 'T00:00:00');
        const dueDate = new Date(tripStart); dueDate.setDate(dueDate.getDate() - 2);
        const dueIso = dueDate.toISOString();
        const seeds = [
          'Pack clothes', 'Passport / ID', 'Chargers & adapters', 'Toiletries', 'Confirm bookings',
        ];
        const rows = seeds.map((title) => ({
          user_id: userId, title: `${title} for ${data.destination}`,
          category: 'personal', priority: 'medium', due_date: dueIso, status: 'backlog',
        }));
        const { error: tErr } = await supabase.from('tasks').insert(rows);
        if (!tErr) taskCount = rows.length;
      }
      out.push({ tool: 'trip_template', ok: true, message: `✈️ Trip to ${data.destination} added (${data.start} → ${data.end})${taskCount ? ` + ${taskCount} packing tasks` : ''}.`, undoId, entityId: ev.id });
    } catch (e) { out.push({ tool: 'trip_template', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- set_language ----------
  for (const m of text.matchAll(/<tool>set_language<\/tool>\s*<lang>(\{[\s\S]*?\})<\/lang>/g)) {
    const data = safeJSON(m[1]) || {};
    const lang = String(data.lang || '').toLowerCase().slice(0, 5);
    if (!['de', 'en', 'de-de', 'en-us', 'en-gb'].includes(lang)) { out.push({ tool: 'set_language', ok: false, message: 'lang must be "de" or "en".' }); continue; }
    try {
      await supabase.from('profiles').update({ locale: lang }).eq('user_id', userId);
      out.push({ tool: 'set_language', ok: true, message: lang.startsWith('de') ? '🇩🇪 Sprache auf Deutsch gestellt.' : '🇬🇧 Language set to English.' });
    } catch (e) { out.push({ tool: 'set_language', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- manage_settings (proactive prefs: digest time, quiet hours, nudges) ----------
  for (const m of text.matchAll(/<tool>manage_settings<\/tool>\s*<settings>(\{[\s\S]*?\})<\/settings>/g)) {
    const data = safeJSON(m[1]); if (!data || typeof data !== 'object') continue;
    try {
      const upd: Record<string, any> = {};
      const isHHMM = (s: unknown): s is string =>
        typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
      const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
      const keyMap: Array<[string, string, 'time' | 'bool']> = [
        ['morningBriefingTime', 'morning_briefing_time', 'time'],
        ['eveningReviewTime', 'evening_review_time', 'time'],
        ['quietHoursStart', 'quiet_hours_start', 'time'],
        ['quietHoursEnd', 'quiet_hours_end', 'time'],
        ['quietHoursEnabled', 'quiet_hours_enabled', 'bool'],
        ['forgottenTasksEnabled', 'forgotten_tasks_enabled', 'bool'],
        ['contractRenewalsEnabled', 'contract_renewals_enabled', 'bool'],
        ['contactCheckinsEnabled', 'contact_checkins_enabled', 'bool'],
        ['eventPrepEnabled', 'event_prep_enabled', 'bool'],
        ['habitStreaksEnabled', 'habit_streaks_enabled', 'bool'],
        ['weeklyPlanningEnabled', 'weekly_planning_enabled', 'bool'],
        ['dailyReviewEnabled', 'daily_review_enabled', 'bool'],
        ['voiceProactiveEnabled', 'voice_proactive_enabled', 'bool'],
        ['pushNotificationsEnabled', 'push_notifications_enabled', 'bool'],
        ['enabled', 'enabled', 'bool'],
      ];
      const friendlyChanges: string[] = [];
      for (const [inKey, colName, kind] of keyMap) {
        if (!(inKey in data)) continue;
        const val = (data as any)[inKey];
        if (kind === 'time') {
          if (!isHHMM(val)) continue;
          upd[colName] = `${val}:00`; // postgres TIME wants HH:MM:SS
          friendlyChanges.push(`${inKey} → ${val}`);
        } else {
          if (!isBool(val)) continue;
          upd[colName] = val;
          friendlyChanges.push(`${inKey} → ${val ? 'on' : 'off'}`);
        }
      }
      // pauseUntil — natural-language shorthand for proactive_settings.focus_mode_until.
      // Accepts ISO ("2026-05-17T09:00:00Z"), durations ("2 hours", "30 min", "1h"),
      // or named phrases ("tomorrow", "tomorrow 9am", "tonight", "clear"/"off").
      if ('pauseUntil' in (data as any)) {
        const raw = (data as any).pauseUntil;
        let target: Date | null = null;
        let cleared = false;
        if (raw === null || raw === false || raw === 'clear' || raw === 'off' || raw === '') {
          cleared = true;
        } else if (typeof raw === 'string') {
          const s = raw.trim().toLowerCase();
          // 1) Duration: "2 hours", "30 min", "1h", "45m".
          const m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|d|day|days)\b/);
          if (m) {
            const n = parseFloat(m[1]);
            const unit = m[2];
            const minutes = /^h/.test(unit) ? n * 60 : /^d/.test(unit) ? n * 60 * 24 : n;
            target = new Date(Date.now() + minutes * 60_000);
          } else if (s === 'tonight') {
            target = new Date(); target.setHours(23, 0, 0, 0);
          } else if (s === 'tomorrow' || s === 'tomorrow morning') {
            target = new Date(); target.setDate(target.getDate() + 1); target.setHours(9, 0, 0, 0);
          } else {
            // "tomorrow 9am", "tomorrow at 14:30"
            const tm = s.match(/^tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
            if (tm) {
              let hour = parseInt(tm[1], 10);
              const min = tm[2] ? parseInt(tm[2], 10) : 0;
              const ap = tm[3];
              if (ap === 'pm' && hour < 12) hour += 12;
              if (ap === 'am' && hour === 12) hour = 0;
              target = new Date(); target.setDate(target.getDate() + 1); target.setHours(hour, min, 0, 0);
            } else {
              // Last resort: ISO parse.
              const d = new Date(raw);
              if (!isNaN(d.getTime()) && d.getTime() > Date.now()) target = d;
            }
          }
        }
        if (cleared) {
          await supabase.from('proactive_settings')
            .upsert({ user_id: userId, focus_mode_until: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          friendlyChanges.push('pauseUntil → cleared');
        } else if (target) {
          await supabase.from('proactive_settings')
            .upsert({ user_id: userId, focus_mode_until: target.toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
          friendlyChanges.push(`pauseUntil → ${target.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`);
        } else {
          friendlyChanges.push(`pauseUntil → (couldn't parse "${raw}")`);
        }
      }
      // Timezone lives on profiles, not proactive_settings — handle it
      // separately so the rest of the proactive_settings upsert stays clean.
      if (typeof (data as any).timezone === 'string') {
        const tz = String((data as any).timezone).trim();
        // Quick sanity check via Intl — invalid tz strings throw.
        let tzValid = false;
        try { new Intl.DateTimeFormat('en', { timeZone: tz }); tzValid = true; } catch { /* invalid */ }
        if (tzValid) {
          await supabase.from('profiles').update({ timezone: tz }).eq('user_id', userId);
          friendlyChanges.push(`timezone → ${tz}`);
        } else {
          friendlyChanges.push(`timezone → (rejected, not a valid IANA name)`);
        }
      }
      if (Object.keys(upd).length === 0 && friendlyChanges.length === 0) {
        out.push({ tool: 'manage_settings', ok: false, message: 'No valid setting fields provided.' });
        continue;
      }
      if (Object.keys(upd).length > 0) {
        // Upsert so first-time users get a row created automatically.
        const { error } = await supabase.from('proactive_settings')
          .upsert({ user_id: userId, ...upd, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
      }
      out.push({
        tool: 'manage_settings', ok: true,
        message: `⚙️ Updated settings: ${friendlyChanges.join(', ')}`,
      });
    } catch (e) {
      out.push({ tool: 'manage_settings', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- send_family_message (relay a message from the user to another family member's Telegram) ----------
  for (const m of text.matchAll(/<tool>send_family_message<\/tool>\s*<msg>(\{[\s\S]*?\})<\/msg>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.to || !data.body) {
      out.push({ tool: 'send_family_message', ok: false, message: 'Both "to" and "body" are required.' });
      continue;
    }
    try {
      // Accept either a single string or an array; "everyone" / "family" /
      // "all" expand to the full workspace member list (sender excluded).
      const raw = Array.isArray(data.to) ? data.to.map(String) : [String(data.to)];
      const recipientNames: string[] = [];
      for (const r of raw) {
        const lower = r.trim().toLowerCase();
        if (['everyone', 'family', 'all', 'all of us'].includes(lower)) {
          if (opts?.workspaceMembers?.length) {
            for (const wm of opts.workspaceMembers) {
              if (wm.user_id !== userId && wm.display_name) recipientNames.push(wm.display_name);
            }
          }
        } else if (r.trim().length > 0) {
          recipientNames.push(r.trim());
        }
      }
      if (recipientNames.length === 0) {
        out.push({ tool: 'send_family_message', ok: false, message: 'No recipients resolved (try a specific name or invite them to the workspace first).' });
        continue;
      }
      const bodyText = String(data.body).slice(0, 3500);
      let senderName = data.fromLabel as string | undefined;
      if (!senderName) {
        const { data: senderProfile } = await supabase.from('profiles')
          .select('display_name').eq('user_id', userId).maybeSingle();
        senderName = senderProfile?.display_name || 'Family member';
      }
      const fromLabel = String(senderName).slice(0, 80);
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const telegramKey = Deno.env.get('TELEGRAM_API_KEY');
      if (!lovableKey || !telegramKey) {
        out.push({ tool: 'send_family_message', ok: false, message: 'Telegram bot credentials are not configured server-side.' });
        continue;
      }
      const relMap: Record<string, string[]> = {
        wife: ['spouse'], husband: ['spouse'], partner: ['spouse'],
        mom: ['parent'], mum: ['parent'], mother: ['parent'],
        dad: ['parent'], father: ['parent'],
        son: ['child'], daughter: ['child'], kid: ['child'],
        brother: ['sibling'], sister: ['sibling'],
      };
      const composed = `💬 <b>From ${fromLabel}</b>\n${bodyText}`;
      const delivered: string[] = [];
      const failures: string[] = [];
      for (const recipientName of recipientNames) {
        // 1) Workspace member by display name.
        let recipientUserId: string | null = null;
        let recipientDisplay = recipientName;
        if (opts?.workspaceMembers?.length) {
          const matchByName = opts.workspaceMembers.find((wm) => {
            const dn = (wm.display_name || '').toLowerCase();
            return dn === recipientName.toLowerCase() || dn.includes(recipientName.toLowerCase());
          });
          if (matchByName) {
            recipientUserId = matchByName.user_id;
            recipientDisplay = matchByName.display_name || recipientName;
          }
        }
        // 2) Family-members fallback (relationship word or name match).
        if (!recipientUserId) {
          const rels = relMap[recipientName.toLowerCase()];
          let famQuery = supabase.from('family_members')
            .select('id, name, relationship')
            .eq('user_id', userId).eq('is_active', true).limit(1);
          famQuery = rels && rels.length > 0
            ? famQuery.in('relationship', rels)
            : famQuery.ilike('name', `%${recipientName}%`);
          const { data: famRow } = await famQuery;
          if (famRow?.[0]) recipientDisplay = famRow[0].name || recipientName;
        }
        if (!recipientUserId) {
          failures.push(`${recipientDisplay} (no linked account)`);
          continue;
        }
        // 3) Their private Telegram chat_id.
        const { data: link } = await supabase.from('telegram_links')
          .select('chat_id, is_active').eq('user_id', recipientUserId).maybeSingle();
        if (!link?.chat_id || link.is_active === false) {
          failures.push(`${recipientDisplay} (Telegram not linked)`);
          continue;
        }
        // 4) Deliver.
        const res = await fetch('https://connector-gateway.lovable.dev/telegram/sendMessage', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableKey}`,
            'X-Connection-Api-Key': telegramKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chat_id: link.chat_id, text: composed.slice(0, 4000), parse_mode: 'HTML' }),
        });
        if (!res.ok) {
          failures.push(`${recipientDisplay} (HTTP ${res.status})`);
        } else {
          delivered.push(recipientDisplay);
        }
      }
      const preview = bodyText.length > 60 ? bodyText.slice(0, 57) + '…' : bodyText;
      const parts: string[] = [];
      if (delivered.length > 0) parts.push(`📨 Sent to ${delivered.join(', ')}: "${preview}"`);
      if (failures.length > 0) parts.push(`⚠️ Couldn't reach ${failures.join(', ')}.`);
      out.push({
        tool: 'send_family_message',
        ok: delivered.length > 0,
        message: parts.join(' ') || 'No recipients reached.',
      });
    } catch (e) {
      out.push({ tool: 'send_family_message', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- family_poll (post a native Telegram poll into the linked family group) ----------
  for (const m of text.matchAll(/<tool>family_poll<\/tool>\s*<poll>(\{[\s\S]*?\})<\/poll>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.question || !Array.isArray(data.options) || data.options.length < 2) {
      out.push({ tool: 'family_poll', ok: false, message: 'question + at least 2 options required.' });
      continue;
    }
    try {
      const options = (data.options as unknown[]).map(String).filter((s) => s.trim().length > 0).slice(0, 10);
      if (options.length < 2) {
        out.push({ tool: 'family_poll', ok: false, message: 'Need at least 2 non-empty options.' });
        continue;
      }
      // Either the user owns the group link or they're the linked partner.
      const { data: group } = await supabase.from('telegram_group_links')
        .select('chat_id, title, is_active')
        .or(`owner_user_id.eq.${userId},partner_user_id.eq.${userId}`)
        .eq('is_active', true)
        .maybeSingle();
      if (!group?.chat_id) {
        out.push({
          tool: 'family_poll', ok: false,
          message: "No linked family group. Add me to the group and run /linkfamily first.",
        });
        continue;
      }
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      const telegramKey = Deno.env.get('TELEGRAM_API_KEY');
      if (!lovableKey || !telegramKey) {
        out.push({ tool: 'family_poll', ok: false, message: 'Telegram bot credentials are not configured server-side.' });
        continue;
      }
      const res = await fetch('https://connector-gateway.lovable.dev/telegram/sendPoll', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableKey}`,
          'X-Connection-Api-Key': telegramKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: group.chat_id,
          question: String(data.question).slice(0, 300),
          options,
          is_anonymous: data.anonymous !== false,
          allows_multiple_answers: !!data.multipleAnswers,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        out.push({ tool: 'family_poll', ok: false, message: `Poll failed (${res.status}): ${errText.slice(0, 200)}` });
        continue;
      }
      out.push({
        tool: 'family_poll', ok: true,
        message: `🗳️ Posted poll to ${group.title || 'family group'}: "${String(data.question).slice(0, 80)}"`,
      });
    } catch (e) {
      out.push({ tool: 'family_poll', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- manage_exception (skip a single occurrence of a recurring task/event) ----------
  for (const m of text.matchAll(/<tool>manage_exception<\/tool>\s*<exception>(\{[\s\S]*?\})<\/exception>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.parentKind || !data.query || !data.date) {
      out.push({ tool: 'manage_exception', ok: false, message: 'parentKind, query and date are required.' });
      continue;
    }
    if (data.parentKind !== 'task' && data.parentKind !== 'event') {
      out.push({ tool: 'manage_exception', ok: false, message: 'parentKind must be "task" or "event".' });
      continue;
    }
    try {
      const table = data.parentKind === 'task' ? 'tasks' : 'events';
      const { data: rows } = await supabase.from(table)
        .select('id, title, recurrence_rule')
        .eq('user_id', userId)
        .ilike('title', `%${data.query}%`)
        .not('recurrence_rule', 'is', null)
        .limit(1);
      const parent = rows?.[0];
      if (!parent) {
        out.push({ tool: 'manage_exception', ok: false, message: `No recurring ${data.parentKind} matches "${data.query}".` });
        continue;
      }
      const exDate = (() => {
        const d = new Date(data.date);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 10);
      })();
      if (!exDate) {
        out.push({ tool: 'manage_exception', ok: false, message: `Invalid date: ${data.date}` });
        continue;
      }
      const { error } = await supabase.from('recurrence_exceptions').upsert({
        user_id: userId,
        parent_kind: data.parentKind,
        parent_id: parent.id,
        exception_date: exDate,
        reason: data.reason || null,
      }, { onConflict: 'parent_kind,parent_id,exception_date' });
      if (error) throw error;
      const when = new Date(exDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
      out.push({
        tool: 'manage_exception', ok: true,
        message: `🚫 Skipping "${parent.title}" on ${when}.`,
      });
    } catch (e) {
      out.push({ tool: 'manage_exception', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- manage_focus (time tracking) ----------
  for (const m of text.matchAll(/<tool>manage_focus<\/tool>\s*<action>(\w+)<\/action>\s*<focus>(\{[\s\S]*?\})<\/focus>/g)) {
    const action = m[1];
    const data = safeJSON(m[2]) || {};
    try {
      if (action === 'start') {
        // Resolve task if a query was provided.
        let taskId: string | null = null;
        let label = (data.label as string | undefined) || null;
        if (data.taskQuery) {
          const { data: tasks } = await supabase.from('tasks')
            .select('id, title').eq('user_id', userId)
            .ilike('title', `%${data.taskQuery}%`).limit(1);
          if (tasks?.[0]) { taskId = tasks[0].id; label = label || tasks[0].title; }
        }
        if (!taskId && !label) {
          out.push({ tool: 'manage_focus', ok: false, message: 'Provide either taskQuery or label to start a focus session.' });
          continue;
        }
        const category = ['business', 'personal', 'family', 'shared', 'focus'].includes(String(data.category))
          ? data.category : 'focus';
        const { data: inserted, error } = await supabase.from('focus_sessions').insert({
          user_id: userId, task_id: taskId, label,
          category, started_at: new Date().toISOString(),
          workspace_id: opts?.workspaceId || null,
        }).select('id, started_at, label').single();
        if (error) {
          // 23505 = unique violation → already an open session.
          if (String(error.code) === '23505') {
            out.push({ tool: 'manage_focus', ok: false, message: 'You already have an open focus session — stop it first.' });
            continue;
          }
          throw error;
        }
        out.push({
          tool: 'manage_focus', ok: true,
          message: `🎯 Focus session started: ${inserted.label || 'session'} at ${new Date(inserted.started_at).toLocaleTimeString()}`,
          entityId: inserted.id,
        });
      } else if (action === 'stop') {
        const { data: open } = await supabase.from('focus_sessions')
          .select('id, started_at, label').eq('user_id', userId).is('ended_at', null)
          .order('started_at', { ascending: false }).limit(1);
        const session = open?.[0];
        if (!session) {
          out.push({ tool: 'manage_focus', ok: false, message: 'No open focus session to stop.' });
          continue;
        }
        const endedAt = new Date().toISOString();
        await supabase.from('focus_sessions').update({ ended_at: endedAt }).eq('id', session.id);
        const mins = Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(session.started_at).getTime()) / 60000));
        out.push({
          tool: 'manage_focus', ok: true,
          message: `🛑 Stopped: ${session.label || 'session'} — ${mins} min logged.`,
        });
      } else if (action === 'query') {
        const sinceArg = String(data.since || 'this_week');
        const now = new Date();
        let since: Date;
        if (sinceArg === 'today') {
          since = new Date(now); since.setHours(0, 0, 0, 0);
        } else if (sinceArg === 'last_7_days' || sinceArg === 'this_week') {
          since = new Date(now.getTime() - 7 * 86400000);
        } else if (sinceArg === 'last_30_days') {
          since = new Date(now.getTime() - 30 * 86400000);
        } else {
          const parsed = new Date(sinceArg);
          if (isNaN(parsed.getTime())) { out.push({ tool: 'manage_focus', ok: false, message: `Unrecognised since: ${sinceArg}` }); continue; }
          since = parsed;
        }
        let q = supabase.from('focus_sessions')
          .select('label, task_id, duration_minutes, started_at, tasks(title)')
          .eq('user_id', userId).not('ended_at', 'is', null)
          .gte('started_at', since.toISOString());
        if (data.taskQuery) {
          // Filter by task title via a separate lookup since PostgREST joins
          // don't ilike across the joined table easily.
          const { data: t } = await supabase.from('tasks').select('id')
            .eq('user_id', userId).ilike('title', `%${data.taskQuery}%`).limit(20);
          const ids = (t || []).map((r: any) => r.id);
          if (ids.length === 0) { out.push({ tool: 'manage_focus', ok: true, message: `📊 No focus time logged on "${data.taskQuery}" since ${since.toLocaleDateString()}.` }); continue; }
          q = q.in('task_id', ids);
        }
        const { data: rows } = await q;
        const sessions = rows || [];
        const totalMin = sessions.reduce((n: number, r: any) => n + (r.duration_minutes || 0), 0);
        // Group by task title (or free-text label).
        const buckets: Record<string, number> = {};
        for (const r of sessions as any[]) {
          const key = r.tasks?.title || r.label || '(unnamed)';
          buckets[key] = (buckets[key] || 0) + (r.duration_minutes || 0);
        }
        const topLines = Object.entries(buckets)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([k, v]) => `  • ${k}: ${Math.floor(v / 60)}h ${v % 60}m`);
        out.push({
          tool: 'manage_focus', ok: true,
          message: `📊 Focus since ${since.toLocaleDateString()}: ${Math.floor(totalMin / 60)}h ${totalMin % 60}m across ${sessions.length} session${sessions.length === 1 ? '' : 's'}.\n${topLines.join('\n')}`.trim(),
        });
      } else {
        out.push({ tool: 'manage_focus', ok: false, message: `Unknown action "${action}". Use start/stop/query.` });
      }
    } catch (e) {
      out.push({ tool: 'manage_focus', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- fetch_url (pull a webpage and summarise / save) ----------
  for (const m of text.matchAll(/<tool>fetch_url<\/tool>\s*<url>(\{[\s\S]*?\})<\/url>/g)) {
    const data = safeJSON(m[1]); if (!data?.url) {
      out.push({ tool: 'fetch_url', ok: false, message: 'URL is required.' });
      continue;
    }
    try {
      let url: URL;
      try { url = new URL(String(data.url)); } catch {
        out.push({ tool: 'fetch_url', ok: false, message: `Invalid URL: ${data.url}` });
        continue;
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        out.push({ tool: 'fetch_url', ok: false, message: 'Only http(s) URLs are allowed.' });
        continue;
      }
      // Cheap fetch with a short timeout and a sensible UA. We strip HTML
      // server-side rather than passing megabytes to the model.
      const controller = new AbortController();
      const tm = setTimeout(() => controller.abort(), 12_000);
      let html = '';
      try {
        const resp = await fetch(url.toString(), {
          headers: { 'User-Agent': 'DarAI/1.0 (link summariser)' },
          signal: controller.signal,
        });
        if (!resp.ok) {
          out.push({ tool: 'fetch_url', ok: false, message: `Fetch failed: ${resp.status} ${resp.statusText}` });
          continue;
        }
        const buf = await resp.text();
        html = buf.slice(0, 200_000); // hard cap on bytes processed
      } finally {
        clearTimeout(tm);
      }
      const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [, ''])[1].trim().slice(0, 200) || url.hostname;
      // Crude text extraction: strip scripts/styles, then tags. Good enough
      // for an LLM summary; not a full reader-mode parser.
      const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8_000);
      const intent = String(data.intent || 'summarise');
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableKey) {
        out.push({ tool: 'fetch_url', ok: false, message: 'AI gateway not configured server-side.' });
        continue;
      }
      const askMap: Record<string, string> = {
        summarise: 'Summarise the page in 4-6 bullet points, ending with a one-line "why it matters" framing.',
        save_note: 'Distil the page into a note: a short title, then 3-7 key bullet points the user will scan later.',
        extract_tasks: 'Extract concrete, actionable to-dos for the reader. Return them as a numbered list. Skip generic advice.',
      };
      const ask = askMap[intent] || askMap.summarise;
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You compress webpages into useful summaries. Be specific, no fluff.' },
            { role: 'user', content: `URL: ${url.toString()}\nTitle: ${title}\n\nContent:\n${stripped}\n\nTask: ${ask}` },
          ],
        }),
      });
      const aiJson: any = await aiResp.json().catch(() => null);
      const reply = aiJson?.choices?.[0]?.message?.content?.trim() || '(no summary)';
      // Optionally persist as a note if the user wanted it saved.
      if (intent === 'save_note') {
        try {
          await supabase.from('notes').insert({
            user_id: userId,
            title: title.slice(0, 200),
            content: `${url.toString()}\n\n${reply}`,
            tags: ['link', 'web'],
          });
        } catch (e) { console.warn('fetch_url note insert failed', (e as Error).message); }
      }
      out.push({
        tool: 'fetch_url', ok: true,
        message: `🔗 ${title}\n${reply}`,
      });
    } catch (e) {
      out.push({ tool: 'fetch_url', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- summarise_document (uses the latest cached document for this user) ----------
  for (const m of text.matchAll(/<tool>summarise_document<\/tool>\s*<doc>(\{[\s\S]*?\})<\/doc>/g)) {
    const data = safeJSON(m[1]) || {};
    const intent = String(data.intent || 'summary');
    try {
      // Pull the most recent telegram_documents row for this user.
      const { data: docRow } = await supabase.from('telegram_documents')
        .select('id, filename, mime_type, extracted_text, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!docRow?.extracted_text) {
        out.push({
          tool: 'summarise_document', ok: false,
          message: "I don't have a recent document on file. Send the PDF (or paste the text) and try again.",
        });
        continue;
      }
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableKey) {
        out.push({ tool: 'summarise_document', ok: false, message: 'AI gateway not configured server-side.' });
        continue;
      }
      const askMap: Record<string, string> = {
        summary: 'Summarise the document in 5-8 bullet points. End with a one-line "what to do next" framing.',
        contract_review: 'Review this as a contract. Call out: parties, term, auto-renewal, notice period, fees, termination clauses, anything unusual. Be terse.',
        extract_tasks: 'Extract concrete to-dos for the reader. Numbered list. Skip generic advice.',
      };
      const ask = askMap[intent] || askMap.summary;
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You analyse uploaded documents. Be specific, terse, and structured.' },
            { role: 'user', content: `Filename: ${docRow.filename}\nType: ${docRow.mime_type}\n\nContent:\n${docRow.extracted_text.slice(0, 15_000)}\n\nTask: ${ask}` },
          ],
        }),
      });
      const aiJson: any = await aiResp.json().catch(() => null);
      const reply = aiJson?.choices?.[0]?.message?.content?.trim() || '(no analysis)';
      if (data.saveNote) {
        try {
          await supabase.from('notes').insert({
            user_id: userId,
            title: `${docRow.filename} — ${intent}`.slice(0, 200),
            content: reply,
            tags: ['document', intent],
          });
        } catch (e) { console.warn('summarise_document note insert failed', (e as Error).message); }
      }
      out.push({
        tool: 'summarise_document', ok: true,
        message: `📄 ${docRow.filename}\n${reply}`,
      });
    } catch (e) {
      out.push({ tool: 'summarise_document', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- translate (free-text translation) ----------
  for (const m of text.matchAll(/<tool>translate<\/tool>\s*<translate>(\{[\s\S]*?\})<\/translate>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.text || !data?.targetLang) {
      out.push({ tool: 'translate', ok: false, message: 'text + targetLang required.' });
      continue;
    }
    try {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableKey) { out.push({ tool: 'translate', ok: false, message: 'AI gateway not configured.' }); continue; }
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a translator. Output ONLY the translation, no commentary, no quotes.' },
            { role: 'user', content: `Translate to ${data.targetLang}:\n\n${String(data.text).slice(0, 6000)}` },
          ],
        }),
      });
      const aiJson: any = await aiResp.json().catch(() => null);
      const reply = aiJson?.choices?.[0]?.message?.content?.trim() || '';
      if (!reply) { out.push({ tool: 'translate', ok: false, message: 'Translation came back empty.' }); continue; }
      out.push({ tool: 'translate', ok: true, message: `🌐 ${reply}` });
    } catch (e) {
      out.push({ tool: 'translate', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- rewrite_text (tone / length adjustment on arbitrary text) ----------
  for (const m of text.matchAll(/<tool>rewrite_text<\/tool>\s*<rewrite>(\{[\s\S]*?\})<\/rewrite>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.text) { out.push({ tool: 'rewrite_text', ok: false, message: 'text is required.' }); continue; }
    try {
      const lovableKey = Deno.env.get('LOVABLE_API_KEY');
      if (!lovableKey) { out.push({ tool: 'rewrite_text', ok: false, message: 'AI gateway not configured.' }); continue; }
      const directives: string[] = [];
      if (data.tone) directives.push(`Tone: ${data.tone}`);
      if (data.length && data.length !== 'same') directives.push(`Make it ${data.length}`);
      if (data.language) directives.push(`Write in ${data.language}`);
      directives.push('Preserve the original meaning. Output only the rewrite, no commentary.');
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You rewrite text to spec. Output only the rewrite.' },
            { role: 'user', content: `${directives.join('. ')}\n\nText:\n${String(data.text).slice(0, 6000)}` },
          ],
        }),
      });
      const aiJson: any = await aiResp.json().catch(() => null);
      const reply = aiJson?.choices?.[0]?.message?.content?.trim() || '';
      if (!reply) { out.push({ tool: 'rewrite_text', ok: false, message: 'Rewrite came back empty.' }); continue; }
      out.push({ tool: 'rewrite_text', ok: true, message: `✏️ ${reply}` });
    } catch (e) {
      out.push({ tool: 'rewrite_text', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- email_to_task (forward an email and turn it into a task) ----------
  for (const m of text.matchAll(/<tool>email_to_task<\/tool>\s*<e2t>(\{[\s\S]*?\})<\/e2t>/g)) {
    const data = safeJSON(m[1]);
    if (!data?.subject || !data?.body) {
      out.push({ tool: 'email_to_task', ok: false, message: 'subject + body required.' });
      continue;
    }
    try {
      const title = String(data.subject).slice(0, 200);
      const from = data.from ? `From: ${data.from}\n\n` : '';
      const description = `${from}${String(data.body).slice(0, 4000)}`;
      const due = isoOrNull(data.dueDate);
      const priority = ['high', 'medium', 'low'].includes(String(data.priority)) ? data.priority : 'medium';
      const { data: t, error } = await supabase.from('tasks').insert({
        user_id: userId, title, description, category: 'business',
        priority, due_date: due,
        workspace_id: opts?.workspaceId || null,
      }).select('id, title').single();
      if (error) throw error;
      const undoId = await undoCreate('tasks', t.id, `task from email "${t.title}"`, 'task');
      out.push({
        tool: 'email_to_task', ok: true,
        message: `📧→✅ Saved as task: ${t.title}${due ? ` (due ${new Date(due).toLocaleDateString()})` : ''}`,
        undoId, entityId: t.id,
      });
    } catch (e) {
      out.push({ tool: 'email_to_task', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- get_capabilities (static feature list for "what can you do?" questions) ----------
  for (const _m of text.matchAll(/<tool>get_capabilities<\/tool>\s*<q>(\{[\s\S]*?\})<\/q>/g)) {
    const sections: string[] = [
      '📅 *Calendar* — add/move/cancel events, recurring with UNTIL/EXDATE, conflict-aware scheduling, list upcoming.',
      '✅ *Tasks* — add/update/complete, recurring rules, assignees, bulk reschedule/cancel.',
      '⏰ *Reminders* — one-off or recurring ("every Sunday 6 PM"), snooze from notifications.',
      '🎯 *Focus / time tracking* — start/stop focus blocks, "how much time on X this week".',
      '👨‍👩‍👧 *Family* — store members + birthdays, send messages, broadcast, family polls.',
      '🧠 *Memory* — long-term facts, preferences, recent entities, "forget about X".',
      '💬 *Conversation* — multi-turn context, follow-up resolution, language switching.',
      '🖼️ *Vision & docs* — read receipts, business cards, flyers, contracts; summarise PDFs.',
      '🔗 *Web* — search the web, fetch a URL, summarise / extract tasks.',
      '✍️ *Writing* — compose / draft / send email, rewrite for tone, translate to any language.',
      '🛒 *Modules* — notes, shopping list, contacts, contracts, habits, wellbeing, goals, projects, trips, expenses, budget.',
      '⚙️ *Settings* — morning digest time, quiet hours, per-feature nudges, locale.',
    ];
    out.push({
      tool: 'get_capabilities', ok: true,
      message: ['Here\'s what I can do:', ...sections].join('\n'),
    });
  }

  // ---------- daily_recap ("what did I do today / yesterday / this week") ----------
  for (const m of text.matchAll(/<tool>daily_recap<\/tool>\s*<recap>(\{[\s\S]*?\})<\/recap>/g)) {
    const data = safeJSON(m[1]) || {};
    const period = String(data.period || 'today');
    try {
      const now = new Date();
      let from: Date; let to: Date; let label: string;
      if (period === 'yesterday') {
        const y = new Date(now); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0);
        const end = new Date(y); end.setHours(23, 59, 59, 999);
        from = y; to = end; label = 'yesterday';
      } else if (period === 'this_week' || period === 'last_7_days') {
        const start = new Date(now.getTime() - 7 * 86400000);
        from = start; to = now; label = 'the last 7 days';
      } else {
        const today = new Date(now); today.setHours(0, 0, 0, 0);
        from = today; to = now; label = 'today';
      }
      const fromIso = from.toISOString(); const toIso = to.toISOString();
      // Parallel fan-out: completed tasks, attended events, habit logs,
      // bot mutations from the undo log. All scoped to the same window.
      const [tasksRes, eventsRes, habitsRes, focusRes, undoRes] = await Promise.all([
        supabase.from('tasks')
          .select('title, completed_at, priority')
          .eq('user_id', userId).eq('completed', true)
          .gte('completed_at', fromIso).lte('completed_at', toIso)
          .order('completed_at', { ascending: false }).limit(30),
        supabase.from('events')
          .select('title, start_time, location')
          .eq('user_id', userId)
          .gte('end_time', fromIso).lte('start_time', toIso)
          .order('start_time').limit(30),
        supabase.from('habit_logs')
          .select('log_date, completed_count, habits(name)')
          .eq('user_id', userId)
          .gte('log_date', fromIso.slice(0, 10)).lte('log_date', toIso.slice(0, 10))
          .order('log_date', { ascending: false }).limit(30),
        supabase.from('focus_sessions')
          .select('label, duration_minutes, tasks(title)')
          .eq('user_id', userId).not('ended_at', 'is', null)
          .gte('started_at', fromIso).lte('started_at', toIso)
          .limit(30),
        supabase.from('dori_undo_log')
          .select('label, op, entity_type, created_at')
          .eq('user_id', userId)
          .gte('created_at', fromIso).lte('created_at', toIso)
          .order('created_at', { ascending: false }).limit(20),
      ]);
      const tasks = (tasksRes.data || []) as any[];
      const events = (eventsRes.data || []) as any[];
      const habits = (habitsRes.data || []) as any[];
      const sessions = (focusRes.data || []) as any[];
      const undos = (undoRes.data || []) as any[];
      const tz = opts?.timezone;
      const lines: string[] = [`🗓️ Recap — ${label}`];
      if (tasks.length > 0) {
        lines.push(`\n✅ Completed ${tasks.length} task${tasks.length === 1 ? '' : 's'}:`);
        for (const t of tasks.slice(0, 8)) lines.push(`  • ${t.title}`);
        if (tasks.length > 8) lines.push(`  … +${tasks.length - 8} more`);
      }
      if (events.length > 0) {
        lines.push(`\n📅 ${events.length} event${events.length === 1 ? '' : 's'}:`);
        for (const e of events.slice(0, 8)) {
          const when = new Date(e.start_time).toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
          lines.push(`  • ${when} ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
        }
      }
      if (habits.length > 0) {
        const counts: Record<string, number> = {};
        for (const h of habits) {
          const name = h.habits?.name || 'habit';
          counts[name] = (counts[name] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ''}`);
        lines.push(`\n🌱 Habits: ${top.join(', ')}`);
      }
      if (sessions.length > 0) {
        const totalMin = sessions.reduce((n: number, s: any) => n + (s.duration_minutes || 0), 0);
        lines.push(`\n🎯 Focus: ${Math.floor(totalMin / 60)}h ${totalMin % 60}m across ${sessions.length} session${sessions.length === 1 ? '' : 's'}`);
      }
      if (undos.length > 0) {
        lines.push(`\n🤖 Bot did: ${undos.slice(0, 5).map((u: any) => u.label || `${u.op} ${u.entity_type}`).join('; ')}`);
      }
      if (lines.length === 1) lines.push('(nothing recorded yet — go make some progress)');
      out.push({ tool: 'daily_recap', ok: true, message: lines.join('\n') });
    } catch (e) {
      out.push({ tool: 'daily_recap', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- pick_random (decide-for-me on tasks / notes / contacts / habits) ----------
  for (const m of text.matchAll(/<tool>pick_random<\/tool>\s*<pick>(\{[\s\S]*?\})<\/pick>/g)) {
    const data = safeJSON(m[1]); if (!data?.kind) {
      out.push({ tool: 'pick_random', ok: false, message: 'kind is required.' });
      continue;
    }
    try {
      const tableMap: Record<string, { table: string; select: string; defaults: Record<string, any> }> = {
        task: { table: 'tasks', select: 'id, title, priority, due_date', defaults: { completed: false, trashed: false } },
        note: { table: 'notes', select: 'id, title, content', defaults: { trashed: false } },
        contact: { table: 'user_contacts', select: 'id, name, email, phone', defaults: {} },
        habit: { table: 'habits', select: 'id, name, frequency', defaults: { is_active: true } },
      };
      const spec = tableMap[String(data.kind)];
      if (!spec) {
        out.push({ tool: 'pick_random', ok: false, message: `Unknown kind "${data.kind}". Use task/note/contact/habit.` });
        continue;
      }
      let q = supabase.from(spec.table).select(spec.select).eq('user_id', userId);
      for (const [k, v] of Object.entries(spec.defaults)) q = q.eq(k, v);
      if (data.filters && typeof data.filters === 'object') {
        for (const [k, v] of Object.entries(data.filters as Record<string, unknown>)) {
          // Defensive: only allow primitives so the AI can't smuggle exotic
          // PostgREST operators in through nested objects.
          if (['string', 'number', 'boolean'].includes(typeof v)) q = q.eq(k, v as any);
        }
      }
      const { data: rows } = await q.limit(200);
      const candidates = rows || [];
      if (candidates.length === 0) {
        out.push({ tool: 'pick_random', ok: true, message: `🤷 Nothing matches — your ${data.kind} list is empty here.` });
        continue;
      }
      const choice = candidates[Math.floor(Math.random() * candidates.length)] as any;
      const labelMap: Record<string, string> = {
        task: choice.title, note: choice.title, contact: choice.name, habit: choice.name,
      };
      out.push({
        tool: 'pick_random', ok: true,
        message: `🎲 Picked: ${labelMap[String(data.kind)] || '(unnamed)'}`,
        entityId: choice.id,
      });
    } catch (e) {
      out.push({ tool: 'pick_random', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- log_symptom (multi-day symptom thread, separate from log_wellbeing) ----------
  for (const m of text.matchAll(/<tool>log_symptom<\/tool>\s*<symptom>(\{[\s\S]*?\})<\/symptom>/g)) {
    const data = safeJSON(m[1]); if (!data?.symptom) {
      out.push({ tool: 'log_symptom', ok: false, message: 'symptom is required.' });
      continue;
    }
    try {
      const symptom = String(data.symptom).toLowerCase().trim().slice(0, 60);
      // Query mode: report streak + recent severity.
      if (data.query) {
        const { data: rows } = await supabase.from('symptom_logs')
          .select('log_date, severity, notes')
          .eq('user_id', userId).eq('symptom', symptom)
          .order('log_date', { ascending: false }).limit(30);
        const logs = (rows || []) as any[];
        if (logs.length === 0) {
          out.push({ tool: 'log_symptom', ok: true, message: `No "${symptom}" logged yet.` });
          continue;
        }
        // Streak: consecutive days ending today (or most recent log).
        let streak = 1;
        for (let i = 1; i < logs.length; i++) {
          const prev = new Date(logs[i - 1].log_date);
          const cur = new Date(logs[i].log_date);
          const diff = Math.round((prev.getTime() - cur.getTime()) / 86400000);
          if (diff === 1) streak++; else break;
        }
        const avgSev = logs.filter((l) => typeof l.severity === 'number')
          .slice(0, 7).reduce((a, b) => a + (b.severity || 0), 0)
          / Math.max(1, logs.filter((l) => typeof l.severity === 'number').slice(0, 7).length);
        const sevTxt = isFinite(avgSev) && avgSev > 0 ? `, avg severity ${avgSev.toFixed(1)}/10 over last 7 days` : '';
        out.push({
          tool: 'log_symptom', ok: true,
          message: `🩺 "${symptom}" — day ${streak} (most recent log ${logs[0].log_date})${sevTxt}.`,
        });
        continue;
      }
      const sev = typeof data.severity === 'number' ? Math.max(1, Math.min(10, Math.round(data.severity))) : null;
      const today = (() => {
        if (data.date) {
          const d = new Date(data.date);
          if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        return new Date().toISOString().slice(0, 10);
      })();
      const { error } = await supabase.from('symptom_logs').upsert({
        user_id: userId, symptom, severity: sev,
        notes: data.notes || null, log_date: today,
      }, { onConflict: 'user_id,symptom,log_date' });
      if (error) throw error;
      // Compute streak so we can echo "day 3" in the reply.
      const { data: tail } = await supabase.from('symptom_logs')
        .select('log_date').eq('user_id', userId).eq('symptom', symptom)
        .order('log_date', { ascending: false }).limit(30);
      let streak = 1;
      const t = (tail || []) as any[];
      for (let i = 1; i < t.length; i++) {
        const prev = new Date(t[i - 1].log_date);
        const cur = new Date(t[i].log_date);
        const diff = Math.round((prev.getTime() - cur.getTime()) / 86400000);
        if (diff === 1) streak++; else break;
      }
      out.push({
        tool: 'log_symptom', ok: true,
        message: `🩺 Logged "${symptom}"${sev ? ` (${sev}/10)` : ''} — day ${streak}.`,
      });
    } catch (e) {
      out.push({ tool: 'log_symptom', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- manage_anniversary (anniversary_date on family_members) ----------
  for (const m of text.matchAll(/<tool>manage_anniversary<\/tool>\s*<action>(\w+)<\/action>\s*<anniversary>(\{[\s\S]*?\})<\/anniversary>/g)) {
    const action = m[1];
    const data = safeJSON(m[2]); if (!data?.memberQuery) {
      out.push({ tool: 'manage_anniversary', ok: false, message: 'memberQuery is required.' });
      continue;
    }
    try {
      const { data: rows } = await supabase.from('family_members')
        .select('id, name, anniversary_date')
        .eq('user_id', userId).eq('is_active', true)
        .ilike('name', `%${data.memberQuery}%`).limit(1);
      const member = rows?.[0];
      if (!member) {
        out.push({ tool: 'manage_anniversary', ok: false, message: `No family member matches "${data.memberQuery}".` });
        continue;
      }
      if (action === 'add') {
        const dt = isoOrNull(data.anniversaryDate);
        if (!dt) { out.push({ tool: 'manage_anniversary', ok: false, message: 'Valid anniversaryDate required.' }); continue; }
        await supabase.from('family_members')
          .update({ anniversary_date: new Date(dt).toISOString().slice(0, 10) })
          .eq('id', member.id);
        out.push({
          tool: 'manage_anniversary', ok: true,
          message: `💍 ${data.label ? data.label + ' ' : ''}anniversary saved for ${member.name}: ${new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}.`,
        });
      } else if (action === 'remove') {
        await supabase.from('family_members').update({ anniversary_date: null }).eq('id', member.id);
        out.push({ tool: 'manage_anniversary', ok: true, message: `Removed anniversary for ${member.name}.` });
      } else {
        out.push({ tool: 'manage_anniversary', ok: false, message: `Unknown action "${action}". Use add/remove.` });
      }
    } catch (e) {
      out.push({ tool: 'manage_anniversary', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- manage_project (full handler — only the prompt entry existed before) ----------
  for (const m of text.matchAll(/<tool>manage_project<\/tool>\s*<action>(\w+)<\/action>\s*<project>(\{[\s\S]*?\})<\/project>/g)) {
    const action = m[1];
    const data = safeJSON(m[2]) || {};
    try {
      if (action === 'create') {
        if (!data.name) { out.push({ tool: 'manage_project', ok: false, message: 'name is required.' }); continue; }
        const { data: p, error } = await supabase.from('projects').insert({
          user_id: userId,
          name: String(data.name).slice(0, 120),
          description: data.description || null,
          color: data.color || '#3b82f6',
        }).select('id, name').single();
        if (error) throw error;
        out.push({ tool: 'manage_project', ok: true, message: `📁 Created project: ${p.name}`, entityId: p.id });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('projects')
          .select('id, name, description, color, is_archived')
          .eq('user_id', userId).eq('is_archived', false)
          .order('updated_at', { ascending: false }).limit(20);
        if (!rows || rows.length === 0) {
          out.push({ tool: 'manage_project', ok: true, message: '📭 No active projects.' });
          continue;
        }
        out.push({
          tool: 'manage_project', ok: true,
          message: `📁 Projects:\n${rows.map((p: any) => `  • ${p.name}${p.description ? ` — ${p.description.slice(0, 60)}` : ''}`).join('\n')}`,
        });
      } else if (action === 'get_status') {
        if (!data.query) { out.push({ tool: 'manage_project', ok: false, message: 'query is required.' }); continue; }
        const { data: rows } = await supabase.from('projects')
          .select('id, name, description')
          .eq('user_id', userId).ilike('name', `%${data.query}%`).limit(1);
        const project = rows?.[0];
        if (!project) {
          out.push({ tool: 'manage_project', ok: false, message: `No project matches "${data.query}".` });
          continue;
        }
        // Fan out: open tasks, recently-completed tasks, future events
        // (workspace_id link on events is the only event ↔ project tie
        // we have today, so this is best-effort).
        const [openRes, doneRes] = await Promise.all([
          supabase.from('tasks')
            .select('id, title, priority, due_date')
            .eq('user_id', userId).eq('project_id', project.id)
            .eq('completed', false).eq('trashed', false)
            .order('due_date', { ascending: true, nullsFirst: false }).limit(10),
          supabase.from('tasks')
            .select('id, title, completed_at')
            .eq('user_id', userId).eq('project_id', project.id)
            .eq('completed', true)
            .order('completed_at', { ascending: false }).limit(5),
        ]);
        const open = (openRes.data || []) as any[];
        const done = (doneRes.data || []) as any[];
        const lines: string[] = [`📁 ${project.name}`];
        if (project.description) lines.push(project.description);
        lines.push(`\n${open.length} open / ${done.length} recently done`);
        if (open.length > 0) {
          lines.push(`\nOpen:`);
          for (const t of open) {
            const due = t.due_date ? ` (due ${new Date(t.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})` : '';
            const pr = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '⚪️' : '🟡';
            lines.push(`  ${pr} ${t.title}${due}`);
          }
        }
        if (done.length > 0) {
          lines.push(`\nRecently done:`);
          for (const t of done) lines.push(`  ✅ ${t.title}`);
        }
        out.push({ tool: 'manage_project', ok: true, message: lines.join('\n'), entityId: project.id });
      } else if (action === 'update' || action === 'delete') {
        if (!data.query) { out.push({ tool: 'manage_project', ok: false, message: 'query is required.' }); continue; }
        const { data: rows } = await supabase.from('projects')
          .select('id, name').eq('user_id', userId).ilike('name', `%${data.query}%`).limit(1);
        const project = rows?.[0];
        if (!project) {
          out.push({ tool: 'manage_project', ok: false, message: `No project matches "${data.query}".` });
          continue;
        }
        if (action === 'delete') {
          await supabase.from('projects').update({ is_archived: true }).eq('id', project.id);
          out.push({ tool: 'manage_project', ok: true, message: `🗄️ Archived project: ${project.name}` });
        } else {
          const upd: any = {};
          if (data.name) upd.name = String(data.name).slice(0, 120);
          if (data.description !== undefined) upd.description = data.description;
          if (data.color) upd.color = data.color;
          if (Object.keys(upd).length === 0) { out.push({ tool: 'manage_project', ok: false, message: 'No fields to update.' }); continue; }
          await supabase.from('projects').update(upd).eq('id', project.id);
          out.push({ tool: 'manage_project', ok: true, message: `✏️ Updated project: ${upd.name || project.name}` });
        }
      } else {
        out.push({ tool: 'manage_project', ok: false, message: `Unknown action "${action}". Use create/list/update/delete/get_status.` });
      }
    } catch (e) {
      out.push({ tool: 'manage_project', ok: false, message: `Failed: ${(e as Error).message}` });
    }
  }

  // ---------- recent_actions ----------
  for (const _m of text.matchAll(/<tool>recent_actions<\/tool>\s*<query>(\{[\s\S]*?\})<\/query>/g)) {
    try {
      // Prefer the rich `label` column when present (some deployments). Fall
      // back to `action`/`payload.label` when it isn't.
      let rows: any[] | null = null;
      const labelTry = await supabase.from('dori_undo_log')
        .select('label, created_at').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(5);
      if (!labelTry.error) rows = labelTry.data;
      else {
        const { data: alt } = await supabase.from('dori_undo_log')
          .select('action, payload, created_at').eq('user_id', userId)
          .order('created_at', { ascending: false }).limit(5);
        rows = (alt || []).map((r: any) => ({
          label: r?.payload?.label || r?.action || 'action',
          created_at: r.created_at,
        }));
      }
      if (!rows?.length) { out.push({ tool: 'recent_actions', ok: true, message: '📭 No recent actions in the undo window.' }); continue; }
      const lines = (rows as any[]).map((r: any, i: number) => {
        const mins = Math.max(1, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000));
        return `${i + 1}. ${r.label} <i>(${mins}m ago)</i>`;
      });
      out.push({ tool: 'recent_actions', ok: true, message: `<b>🕓 Recent actions</b>\n${lines.join('\n')}` });
    } catch (e) { out.push({ tool: 'recent_actions', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ============================================================================
  // ROUND 4 — gap-closure tools (tasks richness, email power, life domains)
  // ============================================================================

  // ---------- task_filter (status='blocked', tags, priority) ----------
  for (const m of text.matchAll(/<tool>task_filter<\/tool>\s*<filter>(\{[\s\S]*?\})<\/filter>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      let q = supabase.from('tasks').select('id,title,status,priority,due_date,tags').eq('user_id', userId).eq('trashed', false);
      if (data.status) q = q.eq('status', String(data.status));
      if (data.priority) q = q.eq('priority', String(data.priority));
      if (data.tag) q = q.contains('tags', [String(data.tag)]);
      const { data: rows } = await q.limit(20);
      if (!rows?.length) { out.push({ tool: 'task_filter', ok: true, message: '📭 No matching tasks.' }); continue; }
      const lines = rows.map((r: any, i: number) => `${i+1}. ${r.title} <i>(${r.priority}${r.tags?.length?` · #${r.tags.join(' #')}`:''})</i>`);
      out.push({ tool: 'task_filter', ok: true, message: `<b>📋 Tasks</b>\n${lines.join('\n')}` });
    } catch (e) { out.push({ tool: 'task_filter', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_tag (add/remove tag on a task by title fragment) ----------
  for (const m of text.matchAll(/<tool>task_tag<\/tool>\s*<action>(\w+)<\/action>\s*<tag>(\{[\s\S]*?\})<\/tag>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    if (!data.query || !data.tag) { out.push({ tool: 'task_tag', ok: false, message: 'query and tag required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('tasks').select('id,title,tags').eq('user_id', userId).ilike('title', `%${data.query}%`).limit(2);
      if (!rows?.length) { out.push({ tool: 'task_tag', ok: false, message: `🔍 No task matches "${data.query}".` }); continue; }
      if (rows.length > 1) { out.push({ tool: 'task_tag', ok: false, message: `🤔 Multiple tasks match. Be more specific.` }); continue; }
      const t = rows[0]; const cur = new Set<string>(t.tags || []);
      if (action === 'add') cur.add(String(data.tag).toLowerCase());
      else cur.delete(String(data.tag).toLowerCase());
      await supabase.from('tasks').update({ tags: Array.from(cur) }).eq('id', t.id);
      out.push({ tool: 'task_tag', ok: true, message: `🏷️ ${action === 'add' ? 'Tagged' : 'Untagged'} "${t.title}" → #${data.tag}` });
    } catch (e) { out.push({ tool: 'task_tag', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_estimate ----------
  for (const m of text.matchAll(/<tool>task_estimate<\/tool>\s*<estimate>(\{[\s\S]*?\})<\/estimate>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.query || data.minutes === undefined) { out.push({ tool: 'task_estimate', ok: false, message: 'query and minutes required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('tasks').select('id,title').eq('user_id', userId).ilike('title', `%${data.query}%`).limit(2);
      if (!rows?.length || rows.length > 1) { out.push({ tool: 'task_estimate', ok: false, message: rows?.length ? '🤔 Multiple match.' : `🔍 No task matches.` }); continue; }
      await supabase.from('tasks').update({ estimate_minutes: Number(data.minutes) }).eq('id', rows[0].id);
      out.push({ tool: 'task_estimate', ok: true, message: `⏱ Estimated "${rows[0].title}" at ${data.minutes} min.` });
    } catch (e) { out.push({ tool: 'task_estimate', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_complete_with_note ----------
  for (const m of text.matchAll(/<tool>task_complete_note<\/tool>\s*<complete_note>(\{[\s\S]*?\})<\/complete_note>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.query) { out.push({ tool: 'task_complete_note', ok: false, message: 'query required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('tasks').select('id,title').eq('user_id', userId).eq('completed', false).ilike('title', `%${data.query}%`).limit(2);
      if (!rows?.length || rows.length > 1) { out.push({ tool: 'task_complete_note', ok: false, message: rows?.length ? '🤔 Multiple match.' : `🔍 No task matches.` }); continue; }
      await supabase.from('tasks').update({ completed: true, status: 'done', completion_note: data.note || null }).eq('id', rows[0].id);
      out.push({ tool: 'task_complete_note', ok: true, message: `✅ Completed "${rows[0].title}"${data.note ? ` — note saved` : ''}.` });
    } catch (e) { out.push({ tool: 'task_complete_note', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_duplicate ----------
  for (const m of text.matchAll(/<tool>task_duplicate<\/tool>\s*<task>(\{[\s\S]*?\})<\/task>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.query) { out.push({ tool: 'task_duplicate', ok: false, message: 'query required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('tasks').select('*').eq('user_id', userId).ilike('title', `%${data.query}%`).limit(2);
      if (!rows?.length || rows.length > 1) { out.push({ tool: 'task_duplicate', ok: false, message: rows?.length ? '🤔 Multiple match.' : `🔍 No task matches.` }); continue; }
      const src = rows[0];
      const { id, created_at, updated_at, ...copy } = src;
      copy.title = `${src.title} (copy)`; copy.completed = false; copy.status = 'backlog'; copy.completion_note = null;
      const { data: ins } = await supabase.from('tasks').insert(copy).select('id').single();
      const undoId = await undoCreate('tasks', ins.id, `duplicated task "${copy.title}"`, 'task');
      out.push({ tool: 'task_duplicate', ok: true, message: `📑 Duplicated → "${copy.title}"`, undoId, entityId: ins.id });
    } catch (e) { out.push({ tool: 'task_duplicate', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_subtask (add child task under a parent) ----------
  for (const m of text.matchAll(/<tool>task_subtask<\/tool>\s*<subtask>(\{[\s\S]*?\})<\/subtask>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.parent_query || !data.title) { out.push({ tool: 'task_subtask', ok: false, message: 'parent_query and title required.' }); continue; }
    try {
      const { data: rows } = await supabase.from('tasks').select('id,title,category').eq('user_id', userId).ilike('title', `%${data.parent_query}%`).limit(2);
      if (!rows?.length || rows.length > 1) { out.push({ tool: 'task_subtask', ok: false, message: rows?.length ? '🤔 Multiple parents match.' : `🔍 No parent task matches.` }); continue; }
      const parent = rows[0];
      const { data: ins } = await supabase.from('tasks').insert({
        user_id: userId, title: data.title, parent_id: parent.id,
        category: parent.category, priority: data.priority || 'medium', status: 'backlog',
      }).select('id').single();
      const undoId = await undoCreate('tasks', ins.id, `added subtask "${data.title}"`, 'task');
      out.push({ tool: 'task_subtask', ok: true, message: `➕ Added subtask under "${parent.title}": ${data.title}`, undoId, entityId: ins.id });
    } catch (e) { out.push({ tool: 'task_subtask', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- task_assign (set main_responsible_id by name) ----------
  for (const m of text.matchAll(/<tool>task_assign<\/tool>\s*<assign>(\{[\s\S]*?\})<\/assign>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.task_query || !data.assignee) { out.push({ tool: 'task_assign', ok: false, message: 'task_query and assignee required.' }); continue; }
    try {
      const { data: tasks } = await supabase.from('tasks').select('id,title').eq('user_id', userId).ilike('title', `%${data.task_query}%`).limit(2);
      if (!tasks?.length || tasks.length > 1) { out.push({ tool: 'task_assign', ok: false, message: tasks?.length ? '🤔 Multiple tasks match.' : `🔍 No task matches.` }); continue; }
      const { data: profs } = await supabase.from('profiles').select('id,display_name,email').or(`display_name.ilike.%${data.assignee}%,email.ilike.%${data.assignee}%`).limit(2);
      if (!profs?.length || profs.length > 1) { out.push({ tool: 'task_assign', ok: false, message: profs?.length ? '🤔 Multiple people match.' : `🔍 No person matches "${data.assignee}".` }); continue; }
      await supabase.from('tasks').update({ main_responsible_id: profs[0].id }).eq('id', tasks[0].id);
      out.push({ tool: 'task_assign', ok: true, message: `👤 Assigned "${tasks[0].title}" to ${profs[0].display_name || profs[0].email}.` });
    } catch (e) { out.push({ tool: 'task_assign', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- email_action (summarize/star/forward/unsubscribe/snooze/translate) ----------
  for (const m of text.matchAll(/<tool>email_action<\/tool>\s*<action>(\w+)<\/action>\s*<email>(\{[\s\S]*?\})<\/email>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      const r = await invokeInternal('email-actions', userId, { action, ...data });
      if (!r.ok) { out.push({ tool: 'email_action', ok: false, message: `📧 ${action} failed: ${r.error}` }); continue; }
      out.push({ tool: 'email_action', ok: true, message: r.body?.message || `📧 ${action} done.` });
    } catch (e) { out.push({ tool: 'email_action', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- summarize_emails ----------
  for (const m of text.matchAll(/<tool>summarize_emails<\/tool>\s*<summary>(\{[\s\S]*?\})<\/summary>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      const limit = Math.min(20, Number(data.limit) || 10);
      const { data: emails } = await supabase.from('emails').select('subject,from_email,snippet,received_at').eq('user_id', userId).eq('is_read', false).order('received_at', { ascending: false }).limit(limit);
      if (!emails?.length) { out.push({ tool: 'summarize_emails', ok: true, message: '📭 No unread emails.' }); continue; }
      const apiKey = Deno.env.get('LOVABLE_API_KEY');
      if (!apiKey) { out.push({ tool: 'summarize_emails', ok: false, message: 'AI key missing.' }); continue; }
      const list = emails.map((e: any, i: number) => `${i+1}. From ${e.from_email} — "${e.subject}": ${(e.snippet || '').slice(0, 200)}`).join('\n');
      const prompt = `Summarize these ${emails.length} unread emails into a 3-5 bullet briefing in the user's language. Group by topic. Highlight anything urgent.\n\n${list}`;
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages: [{ role: 'user', content: prompt }] }),
      }).then(r => r.json()).catch(() => null);
      const summary = aiResp?.choices?.[0]?.message?.content || 'Summary unavailable.';
      out.push({ tool: 'summarize_emails', ok: true, message: `📧 <b>Inbox briefing (${emails.length})</b>\n${summary}` });
    } catch (e) { out.push({ tool: 'summarize_emails', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- period_log ----------
  for (const m of text.matchAll(/<tool>period_log<\/tool>\s*<period>(\{[\s\S]*?\})<\/period>/g)) {
    const data = safeJSON(m[1]) || {};
    const start = data.start_date || new Date().toISOString().slice(0, 10);
    try {
      const { data: row } = await supabase.from('period_logs').insert({
        user_id: userId, start_date: start, end_date: data.end_date || null,
        flow: data.flow || null, symptoms: data.symptoms || null, notes: data.notes || null,
      }).select('id').single();
      const undoId = await undoCreate('period_logs', row.id, `logged period (${start})`, 'period');
      out.push({ tool: 'period_log', ok: true, message: `🩸 Logged period starting ${start}.`, undoId });
    } catch (e) { out.push({ tool: 'period_log', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- fasting_log ----------
  for (const m of text.matchAll(/<tool>fasting_log<\/tool>\s*<fasting>(\{[\s\S]*?\})<\/fasting>/g)) {
    const data = safeJSON(m[1]) || {};
    const date = data.fast_date || new Date().toISOString().slice(0, 10);
    try {
      const { data: row } = await supabase.from('fasting_logs').upsert({
        user_id: userId, fast_date: date, fast_type: data.fast_type || 'ramadan',
        completed: data.completed !== false, notes: data.notes || null,
      }, { onConflict: 'user_id,fast_date,fast_type' }).select('id').single();
      out.push({ tool: 'fasting_log', ok: true, message: `🌙 Logged fast on ${date}.`, entityId: row.id });
    } catch (e) { out.push({ tool: 'fasting_log', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- pantry_manage ----------
  for (const m of text.matchAll(/<tool>pantry<\/tool>\s*<action>(\w+)<\/action>\s*<pantry>(\{[\s\S]*?\})<\/pantry>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      if (action === 'add') {
        if (!data.item) { out.push({ tool: 'pantry', ok: false, message: 'item required.' }); continue; }
        const { data: row } = await supabase.from('pantry_items').insert({
          user_id: userId, item: data.item, quantity: data.quantity || null,
          unit: data.unit || null, category: data.category || null, expires_on: data.expires_on || null,
        }).select('id').single();
        const undoId = await undoCreate('pantry_items', row.id, `added "${data.item}" to pantry`, 'pantry');
        out.push({ tool: 'pantry', ok: true, message: `🥫 Added ${data.item} to pantry.`, undoId });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('pantry_items').select('item,quantity,unit,expires_on').eq('user_id', userId).order('item').limit(50);
        if (!rows?.length) { out.push({ tool: 'pantry', ok: true, message: '📭 Pantry is empty.' }); continue; }
        const lines = rows.map((r: any, i: number) => `${i+1}. ${r.item}${r.quantity ? ` (${r.quantity}${r.unit||''})` : ''}${r.expires_on ? ` — exp ${r.expires_on}` : ''}`);
        out.push({ tool: 'pantry', ok: true, message: `<b>🥫 Pantry</b>\n${lines.join('\n')}` });
      } else if (action === 'remove') {
        if (!data.query) { out.push({ tool: 'pantry', ok: false, message: 'query required.' }); continue; }
        const { data: rows } = await supabase.from('pantry_items').select('id,item').eq('user_id', userId).ilike('item', `%${data.query}%`).limit(2);
        if (!rows?.length || rows.length > 1) { out.push({ tool: 'pantry', ok: false, message: rows?.length ? '🤔 Multiple match.' : `🔍 No pantry item matches.` }); continue; }
        await supabase.from('pantry_items').delete().eq('id', rows[0].id);
        out.push({ tool: 'pantry', ok: true, message: `🗑️ Removed ${rows[0].item} from pantry.` });
      }
    } catch (e) { out.push({ tool: 'pantry', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- flight_track ----------
  for (const m of text.matchAll(/<tool>flight_track<\/tool>\s*<flight>(\{[\s\S]*?\})<\/flight>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.flight_number || !data.depart_at) { out.push({ tool: 'flight_track', ok: false, message: 'flight_number and depart_at required.' }); continue; }
    try {
      const departIso = new Date(data.depart_at).toISOString();
      const checkin = new Date(new Date(departIso).getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { data: row } = await supabase.from('flight_tracking').insert({
        user_id: userId, flight_number: data.flight_number, airline: data.airline || null,
        origin: data.origin || null, destination: data.destination || null,
        depart_at: departIso, checkin_reminder_at: checkin,
      }).select('id').single();
      const undoId = await undoCreate('flight_tracking', row.id, `tracked flight ${data.flight_number}`, 'flight');
      out.push({ tool: 'flight_track', ok: true, message: `✈️ Tracking ${data.flight_number} — I'll remind you to check in 24h before.`, undoId });
    } catch (e) { out.push({ tool: 'flight_track', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- presence ----------
  for (const m of text.matchAll(/<tool>presence<\/tool>\s*<presence>(\{[\s\S]*?\})<\/presence>/g)) {
    const data = safeJSON(m[1]) || {};
    try {
      if (data.query === 'who') {
        // Look up presence of household (space members owners)
        const { data: members } = await supabase.from('space_members').select('owner_id, profiles!space_members_owner_id_fkey(display_name)').eq('member_id', userId).eq('status', 'accepted');
        const ids = (members || []).map((r: any) => r.owner_id);
        ids.push(userId);
        const { data: presences } = await supabase.from('presence_status').select('user_id,status,message,expires_at').in('user_id', ids);
        const pmap = new Map((presences || []).map((p: any) => [p.user_id, p]));
        const lines = ids.map((id: string) => {
          const p = pmap.get(id);
          const name = id === userId ? 'You' : ((members || []).find((m: any) => m.owner_id === id)?.profiles?.display_name || 'Member');
          return `• ${name}: ${p?.status || 'unknown'}${p?.message ? ` — ${p.message}` : ''}`;
        });
        out.push({ tool: 'presence', ok: true, message: `<b>🏠 Household</b>\n${lines.join('\n')}` });
      } else {
        await supabase.from('presence_status').upsert({
          user_id: userId, status: data.status || 'home', message: data.message || null,
          expires_at: data.expires_at || null,
        }, { onConflict: 'user_id' });
        out.push({ tool: 'presence', ok: true, message: `📍 Status set: ${data.status}${data.message ? ` (${data.message})` : ''}.` });
      }
    } catch (e) { out.push({ tool: 'presence', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- budget ----------
  for (const m of text.matchAll(/<tool>budget<\/tool>\s*<action>(\w+)<\/action>\s*<budget>(\{[\s\S]*?\})<\/budget>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      if (action === 'set') {
        if (!data.category || data.monthly_limit === undefined) { out.push({ tool: 'budget', ok: false, message: 'category and monthly_limit required.' }); continue; }
        await supabase.from('financial_budgets').upsert({
          user_id: userId, category: String(data.category).toLowerCase(),
          monthly_limit: Number(data.monthly_limit), currency: data.currency || 'EUR',
        }, { onConflict: 'user_id,category' });
        out.push({ tool: 'budget', ok: true, message: `💰 Budget set: ${data.category} = €${Number(data.monthly_limit).toFixed(2)}/mo.` });
      } else if (action === 'check') {
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const { data: budgets } = await supabase.from('financial_budgets').select('category,monthly_limit,currency').eq('user_id', userId);
        if (!budgets?.length) { out.push({ tool: 'budget', ok: true, message: '📭 No budgets set yet.' }); continue; }
        const { data: exps } = await supabase.from('family_expenses').select('amount,description').eq('user_id', userId).gte('expense_date', monthStart.toISOString().slice(0, 10));
        const lines = budgets.map((b: any) => {
          const spent = (exps || []).filter((e: any) => (e.description || '').toLowerCase().includes(b.category)).reduce((s: number, e: any) => s + Number(e.amount), 0);
          const pct = b.monthly_limit > 0 ? Math.round((spent / b.monthly_limit) * 100) : 0;
          const bar = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
          return `${bar} ${b.category}: €${spent.toFixed(2)}/${b.monthly_limit} (${pct}%)`;
        });
        out.push({ tool: 'budget', ok: true, message: `<b>💰 Budgets this month</b>\n${lines.join('\n')}` });
      }
    } catch (e) { out.push({ tool: 'budget', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- meds (quick log+list around personal_medications) ----------
  for (const m of text.matchAll(/<tool>meds<\/tool>\s*<action>(\w+)<\/action>\s*<meds>(\{[\s\S]*?\})<\/meds>/g)) {
    const action = m[1]; const data = safeJSON(m[2]) || {};
    try {
      if (action === 'add') {
        if (!data.name) { out.push({ tool: 'meds', ok: false, message: 'name required.' }); continue; }
        const { data: row } = await supabase.from('personal_medications').insert({
          user_id: userId, name: data.name, dose: data.dose || null,
          frequency: data.frequency || null, schedule: data.schedule || null,
          start_date: data.start_date || null, prescriber: data.prescriber || null, reason: data.reason || null,
        }).select('id').single();
        const undoId = await undoCreate('personal_medications', row.id, `added med "${data.name}"`, 'medication');
        out.push({ tool: 'meds', ok: true, message: `💊 Added med: ${data.name}${data.dose ? ` (${data.dose})` : ''}.`, undoId });
      } else if (action === 'list') {
        const { data: rows } = await supabase.from('personal_medications').select('name,dose,frequency,refill_date').eq('user_id', userId).eq('is_active', true);
        if (!rows?.length) { out.push({ tool: 'meds', ok: true, message: '📭 No active medications.' }); continue; }
        const lines = rows.map((r: any, i: number) => `${i+1}. ${r.name}${r.dose ? ` ${r.dose}` : ''}${r.frequency ? ` · ${r.frequency}` : ''}${r.refill_date ? ` · refill ${r.refill_date}` : ''}`);
        out.push({ tool: 'meds', ok: true, message: `<b>💊 Medications</b>\n${lines.join('\n')}` });
      }
    } catch (e) { out.push({ tool: 'meds', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- zakat (simple 2.5% on net wealth) ----------
  for (const m of text.matchAll(/<tool>zakat<\/tool>\s*<zakat>(\{[\s\S]*?\})<\/zakat>/g)) {
    const data = safeJSON(m[1]) || {};
    const net = Number(data.net_wealth || 0);
    const nisab = Number(data.nisab || 5000); // rough threshold default
    if (!Number.isFinite(net) || net <= 0) { out.push({ tool: 'zakat', ok: false, message: 'net_wealth required.' }); continue; }
    const zakat = net >= nisab ? net * 0.025 : 0;
    out.push({ tool: 'zakat', ok: true, message: `🕋 Zakat on €${net.toFixed(2)}: ${zakat > 0 ? `€${zakat.toFixed(2)} (2.5%)` : `none — below nisab (€${nisab})`}.` });
  }

  // ---------- timezone ----------
  for (const m of text.matchAll(/<tool>timezone<\/tool>\s*<timezone>(\{[\s\S]*?\})<\/timezone>/g)) {
    const data = safeJSON(m[1]) || {};
    if (!data.location) { out.push({ tool: 'timezone', ok: false, message: 'location required.' }); continue; }
    try {
      const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.location)}&count=1`).then(r => r.json()).catch(() => null);
      const place = geo?.results?.[0];
      if (!place) { out.push({ tool: 'timezone', ok: false, message: `🌍 Couldn't find "${data.location}".` }); continue; }
      const local = new Date().toLocaleString('en-US', { timeZone: place.timezone, hour: '2-digit', minute: '2-digit', weekday: 'short' });
      out.push({ tool: 'timezone', ok: true, message: `🕐 ${place.name}: ${local} (${place.timezone}).` });
    } catch (e) { out.push({ tool: 'timezone', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  // ---------- currency ----------
  for (const m of text.matchAll(/<tool>currency<\/tool>\s*<currency>(\{[\s\S]*?\})<\/currency>/g)) {
    const data = safeJSON(m[1]) || {};
    const amount = Number(data.amount); const from = String(data.from || 'EUR').toUpperCase(); const to = String(data.to || 'USD').toUpperCase();
    if (!Number.isFinite(amount)) { out.push({ tool: 'currency', ok: false, message: 'amount required.' }); continue; }
    try {
      const r = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`).then(r => r.json()).catch(() => null);
      const converted = r?.rates?.[to];
      if (!converted) { out.push({ tool: 'currency', ok: false, message: `Couldn't convert ${from}→${to}.` }); continue; }
      out.push({ tool: 'currency', ok: true, message: `💱 ${amount} ${from} = ${converted.toFixed(2)} ${to}` });
    } catch (e) { out.push({ tool: 'currency', ok: false, message: `Failed: ${(e as Error).message}` }); }
  }

  return out;
}

// Internal helper for the new chat tools that delegate to other edge
// functions. Mirrors the pattern from dori-execute-action: service-role
// bearer + x-telegram-user-id header so the receiving function picks
// up the right user identity.
async function invokeInternal(
  fn: string,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body?: any; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(50_000),
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok || (json && json.error)) {
      return { ok: false, status: resp.status, body: json, error: json?.error || `HTTP ${resp.status}` };
    }
    return { ok: true, status: resp.status, body: json };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message };
  }
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

// Load recent cross-channel turns + learned preferences for prompt injection.
// Scope-aware: when `workspaceId` is set, pulls memories marked for that
// workspace (so "my boss is X" doesn't surface on a personal turn and vice
// versa). Personal scope pulls user-level memories with workspace_id NULL.
async function loadDoriIntelligence(
  supabase: any,
  userId: string,
  currentChannel: string,
  workspaceId?: string | null,
  // Latest user message — drives semantic recall. Optional so existing
  // callers without a query (digests, recaps) keep working; in that
  // case we just skip the semantic block.
  query?: string | null,
) {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const memoryQuery = supabase
    .from('ai_memory')
    .select('memory_type, category, key, value')
    .eq('user_id', userId)
    .eq('is_active', true)
    // Order by updated_at (always set) not last_referenced_at (NULL until
    // the memory is first recalled) — otherwise just-learned facts would
    // fall off the bottom of the window.
    .order('updated_at', { ascending: false })
    .limit(20);
  const scopedMemoryQuery = workspaceId
    ? memoryQuery.eq('workspace_id', workspaceId)
    : memoryQuery.is('workspace_id', null);

  const [{ data: turns }, { data: prefs }, { data: memories }] = await Promise.all([
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
    scopedMemoryQuery,
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

  let memoriesBlock = '';
  if (memories && memories.length > 0) {
    memoriesBlock += `\n\n## LONG-TERM MEMORY (${workspaceId ? 'workspace' : 'personal'} scope)`;
    memoriesBlock += '\nFacts, preferences, and patterns saved in prior turns. Reference them naturally.';
    for (const m of (memories as any[])) {
      memoriesBlock += `\n- [${m.memory_type}]${m.category ? ` (${m.category})` : ''} ${m.key}: "${m.value}"`;
    }
  }

  // Semantic recall over notes / episodic memories / past tasks / past
  // events / chat turns. Only fires when a query is provided AND it's
  // long enough to be meaningful; otherwise returns empty.
  let semanticBlock = '';
  if (query && query.length >= 8) {
    const hits = await retrieveRelevantMemories(supabase, {
      userId,
      workspaceId: workspaceId ?? null,
      query,
      matchCount: 6,
      minSimilarity: 0.62,
    });
    semanticBlock = hits.length ? '\n\n' + formatMemoriesForPrompt(hits) : '';
  }

  return memoryBlock + prefsBlock + memoriesBlock + semanticBlock;
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
      // Opt-in streaming mode for executeServerSide callers (Telegram). Emits
      // an SSE stream with {type: delta|tool|done} events so the Telegram bot
      // can edit the placeholder message progressively instead of waiting
      // 5–15s for the whole turn to finish.
      streamFinalText = false,
    }: ChatRequest & {
      executeServerSide?: boolean;
      skipApprovalGate?: boolean;
      preformedToolText?: string;
      actionSource?: string;
      actionSourceRef?: string | null;
      streamFinalText?: boolean;
    } = reqBody;

    // Telegram / voice surfaces don't ship the user's task and event lists
    // in the request body the way the web client does. We hydrate from the
    // DB lower in this handler when both are absent, so keep these mutable.
    let tasks: ChatRequest['tasks'] = reqBody.tasks;
    let events: ChatRequest['events'] = reqBody.events;

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
      // Preformed-tool path runs before we've loaded the profile tz, so look
      // it up once here. Cheap — single row by user id.
      let preformedTz: string | undefined;
      try {
        const { data: p } = await supabaseAdminEarly.from('profiles').select('timezone').eq('user_id', userId).maybeSingle();
        preformedTz = p?.timezone || undefined;
      } catch { /* ignore */ }
      const execResults = await executeToolsServerSide(preformedToolText, userId, supabaseAdminEarly, {
        skipApprovalGate,
        source: actionSource,
        sourceRef: actionSourceRef ?? null,
        workspaceId: activeWorkspace?.id ?? null,
        workspaceMembers: activeWorkspace?.members,
        timezone: preformedTz,
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

    // Telegram surfaces (and the voice channel) ship one user turn per
    // request, so a follow-up like "yes" / "jes" / "do that one" arrives
    // here with no prior assistant turn for the model to anchor on. Pull
    // the most recent same-channel turns from the unified log and prepend
    // them as real {role, content} messages so the AI sees what it just
    // asked. Web already passes full history client-side, so skip the
    // hydration there.
    if (
      currentChannel !== 'web'
      && userId !== 'anonymous'
      && Array.isArray(messages)
      && messages.length <= 2
    ) {
      try {
        const { data: priorTurns } = await supabaseAdmin
          .from('dori_conversations')
          .select('role, content, created_at')
          .eq('user_id', userId)
          .eq('channel', currentChannel)
          .order('created_at', { ascending: false })
          .limit(8);
        if (priorTurns && priorTurns.length > 0) {
          // Skip the most-recent user turn if it matches the one already
          // in `messages` (we just logged it on the previous request and
          // this same request re-logs it before we read).
          const currentUserContent = messages[messages.length - 1]?.content?.trim();
          const hydrated: Message[] = [];
          for (const t of priorTurns) {
            const c = String(t.content || '').trim();
            if (!c) continue;
            if (hydrated.length === 0 && t.role === 'user' && c === currentUserContent) continue;
            if (t.role !== 'user' && t.role !== 'assistant') continue;
            hydrated.push({ role: t.role, content: c });
          }
          // priorTurns came back newest-first; reverse for chronological order
          // and prepend so the caller-supplied `messages` (current turn) stays last.
          hydrated.reverse();
          messages.unshift(...hydrated);
        }
      } catch (e) {
        console.warn('[same-channel history hydration] failed', (e as Error).message);
      }
    }

    // Telegram / voice never ship the tasks + events arrays the web client
    // attaches — so when the user asks "show me the next 5 calendar entries"
    // the AI saw zero context, tried manage_event with an empty query and
    // surfaced "Could not find event matching ''". Backfill from the DB
    // (scope-aware) so the same questions answer from context like on web.
    if (currentChannel !== 'web' && userId !== 'anonymous') {
      const wsId = activeWorkspace?.id ?? null;
      const tasksMissing = !Array.isArray(tasks);
      const eventsMissing = !Array.isArray(events);
      if (tasksMissing || eventsMissing) {
        try {
          const scoped = <T extends { eq: any; is: any }>(q: T): T =>
            (wsId ? q.eq('workspace_id', wsId) : q.eq('user_id', userId).is('workspace_id', null));
          const hydrationCalls: Promise<any>[] = [];
          if (tasksMissing) {
            hydrationCalls.push(
              scoped(
                supabaseAdmin.from('tasks')
                  .select('id, title, completed, category, priority, due_date')
                  .eq('completed', false)
                  .eq('trashed', false),
              ).order('due_date', { ascending: true, nullsFirst: false }).limit(40),
            );
          } else {
            hydrationCalls.push(Promise.resolve({ data: null }));
          }
          if (eventsMissing) {
            // "Upcoming" means from now forward — no day-boundary math
            // needed, which keeps the window timezone-independent (the
            // edge runtime is UTC, so setHours(0,0,0,0) would be ~12h
            // off for users in Asia / the Americas).
            const horizonStart = new Date();
            const horizonEnd = new Date(horizonStart.getTime() + 30 * 24 * 60 * 60 * 1000);
            hydrationCalls.push(
              scoped(
                supabaseAdmin.from('events')
                  .select('id, title, start_time, end_time')
                  .gte('start_time', horizonStart.toISOString())
                  .lte('start_time', horizonEnd.toISOString()),
              ).order('start_time').limit(40),
            );
          } else {
            hydrationCalls.push(Promise.resolve({ data: null }));
          }
          const [tRes, eRes] = await Promise.all(hydrationCalls);
          if (tasksMissing && tRes?.data) {
            tasks = (tRes.data as any[]).map((t) => ({
              id: t.id,
              title: t.title,
              completed: !!t.completed,
              category: t.category || 'personal',
              priority: t.priority || 'medium',
              dueDate: t.due_date || undefined,
            }));
          }
          if (eventsMissing && eRes?.data) {
            events = (eRes.data as any[]).map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.start_time,
              endTime: e.end_time,
            }));
          }
        } catch (e) {
          console.warn('[tasks/events hydration] failed', (e as Error).message);
        }
      }
    }

    // The latest user message drives semantic recall (RAG over notes,
    // episodic memories, past tasks/events, chat turns). Without it we
    // only ship structured memory + prefs.
    const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content || '';

    // Load unified cross-channel memory + auto-learned preferences + semantic recall.
    const intelligenceBlock = await loadDoriIntelligence(
      supabaseAdmin,
      userId,
      currentChannel,
      activeWorkspace?.id ?? null,
      lastUserContent,
    );

    // Cross-turn conversation state. If the previous turn left an open
    // intent ("awaiting_plan_approval", "choose_among_candidates"),
    // this surfaces it so the model resolves "do it" / "yes" / "the
    // second one" without re-asking. Sticky specialist also lives here.
    const conversationState = await loadConversationState(
      supabaseAdmin,
      userId,
      currentChannel as Channel,
    );
    const stateBlock = formatStateForPrompt(conversationState);

    // Specialist routing. Cheap regex classifier + sticky-follow-up so
    // a "yes" after a meeting flow stays in the meeting specialist.
    const route = decideRoute(lastUserContent, conversationState?.active_specialist);
    const specialistBlock = route.prompt ? `\n\n${route.prompt}` : '';

    // Fire-and-forget log of the routing decision (debug + offline eval).
    if (route.specialist !== 'general' && userId !== 'anonymous') {
      supabaseAdmin
        .from('dori_intent_routing')
        .insert({
          user_id: userId,
          channel: currentChannel,
          user_message_excerpt: lastUserContent.slice(0, 240),
          classified_specialist: route.specialist,
          confidence: route.confidence,
          used_specialist: route.effective,
          metadata: { matched: route.matched },
        })
        .then(({ error }: any) => {
          if (error) console.warn('[routing log] failed', error.message);
        });
    }

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
      contextMessage += `\nPending tasks:\n${pendingTasks.slice(0, 10).map(t => `- [id:${t.id}] ${t.title} (${t.category}, ${t.priority} priority${t.dueDate ? `, due ${t.dueDate}` : ''})`).join('\n')}`;
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

    // Split for cache-friendliness: `staticGuidance` is identical for every
    // user+turn (pure instruction), so it lives in the stable prefix.
    // `intelligenceBlock` is per-user AND changes with each new message
    // (cross-channel history + learned preferences), so it belongs in the
    // dynamic tail — otherwise every turn misses the prompt cache.
    const staticGuidance = `

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
- "Sarah's birthday next month" / "Tugba's birthday is October 1st" → ALWAYS run all three of these in one response:
    (a) manage_family_member action="create" or "update" with the `birthDate` field so the birthday is stored on the family record (and re-used by proactive reminders next year),
    (b) schedule_event for the birthday itself with `recurrenceRule: "FREQ=YEARLY"`,
    (c) manage_task "Buy gift for <name>" with `dueDate` set to 3 days before the birthday (use `recurrenceRule: "FREQ=YEARLY"` so the prep task repeats too).
  Optionally chain a compose_email or send_family_message draft if the user hints at one.
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

## TOOL: schedule_meeting_bot (send a notetaker into a Zoom/Meet/Teams call)
Use when the user wants the assistant to attend or transcribe a meeting on their behalf. Requires a meeting URL.
Format: <tool>schedule_meeting_bot</tool><meeting>{"meeting_url":"https://meet.google.com/abc-defg-hij","title":"optional","join_at":"optional ISO-8601","record_video":false}</meeting>
After it runs, mention the bot will join + summarise after.

## TOOL: plan_my_week (predictive scheduler)
Use when the user asks to "plan my week", "schedule my work", "block focus time", "organize my time". Pulls in tasks + calendar + energy + slip risk and drafts a week of blocks the user reviews in the planner inbox.
Format: <tool>plan_my_week</tool><plan>{"days":7,"deep_work_hours":[9,12],"constraints":["no meetings before 10","2h on Tuesday for the X review"]}</plan>
days defaults to 7 (max 14). deep_work_hours and constraints are optional.

## TOOL: forget_memory (delete an entity or memory item)
Use when the user says "forget about X", "stop tracking Y", "remove that". Pass either a kg_entity id (deep-forget cascades to every memory item that mentions it) or a single semantic/episodic/ai_memory id.
Format: <tool>forget_memory</tool><target>{"target_kind":"kg_entity|semantic|episodic|ai_memory","target_id":"uuid","deep":false,"reason":"optional"}</target>

## TOOL: generate_packing_list (AI packing list for a trip)
Use when the user asks to "pack for X", "what should I bring to Y", "plan my packing". Requires a trip id (look it up via the trips table first if needed).
Format: <tool>generate_packing_list</tool><packing>{"trip_id":"uuid","replace":false,"extra_context":"climbing trip, expect rain"}</packing>

## TOOL: prep_trip (auto-create the "Pack for X" task + kick off packing list)
Use when the user adds a trip and says "get me ready" / "prep my trip" / "remind me to pack".
Format: <tool>prep_trip</tool><prep>{"trip_id":"uuid","force":false}</prep>

## TOOL: cancel_subscription (draft email + create follow-up task)
Use when the user says "cancel X subscription", "stop paying for Y". Drafts the email, saves it to the contract, and creates a follow-up task with a deadline derived from the renewal date.
Format: <tool>cancel_subscription</tool><cancel>{"contract_id":"uuid","tone":"formal","language":"en"}</cancel>

`;
    // Resolve the user's timezone so every timestamp Dori shows (or feeds
    // into the AI) reflects the user's local clock, not the UTC edge-runtime
    // default. Fall through if the column is missing.
    let userTimezone: string | undefined;
    let userLocale: string | undefined;
    try {
      const { data: p } = await supabaseAdmin.from('profiles').select('timezone, locale').eq('user_id', userId).maybeSingle();
      userTimezone = p?.timezone || undefined;
      userLocale = p?.locale || undefined;
    } catch { /* ignore */ }

    // Locale directive goes right on top of the dynamic tail so the AI
    // sees it consistently. Null/empty = let the model auto-detect from
    // the user's messages.
    const localeBlock = userLocale
      ? `\n\n## LOCALE\nRespond in locale "${userLocale}". If the user writes in a different language, mirror theirs — but default to this for proactive messages, digests, and prose.`
      : '';

    // Live context block — one round-trip snapshot of "what's on this user's
    // plate RIGHT NOW" so the AI never has to ask a follow-up lookup tool.
    let liveContextBlock = '';
    try {
      const ctx = await buildDoriContext(supabaseAdmin, userId, activeWorkspace?.id ?? null, { timezone: userTimezone });
      liveContextBlock = '\n\n' + formatContextForAI(ctx, userProfile?.displayName);
    } catch (e) {
      console.warn('buildDoriContext failed', e);
    }

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

    // Prompt assembled in stable → dynamic order so any downstream prompt-
    // caching (Anthropic cache_control / Gemini context caching / gateway
    // passthrough) can key on the stable prefix and reuse it across turns.
    //   STABLE PREFIX: baseSystemPrompt + personality + staticGuidance
    //   ── cache boundary ──
    //   DYNAMIC TAIL: intelligenceBlock + user/workspace/live context
    //     (intelligenceBlock contains cross-channel history + learned
    //     preferences, both of which change per-turn and would otherwise
    //     break the cache if placed above the boundary).
    const stablePrefix = baseSystemPrompt + '\n\nPersonality: ' + personalityAddition + staticGuidance;
    // Dynamic tail order matters: specialistBlock first because it
    // narrows the model's mindset for this turn; stateBlock right
    // after so any "yes/do it" is resolved against the pending plan
    // before the model wades through context.
    const dynamicTail =
      specialistBlock +
      stateBlock +
      localeBlock +
      intelligenceBlock +
      contextMessage +
      liveContextBlock +
      workspaceBlock;
    const fullSystemPrompt = stablePrefix + dynamicTail;

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
    
    // Native function-calling is opt-in per request via a header so we
    // can roll it out one surface at a time. The legacy XML path stays
    // intact — when tools are NOT sent, the model continues to emit
    // <tool>…</tool> blocks the executor already understands. When
    // tools ARE sent, the model returns a structured `tool_calls`
    // array, which we convert back to legacy XML for execution.
    const useNativeTools = req.headers.get('x-dori-native-tools') === '1';

    async function callAI(msgs: { role: string; content: string | any[] }[], stream: boolean) {
      const payload: any = { model, messages: msgs, stream };
      if (useNativeTools) {
        payload.tools = NATIVE_TOOLS;
        payload.tool_choice = 'auto';
      }
      return fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    // Pull the assistant content + tool_calls out of a non-streaming
    // response and reconcile them into a single text blob the existing
    // tool executor can parse. With tools=undefined, we just take
    // `content`. With tools enabled, we append the converted XML so
    // any prose the model produced still ships to the user, but the
    // executor sees the XML it expects.
    function flattenAssistantMessage(msg: any): string {
      const content: string = msg?.content || '';
      const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : [];
      if (toolCalls.length === 0) return content;
      const xml = toolCallsToLegacyXml(toolCalls);
      return content ? `${content}\n${xml}` : xml;
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

    // ===== SERVER-SIDE STREAMING BRANCH (Telegram with streamFinalText=true) =====
    // Runs the agent loop per-round, streams the AI's prose as deltas (filtering
    // out <tool> blocks so the user never sees XML), runs tools after each round,
    // and closes with a done event that carries the full tool result list.
    if (executeServerSide && streamFinalText) {
      const encoder = new TextEncoder();
      const MAX_AGENT_ROUNDS = 4;
      const conversationMsgs: { role: string; content: string | any[] }[] = [...allMessages];
      const allExecResults: ToolExecResult[] = [];

      const effectiveSource = actionSource || (currentChannel === 'tg_family' ? 'tg_family'
        : currentChannel === 'tg_private' ? 'tg_private'
        : 'web');
      const effectiveSourceRef = actionSourceRef ?? tgChannelRef ?? null;

      // Approximate token counter for logAIUsage. Accumulates completion
      // chars across rounds, and the initial prompt size already counts the
      // system prompt + the full messages array we're about to send.
      const initialPromptChars = fullSystemPrompt.length
        + allMessages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length), 0);
      let totalStreamCompletionChars = 0;

      const sse = new ReadableStream({
        async start(controller) {
          const emit = (obj: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };

          try {
            let finalPromptText = '';
            for (let round = 0; round < MAX_AGENT_ROUNDS; round++) {
              const aiResp = await callAI(conversationMsgs, true);
              if (!aiResp.ok || !aiResp.body) {
                const t = aiResp.body ? await aiResp.text() : `status ${aiResp.status}`;
                console.error(`stream round ${round} AI error:`, aiResp.status, t);
                emit({ type: 'error', status: aiResp.status, detail: t });
                break;
              }

              // Read the SSE stream from the AI gateway chunk-by-chunk. We
              // accumulate `roundText` to pass to the tool executor, but we
              // only emit deltas up to the first `<tool>` tag so the user
              // never sees raw XML mid-reply.
              const reader = aiResp.body.getReader();
              const decoder = new TextDecoder();
              let roundText = '';
              let lineBuffer = '';
              let emittedSafeLength = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                lineBuffer += decoder.decode(value, { stream: true });
                const lines = lineBuffer.split('\n');
                lineBuffer = lines.pop() || '';
                for (const line of lines) {
                  if (!line.startsWith('data: ')) continue;
                  const payload = line.slice(6).trim();
                  if (!payload || payload === '[DONE]') continue;
                  try {
                    const parsed = JSON.parse(payload);
                    const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
                    if (!delta) continue;
                    roundText += delta;
                    // Only relay the portion BEFORE the first <tool> so the
                    // user never sees XML. Once a tool tag starts we stop
                    // relaying; anything after the tool block will be
                    // emitted by the NEXT round (after tool execution).
                    const toolIdx = roundText.search(/<tool>/i);
                    const safeEnd = toolIdx === -1 ? roundText.length : toolIdx;
                    if (safeEnd > emittedSafeLength) {
                      const out = roundText.slice(emittedSafeLength, safeEnd);
                      if (out) emit({ type: 'delta', content: out });
                      emittedSafeLength = safeEnd;
                    }
                  } catch { /* ignore malformed delta line */ }
                }
              }

              // Round done — execute any tools we parsed out of the text.
              // Append (not overwrite) so the final reply covers prose from
              // every round. If we overwrote, the Telegram client — which
              // accumulated deltas across all rounds — would render something
              // different from the `reply` field in the final edit.
              finalPromptText += (finalPromptText ? '\n\n' : '') + roundText;
              totalStreamCompletionChars += roundText.length;
              const roundResults = await executeToolsServerSide(roundText, userId, supabaseAdmin, {
                source: effectiveSource,
                sourceRef: effectiveSourceRef,
                workspaceId: activeWorkspace?.id ?? null,
                workspaceMembers: activeWorkspace?.members,
                timezone: userTimezone,
              });
              allExecResults.push(...roundResults);
              for (const r of roundResults) {
                emit({ type: 'tool', ...r });
              }

              if (roundResults.length === 0) break;  // no tools → we're done

              // Feed the round's output + results back for the next AI call.
              conversationMsgs.push({ role: 'assistant', content: roundText });
              const observation = roundResults.map((r, i) =>
                `[${i + 1}] ${r.tool} → ${r.ok ? 'OK' : 'FAIL'}: ${r.message}`
              ).join('\n');
              conversationMsgs.push({
                role: 'system',
                content: `Tool results from your last turn:\n${observation}\n\nIf the user's request is fully satisfied, reply with a brief natural-language confirmation and DO NOT emit more tools. If more steps are needed, emit the next tool(s).`,
              });
            }

            const cleanText = stripAllToolTags(finalPromptText).trim();
            emit({ type: 'done', reply: cleanText, toolResults: allExecResults });
            // Token accounting: include the full conversation we sent (system
            // prompt + messages) as the prompt cost, and the accumulated
            // completion text across every round as the completion cost.
            const promptTokens = Math.ceil(initialPromptChars / 4);
            const completionTokens = Math.ceil(totalStreamCompletionChars / 4);
            await logAIUsage(supabaseAdmin, userId, 'chat-agent-stream', model,
              promptTokens, completionTokens, promptTokens + completionTokens,
              'success', { personality, streamFinalText: true, agentResultsCount: allExecResults.length });
            logDoriTurn(supabaseAdmin, userId, currentChannel, 'assistant', cleanText, tgChannelRef);
            // Save state + semantic memory for the next turn (best-effort).
            saveConversationState(supabaseAdmin, {
              userId,
              channel: currentChannel as Channel,
              openIntent: null,
              pendingPayload: {},
              recentEntities: [],
              activeSpecialist: route.effective,
            }).catch(() => {});
            if (cleanText && lastUserContent.length >= 12) {
              rememberSemantic(supabaseAdmin, {
                userId,
                workspaceId: activeWorkspace?.id ?? null,
                source: 'chat_turn',
                sourceRef: `chat:${currentChannel}:${Date.now()}`,
                content: `User: ${lastUserContent}\nAssistant: ${cleanText.slice(0, 800)}`,
                metadata: { channel: currentChannel, specialist: route.effective },
                importance: route.specialist === 'general' ? 0.3 : 0.55,
              }).catch(() => {});
            }
          } catch (e) {
            console.error('SSE agent stream failed', e);
            try { emit({ type: 'error', detail: (e as Error).message }); } catch { /* ignore */ }
          } finally {
            controller.close();
          }
        },
      });

      return new Response(sse, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
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
        const roundText: string = flattenAssistantMessage(aiData.choices?.[0]?.message);
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
          timezone: userTimezone,
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

      // Persist conversation-state for the next turn. Track the entities
      // the tools just touched (so "him" / "the meeting" resolves) and
      // remember which specialist handled this turn so a "yes" on the
      // next turn stays in the same mindset. Also kick off async
      // semantic indexing of the user's message + the assistant's reply.
      try {
        const recentEntities: RecentEntity[] = [];
        for (const r of allExecResults.slice(-8)) {
          const id = (r as any).id || (r as any).entityId;
          if (!id) continue;
          recentEntities.push({
            kind: ((r as any).entityKind || (r as any).kind || 'task') as RecentEntity['kind'],
            id,
            label: (r as any).label || (r as any).title,
            ref_at: new Date().toISOString(),
          });
        }
        const proposedPlan = allExecResults.find((r: any) => r.tool === 'propose_plan');
        await saveConversationState(supabaseAdmin, {
          userId,
          channel: currentChannel as Channel,
          openIntent: proposedPlan ? 'awaiting_plan_approval' : null,
          pendingPayload: proposedPlan ? (proposedPlan as any).payload ?? {} : {},
          recentEntities,
          activeSpecialist: route.effective,
        });
      } catch (e) {
        console.warn('[saveConversationState agent] failed', (e as Error).message);
      }
      // Index the user's question + the final reply into semantic
      // memory so future turns can recall this exchange. Best-effort.
      if (lastUserContent.length >= 12) {
        rememberSemantic(supabaseAdmin, {
          userId,
          workspaceId: activeWorkspace?.id ?? null,
          source: 'chat_turn',
          sourceRef: `chat:${currentChannel}:${Date.now()}`,
          content: `User: ${lastUserContent}\nAssistant: ${cleanText.trim().slice(0, 800)}`,
          metadata: { channel: currentChannel, specialist: route.effective },
          importance: route.specialist === 'general' ? 0.3 : 0.55,
        }).catch(() => {});
      }

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
                    workspace_id: activeWorkspace?.id ?? null,
                  }, { onConflict: 'user_id,key,workspace_scope' });
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
            // Save the routing decision as the active specialist + index
            // this exchange into semantic memory. Both are fire-and-forget.
            saveConversationState(supabaseAdmin, {
              userId,
              channel: currentChannel as Channel,
              openIntent: null,
              pendingPayload: {},
              recentEntities: [],
              activeSpecialist: route.effective,
            }).catch(() => {});
            if (cleaned && lastUserContent.length >= 12) {
              rememberSemantic(supabaseAdmin, {
                userId,
                workspaceId: activeWorkspace?.id ?? null,
                source: 'chat_turn',
                sourceRef: `chat:${currentChannel}:${Date.now()}`,
                content: `User: ${lastUserContent}\nAssistant: ${cleaned.slice(0, 800)}`,
                metadata: { channel: currentChannel, specialist: route.effective },
                importance: route.specialist === 'general' ? 0.3 : 0.55,
              }).catch(() => {});
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
