import { useState, useCallback, useRef, useEffect } from "react";
import { Task, CalendarEvent, AssistantPersonality } from "@/types/flux";
import { UserProfile } from "./useSmartContext";
import { Contact } from "./useContacts";
import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface Message {
  role: "user" | "assistant";
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

interface PropertyData {
  name?: string;
  propertyType?: string;
  address?: string;
  city?: string;
  country?: string;
  purchasePrice?: number;
  currentValue?: number;
  sizeSqm?: number;
  notes?: string;
  query?: string;
}

interface BusinessData {
  name?: string;
  description?: string;
  problemStatement?: string;
  targetAudience?: string;
  businessModel?: string;
  uniqueValueProposition?: string;
  status?: string;
  tags?: string[];
  notes?: string;
  query?: string;
}

interface FamilyMemberData {
  name?: string;
  relationship?: string;
  birthDate?: string;
  email?: string;
  phone?: string;
  schoolName?: string;
  schoolGrade?: string;
  allergies?: string[];
  medicalNotes?: string;
  notes?: string;
  query?: string;
}

interface EventManageData {
  query?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface FetchEmailsData {
  scope?: string;
  from?: string;
  limit?: number;
}

interface DraftEmailReplyData {
  emailQuery: string;
  instruction?: string;
  tone?: string;
}

export interface ToolCall {
  tool:
    | "manage_task"
    | "schedule_event"
    | "suggest_contacts"
    | "create_meeting_plan"
    | "create_note"
    | "add_shopping_item"
    | "manage_contact"
    | "manage_contract"
    | "manage_project"
    | "manage_habit"
    | "manage_note"
    | "compose_email"
    | "get_summary"
    | "set_reminder"
    | "manage_event"
    | "manage_property"
    | "manage_business"
    | "manage_family_member"
    | "fetch_emails"
    | "draft_email_reply";
  action?: string;
  task?: Partial<Task>;
  event?: Partial<CalendarEvent> | EventManageData;
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
  property?: PropertyData;
  business?: BusinessData;
  familyMember?: FamilyMemberData;
  fetchEmails?: FetchEmailsData;
  draftEmailReply?: DraftEmailReplyData;
}

interface _RelevantContact {
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
  medications?: {
    name: string;
    dosage?: string;
    frequency?: string;
    isActive: boolean;
    refillDate?: string;
  }[];
  appointments?: {
    title: string;
    date: string;
    provider?: string;
    type?: string;
    isCompleted: boolean;
  }[];
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

  // Tracks the in-flight stream so we can abort the previous one when a new
  // streamChat starts and on unmount. Aborting must never surface as a
  // user-facing error (see AbortError handling in streamChat's catch).
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const parseToolCalls = (content: string): { cleanContent: string; toolCalls: ToolCall[] } => {
    const toolCalls: ToolCall[] = [];
    let cleanContent = content;

    console.log(
      "[useAIChat] Parsing tool calls from content:",
      content.substring(0, 500) + (content.length > 500 ? "..." : ""),
    );

    // Parse manage_task tool calls (allow whitespace/newlines between tags)
    const taskRegex =
      /<tool>manage_task<\/tool>\s*<action>(\w+)<\/action>\s*<task>(\{[\s\S]*?\})<\/task>/g;
    const taskMatches = content.matchAll(taskRegex);
    let taskMatchCount = 0;
    for (const match of taskMatches) {
      taskMatchCount++;
      console.log("[useAIChat] Found task tool call match:", match[0].substring(0, 200));
      try {
        const action = match[1] as "add" | "update" | "delete" | "complete";
        const taskData = JSON.parse(match[2]);
        console.log("[useAIChat] Parsed task data:", { action, taskData });

        const dueDateRaw = taskData.dueDate ?? taskData.due_date;
        const recurrenceRuleRaw = taskData.recurrenceRule ?? taskData.recurrence_rule;
        const recurrenceEndRaw = taskData.recurrenceEnd ?? taskData.recurrence_end;

        const task: Partial<Task> = {
          ...taskData,
          dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
          recurrenceRule: recurrenceRuleRaw,
          recurrenceEnd: recurrenceEndRaw ? new Date(recurrenceEndRaw) : undefined,
        };

        toolCalls.push({ tool: "manage_task", action, task });
        cleanContent = cleanContent.replace(match[0], "");
        console.log("[useAIChat] Successfully parsed manage_task tool call:", {
          action,
          title: task.title,
        });
      } catch (e) {
        console.error("[useAIChat] Failed to parse task tool call:", e, "Raw match:", match[0]);
      }
    }
    console.log("[useAIChat] Total task matches found:", taskMatchCount);

    // Parse schedule_event tool calls (allow whitespace/newlines between tags)
    const eventMatches = content.matchAll(
      /<tool>schedule_event<\/tool>\s*<event>(\{[\s\S]*?\})<\/event>/g,
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
        toolCalls.push({ tool: "schedule_event", event });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse event tool call:", e);
      }
    }

    // Parse suggest_contacts tool calls
    const contactMatches = content.matchAll(
      /<tool>suggest_contacts<\/tool>\s*<criteria>(\{[\s\S]*?\})<\/criteria>/g,
    );
    for (const match of contactMatches) {
      try {
        const criteria = JSON.parse(match[1]);
        toolCalls.push({ tool: "suggest_contacts", criteria });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse contact suggestion tool call:", e);
      }
    }

    // Parse create_meeting_plan tool calls
    const planMatches = content.matchAll(
      /<tool>create_meeting_plan<\/tool>\s*<plan>(\{[\s\S]*?\})<\/plan>/g,
    );
    for (const match of planMatches) {
      try {
        const plan = JSON.parse(match[1]);
        toolCalls.push({ tool: "create_meeting_plan", plan });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse meeting plan tool call:", e);
      }
    }

    // Parse create_note tool calls
    const noteMatches = content.matchAll(
      /<tool>create_note<\/tool>\s*<note>(\{[\s\S]*?\})<\/note>/g,
    );
    for (const match of noteMatches) {
      try {
        const noteData = JSON.parse(match[1]);
        console.log("[useAIChat] Parsed note data:", noteData);
        toolCalls.push({ tool: "create_note", note: noteData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse note tool call:", e);
      }
    }

    // Parse add_shopping_item tool calls
    const shoppingMatches = content.matchAll(
      /<tool>add_shopping_item<\/tool>\s*<item>(\{[\s\S]*?\})<\/item>/g,
    );
    for (const match of shoppingMatches) {
      try {
        const itemData = JSON.parse(match[1]);
        console.log("[useAIChat] Parsed shopping item data:", itemData);
        toolCalls.push({ tool: "add_shopping_item", shoppingItem: itemData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse shopping item tool call:", e);
      }
    }

    // Parse manage_contact tool calls
    const contactMatches2 = content.matchAll(
      /<tool>manage_contact<\/tool>\s*<action>(\w+)<\/action>\s*<contact>(\{[\s\S]*?\})<\/contact>/g,
    );
    for (const match of contactMatches2) {
      try {
        const action = match[1];
        const contactData = JSON.parse(match[2]);
        toolCalls.push({ tool: "manage_contact", action, contact: contactData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse manage_contact tool call:", e);
      }
    }

    // Parse manage_contract tool calls
    const contractMatches = content.matchAll(
      /<tool>manage_contract<\/tool>\s*<action>(\w+)<\/action>\s*<contract>(\{[\s\S]*?\})<\/contract>/g,
    );
    for (const match of contractMatches) {
      try {
        const action = match[1];
        const contractData = JSON.parse(match[2]);
        toolCalls.push({ tool: "manage_contract", action, contract: contractData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse manage_contract tool call:", e);
      }
    }

    // Parse manage_project tool calls
    const projectMatches = content.matchAll(
      /<tool>manage_project<\/tool>\s*<action>(\w+)<\/action>\s*<project>(\{[\s\S]*?\})<\/project>/g,
    );
    for (const match of projectMatches) {
      try {
        const action = match[1];
        const projectData = JSON.parse(match[2]);
        toolCalls.push({ tool: "manage_project", action, project: projectData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse manage_project tool call:", e);
      }
    }

    // Parse manage_habit tool calls
    const habitMatches = content.matchAll(
      /<tool>manage_habit<\/tool>\s*<action>(\w+)<\/action>\s*<habit>(\{[\s\S]*?\})<\/habit>/g,
    );
    for (const match of habitMatches) {
      try {
        const action = match[1];
        const habitData = JSON.parse(match[2]);
        toolCalls.push({ tool: "manage_habit", action, habit: habitData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse manage_habit tool call:", e);
      }
    }

    // Parse manage_note tool calls (new extended version)
    const manageNoteMatches = content.matchAll(
      /<tool>manage_note<\/tool>\s*<action>(\w+)<\/action>\s*<note>(\{[\s\S]*?\})<\/note>/g,
    );
    for (const match of manageNoteMatches) {
      try {
        const action = match[1];
        const noteData = JSON.parse(match[2]);
        toolCalls.push({ tool: "manage_note", action, note: noteData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse manage_note tool call:", e);
      }
    }

    // Parse compose_email tool calls
    const emailMatches = content.matchAll(
      /<tool>compose_email<\/tool>\s*<email>(\{[\s\S]*?\})<\/email>/g,
    );
    for (const match of emailMatches) {
      try {
        const emailData = JSON.parse(match[1]);
        toolCalls.push({ tool: "compose_email", email: emailData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse compose_email tool call:", e);
      }
    }

    // Parse get_summary tool calls
    const summaryMatches = content.matchAll(/<tool>get_summary<\/tool>\s*<type>(\w+)<\/type>/g);
    for (const match of summaryMatches) {
      toolCalls.push({ tool: "get_summary", summaryType: match[1] });
      cleanContent = cleanContent.replace(match[0], "");
    }

    // Parse set_reminder tool calls
    const reminderMatches = content.matchAll(
      /<tool>set_reminder<\/tool>\s*<reminder>(\{[\s\S]*?\})<\/reminder>/g,
    );
    for (const match of reminderMatches) {
      try {
        const reminderData = JSON.parse(match[1]);
        console.log("[useAIChat] Parsed reminder data:", reminderData);
        toolCalls.push({ tool: "set_reminder", reminder: reminderData });
        cleanContent = cleanContent.replace(match[0], "");
      } catch (e) {
        console.error("Failed to parse set_reminder tool call:", e);
      }
    }

    // Strip save_memory tool calls from displayed content (handled server-side)
    cleanContent = cleanContent.replace(
      /<tool>save_memory<\/tool>\s*<memory>\{[\s\S]*?\}<\/memory>/g,
      "",
    );

    // Strip web_search tool calls from displayed content (handled server-side)
    cleanContent = cleanContent.replace(
      /<tool>web_search<\/tool>\s*<query>\{[\s\S]*?\}<\/query>/g,
      "",
    );

    console.log(
      "[useAIChat] Parse complete. Total tool calls found:",
      toolCalls.length,
      toolCalls.map((tc) => tc.tool),
    );
    return { cleanContent: cleanContent.trim(), toolCalls };
  };

  const streamChat = useCallback(
    async ({
      messages,
      imageUrl,
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
      // Workspace
      workspaceId,
    }: {
      messages: Message[];
      imageUrl?: string;
      tasks?: Task[];
      events?: CalendarEvent[];
      overdueTasks?: Task[];
      todayTasks?: Task[];
      personality?: AssistantPersonality;
      onDelta: (text: string) => void;
      onToolCall: (toolCall: ToolCall) => void | Promise<void>;
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
      habitsSummary?: {
        name: string;
        streak: number;
        isCompletedToday: boolean;
        frequency: string;
      }[];
      // AI Memory
      memories?: { type: string; key: string; value: string; category?: string }[];
      // Workspace — when set, the chat function scopes tool creation to that
      // workspace and exposes workspace members to the AI for @mention resolution.
      workspaceId?: string | null;
    }) => {
      setIsStreaming(true);
      setError(null);

      // Abort any previous in-flight stream before starting a new one, then
      // install this call's controller as the current one.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // Build request payload
        const payload: Record<string, unknown> = {
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          imageUrl,
          tasks: tasks?.map((t) => ({
            id: t.id,
            title: t.title,
            completed: t.completed,
            category: t.category,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString(),
          })),
          events: events?.map((e) => ({
            id: e.id,
            title: e.title,
            startTime: e.startTime.toISOString(),
            endTime: e.endTime.toISOString(),
          })),
          personality,
        };

        // Add overdue tasks for proactive suggestions
        if (overdueTasks && overdueTasks.length > 0) {
          payload.overdueTasks = overdueTasks.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            priority: t.priority,
            dueDate: t.dueDate?.toISOString(),
          }));
        }

        // Add today's tasks
        if (todayTasks && todayTasks.length > 0) {
          payload.todayTasks = todayTasks.map((t) => ({
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
          payload.relevantContacts = relevantContacts.map((c) => ({
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

        // Active workspace (if any). The server resolves members itself.
        if (workspaceId) {
          payload.workspaceId = workspaceId;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Error: ${resp.status}`);
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                onDelta(content);
              }
            } catch {
              // A `data:` frame that fails to parse is almost always truncated —
              // the rest of it arrives in the next chunk. We must NOT speculatively
              // repair-and-emit it: a repaired-but-truncated frame would emit a
              // partial delta, then the real completed frame would emit the same
              // delta again (double-emit). Instead, buffer the raw line and retry
              // once the remainder arrives. We only speculatively repair to *decide*
              // whether the frame is a content frame worth buffering vs. junk to
              // skip — never to emit content.
              let looksRepairable = false;
              if (jsonStr.includes('"content":')) {
                try {
                  JSON.parse(jsonStr + (jsonStr.endsWith('"') ? "}" : '"}'));
                  looksRepairable = true;
                } catch {
                  looksRepairable = false;
                }
              }
              if (jsonStr.includes('"content":') && !looksRepairable) {
                // Genuinely malformed content frame we can't repair — skip it
                // rather than wedging the buffer forever.
                continue;
              }
              // Incomplete (but plausibly completable) JSON — put it back and wait
              // for the next chunk to complete the frame, then parse it for real.
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Parse tool calls from the complete response
        const { toolCalls } = parseToolCalls(fullContent);
        for (const toolCall of toolCalls) {
          await onToolCall(toolCall);
        }

        onDone();
      } catch (e) {
        // An aborted stream (new streamChat started, or unmount) is not a
        // user-facing error — swallow it silently.
        if (e instanceof DOMException && e.name === "AbortError") {
          return;
        }
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        setError(errorMessage);
        console.error("Chat error:", e);
        throw e;
      } finally {
        // Only clear/flip state if this call still owns the current controller —
        // a newer streamChat may have replaced it (and flipped isStreaming on).
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsStreaming(false);
        }
      }
    },
    [],
  );

  return { streamChat, isStreaming, error };
}
