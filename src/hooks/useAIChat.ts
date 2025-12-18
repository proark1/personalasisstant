import { useState, useCallback } from 'react';
import { Task, CalendarEvent, AssistantPersonality } from '@/types/flux';
import { UserProfile, SmartContext, buildContextSummary } from './useSmartContext';
import { Contact } from './useContacts';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  tool: 'manage_task' | 'schedule_event' | 'suggest_contacts' | 'create_meeting_plan';
  action?: 'add' | 'update' | 'delete' | 'complete';
  task?: Partial<Task>;
  event?: Partial<CalendarEvent>;
  criteria?: { location?: string; type?: string; keywords?: string[] };
  plan?: { city?: string; contacts?: string[]; dates?: string[] };
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

    console.log('[useAIChat] Parse complete. Total tool calls found:', toolCalls.length, toolCalls.map(tc => tc.tool));
    return { cleanContent: cleanContent.trim(), toolCalls };
  };

  const streamChat = useCallback(async ({
    messages,
    tasks,
    events,
    personality,
    onDelta,
    onToolCall,
    onDone,
    // Enhanced context
    userProfile,
    relevantContacts,
    relevantContracts,
    contextSummary,
  }: {
    messages: Message[];
    tasks?: Task[];
    events?: CalendarEvent[];
    personality?: AssistantPersonality;
    onDelta: (text: string) => void;
    onToolCall: (toolCall: ToolCall) => void;
    onDone: () => void;
    // Enhanced context
    userProfile?: UserProfile | null;
    relevantContacts?: Contact[];
    relevantContracts?: RelevantContract[];
    contextSummary?: string;
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
