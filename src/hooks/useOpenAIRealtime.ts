import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AudioRecorder, encodeAudioForAPI, AudioQueue, parseNaturalDate, fuzzyMatchTask } from '@/utils/RealtimeAudio';
import type { Task, TaskCategory, TaskPriority, CalendarEvent } from '@/types/flux';
import type { Contact, ContactInput } from '@/hooks/useContacts';
import type { Contract, ContractInput } from '@/hooks/useContracts';
import type { Project } from '@/types/flux';

interface UseOpenAIRealtimeOptions {
  userProfile: any;
  contextData: any;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onResponse?: (text: string) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  // Task operations
  addTask?: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<Task | null>;
  updateTask?: (id: string, updates: Partial<Task>) => Promise<void>;
  trashTask?: (id: string) => Promise<{ error: any }>;
  toggleTaskComplete?: (id: string) => Promise<void>;
  // Contact operations
  addContact?: (input: ContactInput) => Promise<Contact | null>;
  updateContact?: (id: string, updates: Partial<ContactInput>) => Promise<boolean>;
  deleteContact?: (id: string) => Promise<boolean>;
  markContacted?: (id: string) => Promise<boolean>;
  // Event operations
  addEvent?: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent | null>;
  updateEvent?: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent?: (id: string) => Promise<void>;
  // Contract operations
  addContract?: (input: ContractInput) => Promise<Contract | null>;
  updateContract?: (id: string, updates: Partial<ContractInput>) => Promise<boolean>;
  deleteContract?: (id: string) => Promise<boolean>;
  // Project operations
  addProject?: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project | null>;
  updateProject?: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject?: (id: string) => Promise<void>;
  // Refetch
  refetch?: () => void;
  refetchContacts?: () => void;
  refetchContracts?: () => void;
  refetchProjects?: () => void;
}

// Fuzzy match helper for any items with a name field
function fuzzyMatchByName<T extends { name: string; id: string }>(query: string, items: T[]): T[] {
  const q = query.toLowerCase().trim();
  return items.filter(item => 
    item.name.toLowerCase().includes(q) ||
    q.split(' ').every(word => item.name.toLowerCase().includes(word))
  ).slice(0, 5);
}

// Fuzzy match for contacts (checks multiple fields)
function fuzzyMatchContact(query: string, contacts: any[]): any[] {
  const q = query.toLowerCase().trim();
  return contacts.filter(c => {
    const searchable = [c.name, c.company, c.role, c.city, c.country, c.notes, ...(c.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(q) || q.split(' ').every(word => searchable.includes(word));
  }).slice(0, 5);
}

// Parse natural language date/time for events
function parseEventDateTime(input: string): Date | null {
  const date = parseNaturalDate(input);
  if (date) return new Date(date);
  
  // Try parsing as ISO
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) return parsed;
  
  // Try common patterns
  const now = new Date();
  const lowerInput = input.toLowerCase();
  
  // "3pm", "3:30pm", "15:00"
  const timeMatch = lowerInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2] || '0');
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    const result = new Date(now);
    result.setHours(hours, minutes, 0, 0);
    
    // If time is in the past today, assume tomorrow
    if (result < now) result.setDate(result.getDate() + 1);
    
    return result;
  }
  
  return null;
}

export function useOpenAIRealtime({
  userProfile,
  contextData,
  onTranscript,
  onResponse,
  onError,
  onConnectionChange,
  onSpeakingChange,
  addTask,
  updateTask,
  trashTask,
  toggleTaskComplete,
  addContact,
  updateContact,
  deleteContact,
  markContacted,
  addEvent,
  updateEvent,
  deleteEvent,
  addContract,
  updateContract,
  deleteContract,
  addProject,
  updateProject,
  deleteProject,
  refetch,
  refetchContacts,
  refetchContracts,
  refetchProjects,
}: UseOpenAIRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Debug timing metrics
  const [debugTimings, setDebugTimings] = useState<{
    tokenFetchStart?: number;
    tokenFetchEnd?: number;
    micPermissionStart?: number;
    micPermissionEnd?: number;
    dataChannelOpen?: number;
    remoteSdpSet?: number;
    firstAudioReceived?: number;
    connectStart?: number;
  }>({});
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const currentTranscriptRef = useRef<string>('');
  const pendingFunctionCallRef = useRef<{ name: string; callId: string; args: string } | null>(null);
  const isConnectingRef = useRef(false);
  const dcIsOpenRef = useRef(false);
  const rtcReadyRef = useRef(false);
  const speakerMutedRef = useRef(false);
  const micMutedRef = useRef(false);
  // Used to cancel in-flight connection attempts when the user taps hang up / retries
  const connectAttemptRef = useRef(0);

  // Handle function calls from OpenAI
  const handleFunctionCall = useCallback(async (name: string, args: any, callId: string) => {
    console.log('Function call:', name, args);
    let result: any = { success: false, message: 'Unknown function' };
    
    const tasks = contextData?.allTasks || [];
    const contacts = contextData?.allContacts || [];
    const events = contextData?.allEvents || [];
    const contracts = contextData?.allContracts || [];
    const projects = contextData?.allProjects || [];
    
    try {
      switch (name) {
        // ==================== TASK HANDLERS ====================
        case 'create_task': {
          if (addTask && args.title) {
            const newTask = await addTask({
              title: args.title,
              priority: (args.priority || 'medium') as TaskPriority,
              category: (args.category || 'personal') as TaskCategory,
              completed: false,
              dueDate: args.due_date ? new Date(args.due_date) : undefined,
              projectId: args.project_id,
            });
            if (newTask) {
              result = { success: true, message: `Created task "${args.title}"`, task: newTask };
              refetch?.();
            } else {
              result = { success: false, message: 'Failed to create task' };
            }
          }
          break;
        }
        
        case 'complete_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (toggleTaskComplete) {
              await toggleTaskComplete(matches[0].id);
              result = { success: true, message: `Completed task "${matches[0].title}"` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { success: false, multiple_matches: true, matches: matches.slice(0, 3), message: `Found multiple tasks: ${taskList}. Please be more specific.` };
          }
          break;
        }
        
        case 'trash_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (trashTask) {
              await trashTask(matches[0].id);
              result = { success: true, message: `Moved "${matches[0].title}" to trash` };
              refetch?.();
            }
          } else {
            const taskList = matches.slice(0, 3).map(t => t.title).join(', ');
            result = { success: false, multiple_matches: true, message: `Found multiple tasks: ${taskList}. Please be more specific.` };
          }
          break;
        }
        
        case 'reschedule_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          const newDate = parseNaturalDate(args.new_date);
          
          if (!newDate) {
            result = { success: false, message: `Could not understand the date "${args.new_date}"` };
          } else if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1) {
            if (updateTask) {
              await updateTask(matches[0].id, { dueDate: new Date(newDate) });
              result = { success: true, message: `Rescheduled "${matches[0].title}" to ${newDate}` };
              refetch?.();
            }
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple tasks. Please be more specific.` };
          }
          break;
        }
        
        case 'edit_task': {
          const matches = fuzzyMatchTask(args.task_query, tasks);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (matches.length === 1 && updateTask) {
            const updates: Partial<Task> = {};
            if (args.new_title) updates.title = args.new_title;
            if (args.new_priority) updates.priority = args.new_priority as TaskPriority;
            if (args.new_category) updates.category = args.new_category as TaskCategory;
            await updateTask(matches[0].id, updates);
            result = { success: true, message: `Updated task "${matches[0].title}"` };
            refetch?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple tasks. Please be more specific.` };
          }
          break;
        }
        
        case 'search_tasks': {
          const matches = fuzzyMatchTask(args.query, tasks);
          result = { success: true, message: matches.length > 0 ? `Found ${matches.length} task(s)` : 'No tasks found', tasks: matches.slice(0, 5) };
          break;
        }
        
        case 'get_task_summary': {
          const now = new Date();
          const todayStr = now.toISOString().split('T')[0];
          let relevantTasks: any[] = [];
          let summary = '';
          
          switch (args.type) {
            case 'today':
              relevantTasks = tasks.filter((t: any) => !t.completed && t.dueDate?.startsWith(todayStr));
              summary = relevantTasks.length > 0 ? `You have ${relevantTasks.length} task(s) due today` : 'No tasks due today';
              break;
            case 'overdue':
              relevantTasks = tasks.filter((t: any) => !t.completed && t.dueDate && t.dueDate < todayStr);
              summary = relevantTasks.length > 0 ? `You have ${relevantTasks.length} overdue task(s)` : 'No overdue tasks';
              break;
            case 'upcoming':
              const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
              relevantTasks = tasks.filter((t: any) => !t.completed && t.dueDate && t.dueDate >= todayStr && t.dueDate <= nextWeek);
              summary = relevantTasks.length > 0 ? `You have ${relevantTasks.length} task(s) coming up` : 'No upcoming tasks';
              break;
            default:
              relevantTasks = tasks.filter((t: any) => !t.completed);
              summary = `You have ${relevantTasks.length} pending task(s)`;
          }
          result = { success: true, message: summary, tasks: relevantTasks.slice(0, 5) };
          break;
        }

        // ==================== CONTACT HANDLERS ====================
        case 'search_contacts': {
          const query = (args.query || '').toLowerCase();
          const location = (args.location || '').toLowerCase();
          const typeFilter = args.type || 'all';
          
          const matches = contacts.filter((c: any) => {
            const searchFields = [c.name, c.company, c.role, c.city, c.country, c.notes, ...(c.tags || [])].filter(Boolean).join(' ').toLowerCase();
            const matchesQuery = !query || searchFields.includes(query);
            const matchesLocation = !location || (c.city?.toLowerCase().includes(location)) || (c.country?.toLowerCase().includes(location));
            const matchesType = typeFilter === 'all' || c.contactType === typeFilter;
            return matchesQuery && matchesLocation && matchesType;
          });
          
          result = {
            success: true,
            message: matches.length > 0 ? `Found ${matches.length} contact(s)` : `No contacts found`,
            contacts: matches.slice(0, 10).map((c: any) => ({
              name: c.name, company: c.company, role: c.role,
              location: [c.city, c.country].filter(Boolean).join(', '),
              phone: c.phone, email: c.email
            }))
          };
          break;
        }
        
        case 'create_contact': {
          if (addContact && args.name) {
            const newContact = await addContact({
              name: args.name,
              company: args.company,
              role: args.role,
              email: args.email,
              phone: args.phone,
              city: args.city,
              country: args.country,
              contactType: args.contact_type || 'business',
              notes: args.notes,
            });
            if (newContact) {
              result = { success: true, message: `Added contact "${args.name}"` };
              refetchContacts?.();
            } else {
              result = { success: false, message: 'Failed to create contact' };
            }
          }
          break;
        }
        
        case 'update_contact': {
          const matches = fuzzyMatchContact(args.contact_query, contacts);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find contact matching "${args.contact_query}"` };
          } else if (matches.length === 1 && updateContact) {
            const updates: Partial<ContactInput> = {};
            if (args.company) updates.company = args.company;
            if (args.role) updates.role = args.role;
            if (args.email) updates.email = args.email;
            if (args.phone) updates.phone = args.phone;
            if (args.city) updates.city = args.city;
            if (args.country) updates.country = args.country;
            if (args.notes) updates.notes = args.notes;
            await updateContact(matches[0].id, updates);
            result = { success: true, message: `Updated contact "${matches[0].name}"` };
            refetchContacts?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple contacts: ${matches.slice(0, 3).map((c: any) => c.name).join(', ')}` };
          }
          break;
        }
        
        case 'mark_contact_contacted': {
          const matches = fuzzyMatchContact(args.contact_query, contacts);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find contact matching "${args.contact_query}"` };
          } else if (matches.length === 1 && markContacted) {
            await markContacted(matches[0].id);
            result = { success: true, message: `Marked "${matches[0].name}" as contacted` };
            refetchContacts?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple contacts. Please be more specific.` };
          }
          break;
        }
        
        case 'delete_contact': {
          const matches = fuzzyMatchContact(args.contact_query, contacts);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find contact matching "${args.contact_query}"` };
          } else if (matches.length === 1 && deleteContact) {
            await deleteContact(matches[0].id);
            result = { success: true, message: `Deleted contact "${matches[0].name}"` };
            refetchContacts?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple contacts. Please be more specific.` };
          }
          break;
        }
        
        case 'get_contacts_due': {
          const now = new Date();
          const due = contacts.filter((c: any) => c.nextContactDue && new Date(c.nextContactDue) <= now);
          result = {
            success: true,
            message: due.length > 0 ? `You have ${due.length} contact(s) due for follow-up` : 'No contacts due for follow-up',
            contacts: due.slice(0, 10).map((c: any) => ({ name: c.name, company: c.company, lastContacted: c.lastContactedAt }))
          };
          break;
        }

        // ==================== EVENT HANDLERS ====================
        case 'create_event': {
          if (addEvent && args.title && args.start_time) {
            const startTime = parseEventDateTime(args.start_time);
            if (!startTime) {
              result = { success: false, message: `Could not understand the time "${args.start_time}"` };
              break;
            }
            
            let endTime: Date;
            if (args.end_time) {
              const parsedEnd = parseEventDateTime(args.end_time);
              if (parsedEnd) {
                endTime = parsedEnd;
              } else {
                // Try parsing as duration like "1 hour"
                const durationMatch = args.end_time.match(/(\d+)\s*(hour|hr|minute|min)/i);
                if (durationMatch) {
                  const amount = parseInt(durationMatch[1]);
                  const unit = durationMatch[2].toLowerCase();
                  endTime = new Date(startTime);
                  if (unit.startsWith('hour') || unit === 'hr') {
                    endTime.setHours(endTime.getHours() + amount);
                  } else {
                    endTime.setMinutes(endTime.getMinutes() + amount);
                  }
                } else {
                  endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour
                }
              }
            } else {
              endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour
            }
            
            const newEvent = await addEvent({
              title: args.title,
              startTime,
              endTime,
              location: args.location,
              description: args.description,
            });
            
            if (newEvent) {
              const dateStr = startTime.toLocaleDateString();
              const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              result = { success: true, message: `Created event "${args.title}" on ${dateStr} at ${timeStr}` };
              refetch?.();
            } else {
              result = { success: false, message: 'Failed to create event' };
            }
          }
          break;
        }
        
        case 'search_events': {
          const now = new Date();
          let startRange = now;
          let endRange = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
          
          switch (args.date_range) {
            case 'today':
              endRange = new Date(now); endRange.setHours(23, 59, 59);
              break;
            case 'tomorrow':
              startRange = new Date(now); startRange.setDate(startRange.getDate() + 1); startRange.setHours(0, 0, 0);
              endRange = new Date(startRange); endRange.setHours(23, 59, 59);
              break;
            case 'this_week':
              endRange = new Date(now); endRange.setDate(endRange.getDate() + (7 - endRange.getDay()));
              break;
            case 'next_week':
              startRange = new Date(now); startRange.setDate(startRange.getDate() + (8 - startRange.getDay()));
              endRange = new Date(startRange); endRange.setDate(endRange.getDate() + 6);
              break;
            case 'this_month':
              endRange = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              break;
          }
          
          const query = (args.query || '').toLowerCase();
          const matches = events.filter((e: any) => {
            const eventStart = new Date(e.startTime);
            const inRange = eventStart >= startRange && eventStart <= endRange;
            const matchesQuery = !query || e.title.toLowerCase().includes(query);
            return inRange && matchesQuery;
          });
          
          result = {
            success: true,
            message: matches.length > 0 ? `Found ${matches.length} event(s)` : 'No events found',
            events: matches.slice(0, 10).map((e: any) => ({
              title: e.title,
              date: new Date(e.startTime).toLocaleDateString(),
              time: new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              location: e.location
            }))
          };
          break;
        }
        
        case 'update_event': {
          const query = (args.event_query || '').toLowerCase();
          const matches = events.filter((e: any) => e.title.toLowerCase().includes(query));
          
          if (matches.length === 0) {
            result = { success: false, message: `Could not find event matching "${args.event_query}"` };
          } else if (matches.length === 1 && updateEvent) {
            const updates: Partial<CalendarEvent> = {};
            if (args.new_title) updates.title = args.new_title;
            if (args.new_start_time) {
              const parsed = parseEventDateTime(args.new_start_time);
              if (parsed) updates.startTime = parsed;
            }
            if (args.new_end_time) {
              const parsed = parseEventDateTime(args.new_end_time);
              if (parsed) updates.endTime = parsed;
            }
            if (args.new_location) updates.location = args.new_location;
            await updateEvent(matches[0].id, updates);
            result = { success: true, message: `Updated event "${matches[0].title}"` };
            refetch?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple events. Please be more specific.` };
          }
          break;
        }
        
        case 'delete_event': {
          const query = (args.event_query || '').toLowerCase();
          const matches = events.filter((e: any) => e.title.toLowerCase().includes(query));
          
          if (matches.length === 0) {
            result = { success: false, message: `Could not find event matching "${args.event_query}"` };
          } else if (matches.length === 1 && deleteEvent) {
            await deleteEvent(matches[0].id);
            result = { success: true, message: `Deleted event "${matches[0].title}"` };
            refetch?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple events. Please be more specific.` };
          }
          break;
        }

        // ==================== CONTRACT HANDLERS ====================
        case 'create_contract': {
          if (addContract && args.name) {
            const newContract = await addContract({
              name: args.name,
              provider: args.provider,
              category: args.category || 'subscription',
              costAmount: args.cost_amount,
              costFrequency: args.cost_frequency || 'monthly',
              renewalDate: args.renewal_date ? new Date(args.renewal_date) : undefined,
              autoRenews: args.auto_renews,
              notes: args.notes,
              isActive: true,
            });
            if (newContract) {
              result = { success: true, message: `Added contract "${args.name}"` };
              refetchContracts?.();
            } else {
              result = { success: false, message: 'Failed to create contract' };
            }
          }
          break;
        }
        
        case 'search_contracts': {
          const query = (args.query || '').toLowerCase();
          const category = (args.category || '').toLowerCase();
          
          const matches = contracts.filter((c: any) => {
            const searchable = [c.name, c.provider, c.category, c.notes].filter(Boolean).join(' ').toLowerCase();
            const matchesQuery = !query || searchable.includes(query);
            const matchesCategory = !category || c.category?.toLowerCase() === category;
            return matchesQuery && matchesCategory;
          });
          
          result = {
            success: true,
            message: matches.length > 0 ? `Found ${matches.length} contract(s)` : 'No contracts found',
            contracts: matches.slice(0, 10).map((c: any) => ({
              name: c.name, provider: c.provider, category: c.category,
              cost: c.costAmount ? `$${c.costAmount}/${c.costFrequency}` : null,
              renewalDate: c.renewalDate
            }))
          };
          break;
        }
        
        case 'update_contract': {
          const matches = fuzzyMatchByName(args.contract_query, contracts);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find contract matching "${args.contract_query}"` };
          } else if (matches.length === 1 && updateContract) {
            const updates: Partial<ContractInput> = {};
            if (args.cost_amount !== undefined) updates.costAmount = args.cost_amount;
            if (args.cost_frequency) updates.costFrequency = args.cost_frequency;
            if (args.renewal_date) updates.renewalDate = new Date(args.renewal_date);
            if (args.is_active !== undefined) updates.isActive = args.is_active;
            if (args.notes) updates.notes = args.notes;
            await updateContract(matches[0].id, updates);
            result = { success: true, message: `Updated contract "${matches[0].name}"` };
            refetchContracts?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple contracts. Please be more specific.` };
          }
          break;
        }
        
        case 'delete_contract': {
          const matches = fuzzyMatchByName(args.contract_query, contracts);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find contract matching "${args.contract_query}"` };
          } else if (matches.length === 1 && deleteContract) {
            await deleteContract(matches[0].id);
            result = { success: true, message: `Deleted contract "${matches[0].name}"` };
            refetchContracts?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple contracts. Please be more specific.` };
          }
          break;
        }
        
        case 'get_contract_costs': {
          const active = contracts.filter((c: any) => c.isActive);
          let monthlyTotal = 0;
          let yearlyTotal = 0;
          
          active.forEach((c: any) => {
            if (!c.costAmount) return;
            switch (c.costFrequency) {
              case 'monthly': monthlyTotal += c.costAmount; yearlyTotal += c.costAmount * 12; break;
              case 'quarterly': monthlyTotal += c.costAmount / 3; yearlyTotal += c.costAmount * 4; break;
              case 'yearly': monthlyTotal += c.costAmount / 12; yearlyTotal += c.costAmount; break;
              case 'one-time': yearlyTotal += c.costAmount; break;
            }
          });
          
          result = {
            success: true,
            message: `Your subscriptions cost $${monthlyTotal.toFixed(0)} per month ($${yearlyTotal.toFixed(0)} per year)`,
            monthlyCost: monthlyTotal,
            yearlyCost: yearlyTotal,
            contractCount: active.length
          };
          break;
        }
        
        case 'get_expiring_contracts': {
          const days = args.days || 30;
          const now = new Date();
          const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          
          const expiring = contracts.filter((c: any) => {
            if (!c.isActive || !c.renewalDate) return false;
            const renewal = new Date(c.renewalDate);
            return renewal >= now && renewal <= futureDate;
          });
          
          result = {
            success: true,
            message: expiring.length > 0 ? `You have ${expiring.length} contract(s) expiring in the next ${days} days` : `No contracts expiring in the next ${days} days`,
            contracts: expiring.map((c: any) => ({ name: c.name, renewalDate: c.renewalDate, autoRenews: c.autoRenews }))
          };
          break;
        }

        // ==================== PROJECT HANDLERS ====================
        case 'create_project': {
          if (addProject && args.name) {
            const colorMap: Record<string, string> = {
              'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'yellow': '#eab308',
              'purple': '#a855f7', 'pink': '#ec4899', 'orange': '#f97316', 'cyan': '#06b6d4'
            };
            const color = colorMap[args.color?.toLowerCase()] || args.color || '#3b82f6';
            
            const newProject = await addProject({
              name: args.name,
              description: args.description,
              color,
              isArchived: false,
            });
            if (newProject) {
              result = { success: true, message: `Created project "${args.name}"` };
              refetchProjects?.();
            } else {
              result = { success: false, message: 'Failed to create project' };
            }
          }
          break;
        }
        
        case 'list_projects': {
          if (projects.length === 0) {
            result = { success: true, message: 'You have no projects yet', projects: [] };
          } else {
            const projectStats = projects.map((p: any) => {
              const projectTasks = tasks.filter((t: any) => t.projectId === p.id);
              const completed = projectTasks.filter((t: any) => t.completed).length;
              const total = projectTasks.length;
              return {
                name: p.name,
                description: p.description,
                taskCount: total,
                completedTasks: completed,
                progress: total > 0 ? Math.round((completed / total) * 100) : 0
              };
            });
            result = { success: true, message: `You have ${projects.length} project(s)`, projects: projectStats };
          }
          break;
        }
        
        case 'get_project_status': {
          const matches = fuzzyMatchByName(args.project_query, projects);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find project matching "${args.project_query}"` };
          } else {
            const project = matches[0];
            const projectTasks = tasks.filter((t: any) => t.projectId === project.id);
            const completed = projectTasks.filter((t: any) => t.completed).length;
            const pending = projectTasks.filter((t: any) => !t.completed);
            const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
            
            result = {
              success: true,
              message: `Project "${project.name}" is ${progress}% complete (${completed}/${projectTasks.length} tasks done)`,
              project: { name: project.name, progress, totalTasks: projectTasks.length, completedTasks: completed },
              pendingTasks: pending.slice(0, 5).map((t: any) => ({ title: t.title, priority: t.priority }))
            };
          }
          break;
        }
        
        case 'add_task_to_project': {
          const taskMatches = fuzzyMatchTask(args.task_query, tasks);
          const projectMatches = fuzzyMatchByName(args.project_query, projects);
          
          if (taskMatches.length === 0) {
            result = { success: false, message: `Could not find task matching "${args.task_query}"` };
          } else if (projectMatches.length === 0) {
            result = { success: false, message: `Could not find project matching "${args.project_query}"` };
          } else if (taskMatches.length === 1 && projectMatches.length === 1 && updateTask) {
            await updateTask(taskMatches[0].id, { projectId: projectMatches[0].id });
            result = { success: true, message: `Added "${taskMatches[0].title}" to project "${projectMatches[0].name}"` };
            refetch?.();
            refetchProjects?.();
          } else {
            result = { success: false, message: 'Multiple matches found. Please be more specific.' };
          }
          break;
        }
        
        case 'update_project': {
          const matches = fuzzyMatchByName(args.project_query, projects);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find project matching "${args.project_query}"` };
          } else if (matches.length === 1 && updateProject) {
            const updates: Partial<Project> = {};
            if (args.new_name) updates.name = args.new_name;
            if (args.new_description) updates.description = args.new_description;
            if (args.new_color) {
              const colorMap: Record<string, string> = {
                'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'yellow': '#eab308',
                'purple': '#a855f7', 'pink': '#ec4899', 'orange': '#f97316', 'cyan': '#06b6d4'
              };
              updates.color = colorMap[args.new_color.toLowerCase()] || args.new_color;
            }
            await updateProject(matches[0].id, updates);
            result = { success: true, message: `Updated project "${matches[0].name}"` };
            refetchProjects?.();
          } else {
            result = { success: false, multiple_matches: true, message: `Found multiple projects. Please be more specific.` };
          }
          break;
        }
        
        case 'delete_project': {
          const matches = fuzzyMatchByName(args.project_query, projects);
          if (matches.length === 0) {
            result = { success: false, message: `Could not find project matching "${args.project_query}"` };
          } else if (matches.length === 1 && deleteProject) {
            await deleteProject(matches[0].id);
            result = { success: true, message: `Archived project "${matches[0].name}"` };
            refetchProjects?.();
          } else {
          result = { success: false, multiple_matches: true, message: `Found multiple projects. Please be more specific.` };
          }
          break;
        }

        // ==================== HEALTH HANDLERS ====================
        case 'get_health_summary': {
          const healthData = contextData?.healthData;
          if (!healthData?.isConnected) {
            result = { success: false, message: 'Apple Health is not connected. Please connect it in the Health Hub.' };
          } else {
            const period = args.period || 'today';
            let summary = '';
            
            if (period === 'today' && healthData.todaySummary) {
              const h = healthData.todaySummary;
              summary = `Today's health: ${h.steps?.toLocaleString() || 0} steps, ${h.calories?.toLocaleString() || 0} calories burned`;
              if (h.sleepHours > 0) summary += `, ${h.sleepHours.toFixed(1)} hours sleep`;
              if (h.heartRateAvg > 0) summary += `, avg heart rate ${h.heartRateAvg} bpm`;
              if (h.activeMinutes > 0) summary += `, ${h.activeMinutes} active minutes`;
            } else if (period === 'week' && healthData.weeklyData?.length > 0) {
              const week = healthData.weeklyData;
              const totalSteps = week.reduce((s: number, d: any) => s + (d.steps || 0), 0);
              const avgSteps = Math.round(totalSteps / week.length);
              const avgSleep = week.reduce((s: number, d: any) => s + (d.sleepHours || 0), 0) / week.length;
              summary = `This week (${week.length} days): average ${avgSteps.toLocaleString()} steps/day`;
              if (avgSleep > 0) summary += `, average ${avgSleep.toFixed(1)} hours sleep`;
            } else {
              summary = 'No health data available for this period';
            }
            
            result = { 
              success: true, 
              message: summary,
              data: period === 'today' ? healthData.todaySummary : healthData.weeklyData
            };
          }
          break;
        }

        case 'get_steps': {
          const healthData = contextData?.healthData;
          if (!healthData?.isConnected) {
            result = { success: false, message: 'Apple Health is not connected.' };
          } else {
            const period = args.period || 'today';
            if (period === 'today' && healthData.todaySummary) {
              const steps = healthData.todaySummary.steps || 0;
              result = { success: true, message: `You've taken ${steps.toLocaleString()} steps today.`, steps };
            } else if (period === 'week' && healthData.weeklyData?.length > 0) {
              const week = healthData.weeklyData;
              const totalSteps = week.reduce((s: number, d: any) => s + (d.steps || 0), 0);
              const avgSteps = Math.round(totalSteps / week.length);
              result = { 
                success: true, 
                message: `This week you've averaged ${avgSteps.toLocaleString()} steps per day, with a total of ${totalSteps.toLocaleString()} steps.`,
                avgSteps,
                totalSteps,
                dailyData: week.map((d: any) => ({ date: d.date, steps: d.steps }))
              };
            } else {
              result = { success: true, message: 'No step data available for this period.', steps: 0 };
            }
          }
          break;
        }

        case 'get_sleep_data': {
          const healthData = contextData?.healthData;
          if (!healthData?.isConnected) {
            result = { success: false, message: 'Apple Health is not connected.' };
          } else {
            const period = args.period || 'last_night';
            if ((period === 'last_night' || period === 'today') && healthData.todaySummary) {
              const sleep = healthData.todaySummary.sleepHours || 0;
              if (sleep > 0) {
                result = { success: true, message: `You slept ${sleep.toFixed(1)} hours last night.`, sleepHours: sleep };
              } else {
                result = { success: true, message: 'No sleep data recorded for last night.', sleepHours: 0 };
              }
            } else if (period === 'week' && healthData.weeklyData?.length > 0) {
              const week = healthData.weeklyData.filter((d: any) => d.sleepHours > 0);
              if (week.length > 0) {
                const avgSleep = week.reduce((s: number, d: any) => s + d.sleepHours, 0) / week.length;
                result = { 
                  success: true, 
                  message: `This week you've averaged ${avgSleep.toFixed(1)} hours of sleep per night.`,
                  avgSleepHours: avgSleep,
                  dailyData: week.map((d: any) => ({ date: d.date, sleepHours: d.sleepHours }))
                };
              } else {
                result = { success: true, message: 'No sleep data available for this week.', avgSleepHours: 0 };
              }
            } else {
              result = { success: true, message: 'No sleep data available.', sleepHours: 0 };
            }
          }
          break;
        }

        case 'get_calories': {
          const healthData = contextData?.healthData;
          if (!healthData?.isConnected) {
            result = { success: false, message: 'Apple Health is not connected.' };
          } else {
            const period = args.period || 'today';
            if (period === 'today' && healthData.todaySummary) {
              const calories = healthData.todaySummary.calories || 0;
              result = { success: true, message: `You've burned ${calories.toLocaleString()} calories today.`, calories };
            } else if (period === 'week' && healthData.weeklyData?.length > 0) {
              const week = healthData.weeklyData;
              const totalCals = week.reduce((s: number, d: any) => s + (d.calories || 0), 0);
              const avgCals = Math.round(totalCals / week.length);
              result = { 
                success: true, 
                message: `This week you've averaged ${avgCals.toLocaleString()} calories burned per day.`,
                avgCalories: avgCals,
                totalCalories: totalCals
              };
            } else {
              result = { success: true, message: 'No calorie data available.', calories: 0 };
            }
          }
          break;
        }

        case 'get_heart_rate': {
          const healthData = contextData?.healthData;
          if (!healthData?.isConnected) {
            result = { success: false, message: 'Apple Health is not connected.' };
          } else {
            if (healthData.todaySummary?.heartRateAvg > 0) {
              result = { 
                success: true, 
                message: `Your average heart rate today is ${healthData.todaySummary.heartRateAvg} beats per minute.`,
                heartRate: healthData.todaySummary.heartRateAvg
              };
            } else {
              result = { success: true, message: 'No heart rate data available today.', heartRate: 0 };
            }
          }
          break;
        }

        case 'get_habit_summary': {
          const habitData = contextData?.habitData;
          if (!habitData?.habits?.length) {
            result = { success: false, message: 'You have no habits set up yet. You can create habits in the Habits section.' };
          } else {
            const query = (args.habit_query || '').toLowerCase();
            let habits = habitData.habits;
            
            if (query) {
              habits = habits.filter((h: any) => h.name.toLowerCase().includes(query));
            }
            
            if (habits.length === 0) {
              result = { success: false, message: `No habits found matching "${args.habit_query}".` };
            } else {
              const habitList = habits.slice(0, 5).map((h: any) => `${h.icon} ${h.name}`).join(', ');
              result = { 
                success: true, 
                message: `You have ${habitData.habits.length} active habits: ${habitList}`,
                habits: habits.slice(0, 10)
              };
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('Function call error:', err);
      result = { success: false, message: 'An error occurred while processing' };
    }
    
    // Send function result back to OpenAI
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      }));
      
      // Trigger response generation
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
    
    return result;
  }, [contextData, addTask, updateTask, trashTask, toggleTaskComplete, addContact, updateContact, deleteContact, markContacted, addEvent, updateEvent, deleteEvent, addContract, updateContract, deleteContract, addProject, updateProject, deleteProject, refetch, refetchContacts, refetchContracts, refetchProjects]);

  // Store latest context in refs to avoid reconnection on every context change
  const contextDataRef = useRef(contextData);
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    contextDataRef.current = contextData;
  }, [contextData]);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const connect = useCallback(async () => {
    // Prevent multiple simultaneous connections - bulletproof lock
    if (isConnectingRef.current) {
      console.log('Already connecting, skipping...');
      return;
    }
    if (isConnected) {
      console.log('Already connected, skipping...');
      return;
    }

    // New attempt id for this connection
    const attemptId = ++connectAttemptRef.current;

    const assertStillActive = (stage: string) => {
      if (connectAttemptRef.current !== attemptId) {
        console.log(`Connect attempt cancelled at: ${stage}`);
        throw new Error('Connection cancelled');
      }
    };

    // Set lock IMMEDIATELY before any async work
    isConnectingRef.current = true;

    // Reset state flags
    dcIsOpenRef.current = false;
    rtcReadyRef.current = false;

    const maybeSetConnected = () => {
      if (dcIsOpenRef.current && rtcReadyRef.current) {
        console.log('WebRTC ready + data channel open → connected');
        setIsConnected(true);
        setIsListening(true);
        onConnectionChange?.('connected');
      }
    };

    // Close any existing connections
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    localAudioTrackRef.current = null;

    try {
      onConnectionChange?.('connecting');
      const connectStart = performance.now();
      setDebugTimings({ connectStart });
      console.log('Getting ephemeral token...');

      assertStillActive('before token fetch');
      const tokenFetchStart = performance.now();
      setDebugTimings(prev => ({ ...prev, tokenFetchStart }));

      const { data, error } = await supabase.functions.invoke('openai-realtime-session', {
        body: { userProfile: userProfileRef.current, contextData: contextDataRef.current },
      });

      assertStillActive('after token fetch');
      const tokenFetchEnd = performance.now();
      setDebugTimings(prev => ({ ...prev, tokenFetchEnd }));

      if (error || !data?.client_secret?.value) {
        throw new Error(error?.message || 'Failed to get session token');
      }

      const EPHEMERAL_KEY = data.client_secret.value;
      console.log('Got ephemeral token, establishing WebRTC...');

      assertStillActive('before pc init');
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.muted = speakerMutedRef.current;
      audioElRef.current = audioEl;

      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioQueueRef.current = new AudioQueue(audioContextRef.current, {
        onPlaybackStart: () => {
          if (speakerMutedRef.current) return;
          setIsSpeaking(true);
          onSpeakingChange?.(true);
        },
        onPlaybackEnd: () => {
          setIsSpeaking(false);
          onSpeakingChange?.(false);
        },
      });

      pc.ontrack = (e) => {
        console.log('Received audio track');
        audioEl.srcObject = e.streams[0];
      };

      assertStillActive('before mic permission');
      const micPermissionStart = performance.now();
      setDebugTimings(prev => ({ ...prev, micPermissionStart }));

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = ms;

      assertStillActive('after mic permission');
      const micPermissionEnd = performance.now();
      setDebugTimings(prev => ({ ...prev, micPermissionEnd }));

      const track = ms.getTracks()[0];
      localAudioTrackRef.current = track;
      track.enabled = !micMutedRef.current;

      // If we were cancelled while the browser prompt was open, the pc may be closed already
      if (pc.signalingState === 'closed') {
        throw new Error('Peer connection closed before track could be added');
      }

      pc.addTrack(track);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.addEventListener('open', () => {
        console.log('Data channel opened');
        dcIsOpenRef.current = true;
        setDebugTimings(prev => ({ ...prev, dataChannelOpen: performance.now() }));
        maybeSetConnected();
      });

      dc.addEventListener('message', async (e) => {
        const event = JSON.parse(e.data);
        console.log('Received event:', event.type);

        switch (event.type) {
          case 'input_audio_buffer.speech_started':
            currentTranscriptRef.current = '';
            break;

          case 'conversation.item.input_audio_transcription.completed': {
            const userText = event.transcript || '';
            currentTranscriptRef.current = userText;
            onTranscript?.(userText, true);
            break;
          }

          case 'response.audio_transcript.delta':
            onResponse?.(event.delta || '');
            break;

          case 'response.audio.delta':
            if (event.delta) {
              if (speakerMutedRef.current) break;
              // Record first audio received timing
              setDebugTimings(prev => {
                if (!prev.firstAudioReceived) {
                  return { ...prev, firstAudioReceived: performance.now() };
                }
                return prev;
              });
              setIsSpeaking(true);
              onSpeakingChange?.(true);
              const binaryString = atob(event.delta);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              audioQueueRef.current?.addToQueue(bytes);
            }
            break;

          case 'response.audio.done':
            setTimeout(() => {
              setIsSpeaking(false);
              onSpeakingChange?.(false);
            }, 500);
            break;

          case 'response.function_call_arguments.delta':
            if (!pendingFunctionCallRef.current) {
              pendingFunctionCallRef.current = {
                name: event.name || '',
                callId: event.call_id || '',
                args: '',
              };
            }
            pendingFunctionCallRef.current.args += event.delta || '';
            break;

          case 'response.function_call_arguments.done':
            if (pendingFunctionCallRef.current || event.arguments) {
              const fnName = pendingFunctionCallRef.current?.name || event.name;
              const fnArgs = event.arguments || pendingFunctionCallRef.current?.args || '{}';
              const callId = event.call_id || pendingFunctionCallRef.current?.callId;

              try {
                const parsedArgs = JSON.parse(fnArgs);
                await handleFunctionCall(fnName, parsedArgs, callId);
              } catch (err) {
                console.error('Error parsing function args:', err);
              }
              pendingFunctionCallRef.current = null;
            }
            break;

          case 'error':
            console.error('OpenAI error:', event.error);
            onError?.(event.error?.message || 'Unknown error');
            break;
        }
      });

      dc.addEventListener('close', () => {
        console.log('Data channel closed');
        dcIsOpenRef.current = false;
        rtcReadyRef.current = false;
        setIsConnected(false);
        setIsListening(false);
        onConnectionChange?.('disconnected');
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';

      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp',
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Failed to connect to OpenAI: ${sdpResponse.status}`);
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };

      await pc.setRemoteDescription(answer);
      assertStillActive('after remote SDP');
      console.log('WebRTC connection established');
      setDebugTimings(prev => ({ ...prev, remoteSdpSet: performance.now() }));
      rtcReadyRef.current = true;
      maybeSetConnected();
      isConnectingRef.current = false;
    } catch (err) {
      console.error('Connection error:', err);

      // Important: fully cleanup partially-initialized WebRTC so a retry can't overlap
      isConnectingRef.current = false;
      dcIsOpenRef.current = false;
      rtcReadyRef.current = false;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      localAudioTrackRef.current = null;

      audioRecorderRef.current?.stop();
      audioRecorderRef.current = null;

      audioQueueRef.current?.clear();

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }

      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      if (audioElRef.current) {
        audioElRef.current.srcObject = null;
        audioElRef.current = null;
      }

      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);

      onConnectionChange?.('error');
      onError?.(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [handleFunctionCall, isConnected, onConnectionChange, onError, onResponse, onSpeakingChange, onTranscript]);

  const cleanupConnection = useCallback((opts?: { emitDisconnected?: boolean }) => {
    const emitDisconnected = opts?.emitDisconnected ?? true;

    console.log('Cleaning up connection...');
    // Increment connectAttemptRef to cancel any in-flight connection attempts
    connectAttemptRef.current++;
    isConnectingRef.current = false;
    dcIsOpenRef.current = false;
    rtcReadyRef.current = false;

    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    localAudioTrackRef.current = null;

    audioRecorderRef.current?.stop();
    audioRecorderRef.current = null;

    audioQueueRef.current?.clear();

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }

    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);

    if (emitDisconnected) onConnectionChange?.('disconnected');
  }, [onConnectionChange]);

  const disconnect = useCallback(() => {
    const hasAnythingToClose =
      !!pcRef.current ||
      !!dcRef.current ||
      !!localStreamRef.current ||
      !!audioContextRef.current ||
      isConnectingRef.current ||
      isConnected;

    if (!hasAnythingToClose) return;

    console.log('Disconnecting...');
    cleanupConnection({ emitDisconnected: true });
    setDebugTimings({});
  }, [cleanupConnection, isConnected]);

  const sendTextMessage = useCallback((text: string) => {
    if (!dcRef.current || dcRef.current.readyState !== 'open') {
      console.warn('Data channel not ready');
      return;
    }

    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    }));

    dcRef.current.send(JSON.stringify({ type: 'response.create' }));
  }, []);

  const setSpeakerMuted = useCallback((muted: boolean) => {
    speakerMutedRef.current = muted;
    if (audioElRef.current) audioElRef.current.muted = muted;
    if (muted) {
      audioQueueRef.current?.clear();
      setIsSpeaking(false);
      onSpeakingChange?.(false);
    }
  }, [onSpeakingChange]);

  const setMicMuted = useCallback((muted: boolean) => {
    micMutedRef.current = muted;
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enabled = !muted;
    }
  }, []);

  // Note: We intentionally do NOT auto-disconnect on unmount here.
  // GhostMode handles cleanup via its own useEffect calling disconnect().
  // Removing the cleanup useEffect entirely caused React hooks order errors,
  // so we keep a no-op useEffect to maintain consistent hook count.
  useEffect(() => {
    // Cleanup is handled by GhostMode component
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    connect,
    disconnect,
    sendTextMessage,
    setSpeakerMuted,
    setMicMuted,
    debugTimings,
  };
}
