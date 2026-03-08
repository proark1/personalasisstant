import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UserProfile {
  displayName?: string;
  role?: string;
  bio?: string;
  businesses?: string[];
  interests?: string[];
  skills?: string[];
  goals?: string;
  locationCity?: string;
  locationCountry?: string;
  timezone?: string;
  preferredWorkHours?: string;
}

interface TaskItem {
  id: string;
  title: string;
  category: string;
  priority: string;
  dueDate: string | null;
  completed: boolean;
}

interface EventItem {
  title: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  category?: string | null;
}

interface ContactItem {
  name: string;
  company?: string | null;
  role?: string | null;
  nextContactDue?: string | null;
}

interface ContractItem {
  name: string;
  category: string;
  renewalDate?: string | null;
  costAmount?: number | null;
  costFrequency?: string | null;
}

interface ContextData {
  overdueTasks?: TaskItem[];
  todayTasks?: TaskItem[];
  upcomingTasks?: TaskItem[];
  allTasks?: TaskItem[];
  upcomingEvents?: EventItem[];
  contactsDue?: ContactItem[];
  contractsWithRenewals?: ContractItem[];
  totalPendingTasks?: number;
  totalOverdue?: number;
  totalEvents?: number;
  totalContacts?: number;
  totalContracts?: number;
}

interface VoiceAction {
  type: 'create_task' | 'edit_task' | 'complete_task' | 'trash_task' | 'restore_task' | 'reschedule_task';
  taskTitle?: string;
  taskId?: string;
  updates?: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    dueDate?: string;
  };
  newDate?: string;
}

interface LiveSessionRequest {
  action: 'send_audio' | 'send_text';
  personality?: string;
  audio?: string;
  text?: string;
  userProfile?: UserProfile;
  contextData?: ContextData;
  memories?: { type: string; key: string; value: string; category?: string }[];
}

const personalityPrompts: Record<string, string> = {
  balanced: "You are DarAI, a helpful and balanced AI assistant. Be clear, supportive, and efficient.",
  strict: "You are DarAI in strict mode. Be direct, focused on productivity, and push the user to complete their tasks. No fluff, just results.",
  supportive: "You are DarAI in supportive mode. Be empathetic, encouraging, and understanding. Celebrate progress and be patient.",
  creative: "You are DarAI in creative mode. Think outside the box, brainstorm freely, and encourage exploration of new ideas.",
};

// Detect task-related commands in user input
function detectTaskCommand(input: string, allTasks?: TaskItem[]): { command: string | null; details: any } {
  const text = input.toLowerCase().trim();
  
  // Create task patterns
  const createPatterns = [
    /(?:create|add|new|make)\s+(?:a\s+)?(?:new\s+)?task\s*(?:called|named|titled)?\s*[:\-]?\s*["']?(.+?)["']?$/i,
    /(?:erstell|hinzufüg|neu)\s+(?:eine?\s+)?(?:neue?\s+)?(?:aufgabe|task)\s*(?:mit|names?)?\s*[:\-]?\s*["']?(.+?)["']?$/i,
    /(?:remind me to|i need to|i have to|i should|i must)\s+(.+)/i,
    /(?:erinner mich an|ich muss|ich sollte)\s+(.+)/i,
  ];
  
  for (const pattern of createPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return { command: 'create', details: { title: match[1].trim() } };
    }
  }
  
  // Complete/done task patterns
  const completePatterns = [
    /(?:mark|set)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s+(?:as\s+)?(?:done|complete|completed|finished)/i,
    /(?:complete|finish|done with)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?/i,
    /(?:ich habe|ich bin fertig mit|erledigt)\s+(?:die\s+)?(?:aufgabe\s+)?["']?(.+?)["']?/i,
    /["']?(.+?)["']?\s+(?:is\s+)?(?:done|complete|finished|erledigt)/i,
  ];
  
  for (const pattern of completePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const taskTitle = match[1].trim();
      const matchedTask = findMatchingTask(taskTitle, allTasks);
      return { 
        command: 'complete', 
        details: { 
          title: taskTitle,
          taskId: matchedTask?.id 
        } 
      };
    }
  }
  
  // Trash/delete task patterns
  const trashPatterns = [
    /(?:trash|delete|remove|throw away)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?/i,
    /(?:put|move)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s+(?:in|to)\s+(?:the\s+)?trash/i,
    /(?:lösch|entfern|weg mit)\s+(?:die\s+)?(?:aufgabe\s+)?["']?(.+?)["']?/i,
  ];
  
  for (const pattern of trashPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const taskTitle = match[1].trim();
      const matchedTask = findMatchingTask(taskTitle, allTasks);
      return { 
        command: 'trash', 
        details: { 
          title: taskTitle,
          taskId: matchedTask?.id 
        } 
      };
    }
  }
  
  // Reschedule task patterns
  const reschedulePatterns = [
    /(?:move|reschedule|shift|change)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s+(?:to|for)\s+(.+)/i,
    /(?:verschieb|ändere)\s+(?:die\s+)?(?:aufgabe\s+)?["']?(.+?)["']?\s+(?:auf|zu|für)\s+(.+)/i,
  ];
  
  for (const pattern of reschedulePatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[2]) {
      const taskTitle = match[1].trim();
      const matchedTask = findMatchingTask(taskTitle, allTasks);
      return { 
        command: 'reschedule', 
        details: { 
          title: taskTitle,
          taskId: matchedTask?.id,
          newDateText: match[2].trim()
        } 
      };
    }
  }
  
  // Edit task patterns
  const editPatterns = [
    /(?:edit|update|change|modify)\s+(?:the\s+)?(?:task\s+)?["']?(.+?)["']?\s+(?:to|as)\s+["']?(.+?)["']?$/i,
    /(?:rename|bearbeite|ändere)\s+(?:die\s+)?(?:aufgabe\s+)?["']?(.+?)["']?\s+(?:zu|in)\s+["']?(.+?)["']?$/i,
  ];
  
  for (const pattern of editPatterns) {
    const match = text.match(pattern);
    if (match && match[1] && match[2]) {
      const taskTitle = match[1].trim();
      const matchedTask = findMatchingTask(taskTitle, allTasks);
      return { 
        command: 'edit', 
        details: { 
          title: taskTitle,
          taskId: matchedTask?.id,
          newTitle: match[2].trim()
        } 
      };
    }
  }
  
  return { command: null, details: null };
}

// Find a task that matches the given title (fuzzy matching)
function findMatchingTask(searchTitle: string, tasks?: TaskItem[]): TaskItem | null {
  if (!tasks || tasks.length === 0) return null;
  
  const search = searchTitle.toLowerCase().trim();
  
  // Exact match first
  let match = tasks.find(t => t.title.toLowerCase() === search);
  if (match) return match;
  
  // Contains match
  match = tasks.find(t => t.title.toLowerCase().includes(search) || search.includes(t.title.toLowerCase()));
  if (match) return match;
  
  // Word-based fuzzy match
  const searchWords = search.split(/\s+/);
  for (const task of tasks) {
    const taskWords = task.title.toLowerCase().split(/\s+/);
    const matchingWords = searchWords.filter(sw => taskWords.some(tw => tw.includes(sw) || sw.includes(tw)));
    if (matchingWords.length >= Math.min(2, searchWords.length)) {
      return task;
    }
  }
  
  return null;
}

// Parse natural language date
function parseNaturalDate(text: string): string | null {
  const lower = text.toLowerCase().trim();
  const now = new Date();
  
  if (lower === 'today' || lower === 'heute') {
    return now.toISOString();
  }
  
  if (lower === 'tomorrow' || lower === 'morgen') {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString();
  }
  
  if (lower === 'next week' || lower === 'nächste woche') {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString();
  }
  
  // Day names
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const germanDays = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  
  for (let i = 0; i < days.length; i++) {
    if (lower.includes(days[i]) || lower.includes(germanDays[i])) {
      const targetDay = i;
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7;
      const target = new Date(now);
      target.setDate(target.getDate() + daysUntil);
      return target.toISOString();
    }
  }
  
  // Try parsing as date
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  
  return null;
}

function looksLikeAboutMeQuestion(input?: string): boolean {
  const t = (input || '').trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('was weisst du ueber mich') ||
    t.includes('was weißt du über mich') ||
    t.includes('wer bin ich') ||
    t.includes('who am i') ||
    t.includes('what do you know about me')
  );
}

function buildAboutMeAnswerGerman(profile?: UserProfile): string {
  if (!profile) return 'Ich habe gerade keine Profildaten von dir geladen.';

  const name = profile.displayName?.trim();
  const role = profile.role?.trim();
  const businesses = (profile.businesses || []).map((b) => b.trim()).filter(Boolean);
  const location = [profile.locationCity, profile.locationCountry].filter(Boolean).join(', ');

  const lines: string[] = [];
  if (name) lines.push(`Dein Name (laut Profil) ist: ${name}.`);
  else lines.push('Deinen Namen habe ich in deinem Profil nicht gespeichert.');

  if (role) lines.push(`Deine Rolle: ${role}.`);
  if (businesses.length) lines.push(`Deine Businesses/Projekte (laut Profil): ${businesses.join(', ')}.`);
  if (location) lines.push(`Dein Standort (laut Profil): ${location}.`);

  if (lines.length === 0) return 'Ich habe aktuell keine Profildetails von dir gespeichert.';

  return `${lines.join(' ')} Wenn etwas davon nicht stimmt, sag mir kurz was ich im Profil korrigieren soll.`;
}

function buildUserContext(profile?: UserProfile): string {
  if (!profile) {
    return '\n\n## USER IDENTITY\n⚠️ NO USER PROFILE DATA PROVIDED - If asked about the user, say "I don\'t have your profile information loaded."';
  }

  const parts: string[] = [];
  
  if (profile.displayName) {
    parts.push(`**NAME**: ${profile.displayName}`);
  }
  
  if (profile.role) {
    parts.push(`**ROLE**: ${profile.role}`);
  }
  
  if (profile.businesses && profile.businesses.length > 0) {
    parts.push(`**BUSINESSES**:\n${profile.businesses.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}`);
  }
  
  if (profile.locationCity && profile.locationCountry) {
    parts.push(`**LOCATION**: ${profile.locationCity}, ${profile.locationCountry}`);
  } else if (profile.locationCountry) {
    parts.push(`**LOCATION**: ${profile.locationCountry}`);
  }
  
  if (profile.timezone) {
    parts.push(`**TIMEZONE**: ${profile.timezone}`);
  }
  
  if (profile.interests && profile.interests.length > 0) {
    parts.push(`**INTERESTS**: ${profile.interests.join(', ')}`);
  }
  
  if (profile.skills && profile.skills.length > 0) {
    parts.push(`**SKILLS**: ${profile.skills.join(', ')}`);
  }
  
  if (profile.goals) {
    parts.push(`**GOALS**: ${profile.goals}`);
  }

  return `\n\n## USER IDENTITY\n${parts.join('\n')}`;
}

function buildDataContext(contextData?: ContextData): string {
  if (!contextData) return '';

  const parts: string[] = [];
  const now = new Date();
  
  parts.push(`\n\n## Current Date & Time\n${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);

  parts.push(`\n\n## Quick Stats\n- ${contextData.totalPendingTasks || 0} pending tasks (${contextData.totalOverdue || 0} overdue)\n- ${contextData.totalEvents || 0} upcoming events`);

  // All tasks for reference
  if (contextData.allTasks && contextData.allTasks.length > 0) {
    parts.push(`\n\n## ALL ACTIVE TASKS (for command matching)`);
    for (const task of contextData.allTasks.slice(0, 20)) {
      const status = task.completed ? '✓' : '○';
      const due = task.dueDate ? ` - due ${new Date(task.dueDate).toLocaleDateString()}` : '';
      parts.push(`- [${status}] "${task.title}" (${task.priority})${due} [ID: ${task.id}]`);
    }
  }

  if (contextData.overdueTasks && contextData.overdueTasks.length > 0) {
    parts.push(`\n\n## OVERDUE TASKS`);
    for (const task of contextData.overdueTasks) {
      parts.push(`- ${task.title} (${task.priority}) - was due ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''}`);
    }
  }

  if (contextData.todayTasks && contextData.todayTasks.length > 0) {
    parts.push(`\n\n## TODAY'S TASKS`);
    for (const task of contextData.todayTasks) {
      parts.push(`- ${task.title} (${task.priority})`);
    }
  }

  if (contextData.upcomingEvents && contextData.upcomingEvents.length > 0) {
    parts.push(`\n\n## CALENDAR EVENTS`);
    for (const event of contextData.upcomingEvents) {
      const eventDate = new Date(event.startTime);
      const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      parts.push(`- ${event.title} - ${dateStr} at ${timeStr}`);
    }
  }

  return parts.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { action, personality = 'balanced', audio, text, userProfile, contextData, memories } = await req.json() as LiveSessionRequest;

    console.log('=== GEMINI LIVE REQUEST ===');
    console.log('Action:', action);
    console.log('Text:', text?.substring(0, 100));

    // Check for task commands in the text
    const { command, details } = detectTaskCommand(text || '', contextData?.allTasks);
    
    if (command && details) {
      console.log('Task command detected:', command, details);
      
      let voiceAction: VoiceAction | null = null;
      let responseText = '';
      
      switch (command) {
        case 'create':
          voiceAction = {
            type: 'create_task',
            taskTitle: details.title,
          };
          responseText = `I'll create a new task: "${details.title}". Done!`;
          break;
          
        case 'complete':
          if (details.taskId) {
            voiceAction = {
              type: 'complete_task',
              taskId: details.taskId,
              taskTitle: details.title,
            };
            responseText = `Marking "${details.title}" as done. Great job!`;
          } else {
            responseText = `I couldn't find a task matching "${details.title}". Can you be more specific?`;
          }
          break;
          
        case 'trash':
          if (details.taskId) {
            voiceAction = {
              type: 'trash_task',
              taskId: details.taskId,
              taskTitle: details.title,
            };
            responseText = `Moving "${details.title}" to trash. You can restore it later if needed.`;
          } else {
            responseText = `I couldn't find a task matching "${details.title}". Which task do you want to delete?`;
          }
          break;
          
        case 'reschedule':
          const newDate = parseNaturalDate(details.newDateText);
          if (details.taskId && newDate) {
            voiceAction = {
              type: 'reschedule_task',
              taskId: details.taskId,
              taskTitle: details.title,
              newDate: newDate,
            };
            const dateStr = new Date(newDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
            responseText = `Rescheduling "${details.title}" to ${dateStr}.`;
          } else if (!details.taskId) {
            responseText = `I couldn't find a task matching "${details.title}".`;
          } else {
            responseText = `I didn't understand the date "${details.newDateText}". Try saying "tomorrow" or a specific day like "Monday".`;
          }
          break;
          
        case 'edit':
          if (details.taskId) {
            voiceAction = {
              type: 'edit_task',
              taskId: details.taskId,
              taskTitle: details.title,
              updates: { title: details.newTitle },
            };
            responseText = `Updated the task to "${details.newTitle}".`;
          } else {
            responseText = `I couldn't find a task matching "${details.title}".`;
          }
          break;
      }
      
      return new Response(
        JSON.stringify({ 
          text: responseText, 
          action: voiceAction 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userContext = buildUserContext(userProfile);
    const dataContext = buildDataContext(contextData);
    
    const systemPrompt = `## CRITICAL RULES
1. NEVER INVENT OR FABRICATE any names, companies, tasks, or facts
2. ONLY USE the exact data provided below
3. Keep responses conversational and concise (1-3 sentences)

${userContext}
${dataContext}

---

## Your Role
${personalityPrompts[personality] || personalityPrompts.balanced}

You are a voice assistant helping manage tasks and schedule. You can:
- Summarize tasks and schedule
- Answer questions about what's due
- Help with productivity advice

The user can also give you commands like:
- "Create a task called..." / "Add task..."
- "Mark [task] as done" / "Complete [task]"
- "Move [task] to trash" / "Delete [task]"
- "Move [task] to tomorrow" / "Reschedule [task] to Monday"
- "Edit [task] to [new name]"

These commands are processed automatically, so just confirm when you recognize them.`;

    if (action === 'send_text') {
      if (looksLikeAboutMeQuestion(text)) {
        const safe = buildAboutMeAnswerGerman(userProfile);
        return new Response(JSON.stringify({ text: safe }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: text ? String(text) : '' }],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Please try again.";
      console.log('Gemini response:', responseText.substring(0, 100));

      return new Response(
        JSON.stringify({ text: responseText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_audio') {
      if (!audio) {
        throw new Error('Audio data is required for send_audio action');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/wav',
                      data: audio,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini audio API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't understand that. Please try again.";

      return new Response(
        JSON.stringify({ text: responseText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('Gemini Live error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
