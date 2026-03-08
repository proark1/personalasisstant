import { useState, useCallback } from 'react';
import { Task, CalendarEvent, AssistantPersonality } from '@/types/flux';
import { UserProfile, SmartContext, buildContextSummary } from './useSmartContext';
import { Contact } from './useContacts';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface NoteData {
  title: string;
  content: string;
  tags?: string[];
  query?: string;
}

interface ShoppingItemData {
  name: string;
  quantity?: number;
  category?: string;
}

interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  city?: string;
  country?: string;
  contactType?: string;
  notes?: string;
  query?: string;
}

interface ContractData {
  name?: string;
  provider?: string;
  category?: string;
  costAmount?: number;
  costFrequency?: string;
  renewalDate?: string;
  autoRenews?: boolean;
  notes?: string;
  query?: string;
}

interface ProjectData {
  name?: string;
  description?: string;
  color?: string;
  query?: string;
}

interface HabitData {
  name?: string;
  description?: string;
  icon?: string;
  frequency?: string;
  targetCount?: number;
  query?: string;
}

interface EmailData {
  to?: string;
  subject?: string;
  body?: string;
}

interface ReminderData {
  message: string;
  triggerAt: string;
}

interface ToolCall {
  tool: 'manage_task' | 'schedule_event' | 'suggest_contacts' | 'create_meeting_plan' | 'create_note' | 'add_shopping_item' | 'manage_contact' | 'manage_contract' | 'manage_project' | 'manage_habit' | 'manage_note' | 'compose_email' | 'get_summary' | 'set_reminder';
  action?: string;
  task?: Partial<Task>;
  event?: Partial<CalendarEvent>;
  criteria?: { location?: string; type?: string; keywords?: string[] };
  plan?: { city?: string; contacts?: string[]; dates?: string[] };
  note?: NoteData;
  shoppingItem?: ShoppingItemData;
  contact?: ContactData;
  contract?: ContractData;
  project?: ProjectData;
  habit?: HabitData;
  email?: EmailData;
  summaryType?: string;
  reminder?: ReminderData;
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
  // Weekly trends
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

interface FamilyContextData {
  members: FamilyMemberContext[];
  todayEvents: FamilyEvent[];
  tomorrowEvents: FamilyEvent[];
  upcomingBirthdays: { member: string; date: string; age: number }[];
  shoppingLists: { name: string; itemCount: number }[];
}

export function useAIChat() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseToolCalls = (content: string): { cleanContent: string; toolCalls: ToolCall[] } => {
    const toolCalls: ToolCall[] = [];
    let cleanContent = content;

    console.log('[useAIChat] Parsing tool calls from content:', content.substring(0, 500) + (content.length > 500 ? '...' : ''));

    // Parse manage_task tool calls (allow whitespace/newlines between tags)
    const taskRegex = /<tool>manage_task<\/tool>\s*<action>(\w+)<\/action>\s*<task>(\{[\s\S]*?\})<\/task>/g;
    const taskMatches = content.matchAll(taskRegex);
    let taskMatchCount = 0;
    for (const match of taskMatches) {
      taskMatchCount++;
      console.log('[useAIChat] Found task tool call match:', match[0].substring(0, 200));
      try {
        const action = match[1] as 'add' | 'update' | 'delete' | 'complete';
        const taskData = JSON.parse(match[2]);
        console.log('[useAIChat] Parsed task data:', { action, taskData });

        const dueDateRaw = taskData.dueDate ?? taskData.due_date;
        const recurrenceRuleRaw = taskData.recurrenceRule ?? taskData.recurrence_rule;
        const recurrenceEndRaw = taskData.recurrenceEnd ?? taskData.recurrence_end;

        const task: Partial<Task> = {
          ...taskData,
          dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
          recurrenceRule: recurrenceRuleRaw,
          recurrenceEnd: recurrenceEndRaw ? new Date(recurrenceEndRaw) : undefined,
        };

        toolCalls.push({ tool: 'manage_task', action, task });
        cleanContent = cleanContent.replace(match[0], '');
        console.log('[useAIChat] Successfully parsed manage_task tool call:', { action, title: task.title });
      } catch (e) {
        console.error('[useAIChat] Failed to parse task tool call:', e, 'Raw match:', match[0]);
      }
    }
    console.log('[useAIChat] Total task matches found:', taskMatchCount);

    // Parse schedule_event tool calls (allow whitespace/newlines between tags)
    const eventMatches = content.matchAll(
      /<tool>schedule_event<\/tool>\s*<event>(\{[\s\S]*?\})<\/event>/g
    );
    for (const match of eventMatches) {
      try {
        const eventData = JSON.parse(match[1]);
        const event: Partial<CalendarEvent> = {
          title: eventData.title,
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          location: eventData.location,
          attendees: eventData.attendees,
          recurrenceRule: eventData.recurrenceRule ?? eventData.recurrence_rule,
          recurrenceEnd: eventData.recurrenceEnd
            ? new Date(eventData.recurrenceEnd)
            : eventData.recurrence_end
              ? new Date(eventData.recurrence_end)
              : undefined,
        };
        toolCalls.push({ tool: 'schedule_event', event });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse event tool call:', e);
      }
    }

    // Parse suggest_contacts tool calls
    const contactMatches = content.matchAll(
      /<tool>suggest_contacts<\/tool>\s*<criteria>(\{[\s\S]*?\})<\/criteria>/g
    );
    for (const match of contactMatches) {
      try {
        const criteria = JSON.parse(match[1]);
        toolCalls.push({ tool: 'suggest_contacts', criteria });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse contact suggestion tool call:', e);
      }
    }

    // Parse create_meeting_plan tool calls
    const planMatches = content.matchAll(
      /<tool>create_meeting_plan<\/tool>\s*<plan>(\{[\s\S]*?\})<\/plan>/g
    );
    for (const match of planMatches) {
      try {
        const plan = JSON.parse(match[1]);
        toolCalls.push({ tool: 'create_meeting_plan', plan });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse meeting plan tool call:', e);
      }
    }

    // Parse create_note tool calls
    const noteMatches = content.matchAll(
      /<tool>create_note<\/tool>\s*<note>(\{[\s\S]*?\})<\/note>/g
    );
    for (const match of noteMatches) {
      try {
        const noteData = JSON.parse(match[1]);
        console.log('[useAIChat] Parsed note data:', noteData);
        toolCalls.push({ tool: 'create_note', note: noteData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse note tool call:', e);
      }
    }

    // Parse add_shopping_item tool calls
    const shoppingMatches = content.matchAll(
      /<tool>add_shopping_item<\/tool>\s*<item>(\{[\s\S]*?\})<\/item>/g
    );
    for (const match of shoppingMatches) {
      try {
        const itemData = JSON.parse(match[1]);
        console.log('[useAIChat] Parsed shopping item data:', itemData);
        toolCalls.push({ tool: 'add_shopping_item', shoppingItem: itemData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse shopping item tool call:', e);
      }
    }

    // Parse manage_contact tool calls
    const contactMatches2 = content.matchAll(
      /<tool>manage_contact<\/tool>\s*<action>(\w+)<\/action>\s*<contact>(\{[\s\S]*?\})<\/contact>/g
    );
    for (const match of contactMatches2) {
      try {
        const action = match[1];
        const contactData = JSON.parse(match[2]);
        toolCalls.push({ tool: 'manage_contact', action, contact: contactData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse manage_contact tool call:', e);
      }
    }

    // Parse manage_contract tool calls
    const contractMatches = content.matchAll(
      /<tool>manage_contract<\/tool>\s*<action>(\w+)<\/action>\s*<contract>(\{[\s\S]*?\})<\/contract>/g
    );
    for (const match of contractMatches) {
      try {
        const action = match[1];
        const contractData = JSON.parse(match[2]);
        toolCalls.push({ tool: 'manage_contract', action, contract: contractData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse manage_contract tool call:', e);
      }
    }

    // Parse manage_project tool calls
    const projectMatches = content.matchAll(
      /<tool>manage_project<\/tool>\s*<action>(\w+)<\/action>\s*<project>(\{[\s\S]*?\})<\/project>/g
    );
    for (const match of projectMatches) {
      try {
        const action = match[1];
        const projectData = JSON.parse(match[2]);
        toolCalls.push({ tool: 'manage_project', action, project: projectData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse manage_project tool call:', e);
      }
    }

    // Parse manage_habit tool calls
    const habitMatches = content.matchAll(
      /<tool>manage_habit<\/tool>\s*<action>(\w+)<\/action>\s*<habit>(\{[\s\S]*?\})<\/habit>/g
    );
    for (const match of habitMatches) {
      try {
        const action = match[1];
        const habitData = JSON.parse(match[2]);
        toolCalls.push({ tool: 'manage_habit', action, habit: habitData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse manage_habit tool call:', e);
      }
    }

    // Parse manage_note tool calls (new extended version)
    const manageNoteMatches = content.matchAll(
      /<tool>manage_note<\/tool>\s*<action>(\w+)<\/action>\s*<note>(\{[\s\S]*?\})<\/note>/g
    );
    for (const match of manageNoteMatches) {
      try {
        const action = match[1];
        const noteData = JSON.parse(match[2]);
        toolCalls.push({ tool: 'manage_note', action, note: noteData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse manage_note tool call:', e);
      }
    }

    // Parse compose_email tool calls
    const emailMatches = content.matchAll(
      /<tool>compose_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g
    );
    for (const match of emailMatches) {
      try {
        const emailData = JSON.parse(match[1]);
        toolCalls.push({ tool: 'compose_email', email: emailData });
        cleanContent = cleanContent.replace(match[0], '');
      } catch (e) {
        console.error('Failed to parse compose_email tool call:', e);
      }
    }

    // Parse get_summary tool calls
    const summaryMatches = content.matchAll(
      /<tool>get_summary<\/tool>\s*<type>(\w+)<\/type>/g
    );
    for (const match of summaryMatches) {
      toolCalls.push({ tool: 'get_summary', summaryType: match[1] });
      cleanContent = cleanContent.replace(match[0], '');
    }

    // Strip save_memory tool calls from displayed content (handled server-side)
    cleanContent = cleanContent.replace(/<tool>save_memory<\/tool>\s*<memory>\{[\s\S]*?\}<\/memory>/g, '');

    console.log('[useAIChat] Parse complete. Total tool calls found:', toolCalls.length, toolCalls.map(tc => tc.tool));
    return { cleanContent: cleanContent.trim(), toolCalls };
  };

  const streamChat = useCallback(async ({
    messages,
    tasks,
    events,
    overdueTasks,
    todayTasks,
    personality,
    onDelta,
    onToolCall,
    onDone,
    // Enhanced context
    userProfile,
    relevantContacts,
    relevantContracts,
    contextSummary,
    healthData,
    // Family context
    familyContext,
    // Smart payload data (new)
    statsSummary,
    emailSummary,
    notesSummary,
    habitsSummary,
    // AI Memory
    memories,
  }: {
    messages: Message[];
    tasks?: Task[];
    events?: CalendarEvent[];
    overdueTasks?: Task[];
    todayTasks?: Task[];
    personality?: AssistantPersonality;
    onDelta: (text: string) => void;
    onToolCall: (toolCall: ToolCall) => void;
    onDone: () => void;
    // Enhanced context
    userProfile?: UserProfile | null;
    relevantContacts?: Contact[];
    relevantContracts?: RelevantContract[];
    contextSummary?: string;
    healthData?: HealthData;
    // Family context
    familyContext?: FamilyContextData;
    // Smart payload data (new)
    statsSummary?: string;
    emailSummary?: { subject: string; from: string; priority: string; snippet: string }[];
    notesSummary?: { title: string; snippet: string; tags: string[] }[];
    habitsSummary?: { name: string; streak: number; isCompletedToday: boolean; frequency: string }[];
    // AI Memory
    memories?: { type: string; key: string; value: string; category?: string }[];
  }) => {
    setIsStreaming(true);
    setError(null);

    try {
      // Build request payload
      const payload: Record<string, unknown> = {
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        tasks: tasks?.map(t => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          category: t.category,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
        })),
        events: events?.map(e => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
        })),
        personality,
      };

      // Add overdue tasks for proactive suggestions
      if (overdueTasks && overdueTasks.length > 0) {
        payload.overdueTasks = overdueTasks.map(t => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
        }));
      }

      // Add today's tasks
      if (todayTasks && todayTasks.length > 0) {
        payload.todayTasks = todayTasks.map(t => ({
          id: t.id,
          title: t.title,
          category: t.category,
          priority: t.priority,
          dueDate: t.dueDate?.toISOString(),
        }));
      }

      // Add enhanced context if available
      if (userProfile) {
        payload.userProfile = userProfile;
      }

      if (relevantContacts && relevantContacts.length > 0) {
        payload.relevantContacts = relevantContacts.map(c => ({
          name: c.name,
          role: c.role,
          company: c.company,
          city: c.city,
          country: c.country,
          tags: c.tags,
          email: c.email,
        }));
      }

      if (relevantContracts && relevantContracts.length > 0) {
        payload.relevantContracts = relevantContracts;
      }

      if (contextSummary) {
        payload.contextSummary = contextSummary;
      }

      if (healthData) {
        payload.healthData = healthData;
      }

      if (familyContext && familyContext.members.length > 0) {
        payload.familyContext = familyContext;
      }

      // Smart payload fields (new)
      if (statsSummary) {
        payload.statsSummary = statsSummary;
      }
      if (emailSummary && emailSummary.length > 0) {
        payload.emailSummary = emailSummary;
      }
      if (notesSummary && notesSummary.length > 0) {
        payload.notesSummary = notesSummary;
      }
      if (habitsSummary && habitsSummary.length > 0) {
        payload.habitsSummary = habitsSummary;
      }

      // AI Memory
      if (memories && memories.length > 0) {
        payload.memories = memories;
      }

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error: ${resp.status}`);
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              onDelta(content);
            }
          } catch {
            // Incomplete JSON, put it back
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse tool calls from the complete response
      const { toolCalls } = parseToolCalls(fullContent);
      for (const toolCall of toolCalls) {
        onToolCall(toolCall);
      }

      onDone();
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      setError(errorMessage);
      console.error('Chat error:', e);
      throw e;
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { streamChat, isStreaming, error };
}
