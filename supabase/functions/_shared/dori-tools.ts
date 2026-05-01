// Native function-calling tool schemas.
//
// Until now Dori emitted tools via XML tags inside the assistant's text:
//   <tool>manage_task</tool><action>add</action><task>{...}</task>
//
// The server-side executor parses those tags. That works, but it has
// real downsides:
//   - Models occasionally produce malformed XML, splitting payloads
//     across markdown fences, escaping JSON inside `<task>`, etc.
//   - The same tool can't be invoked twice cleanly in one response —
//     parser state machines vs. real JSON arrays.
//   - Streamed deltas leak XML to surfaces that forget to filter.
//
// Native function-calling fixes all three. Most modern model APIs
// (Gemini via Lovable's gateway, OpenAI, Anthropic-via-bedrock) accept
// an OpenAI-style `tools` array and return structured `tool_calls` on
// the message. The XML path stays as a fallback so we don't break
// existing surfaces in flight; we prefer native when present.

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

const taskFields = {
  title: { type: 'string', description: 'Task title' },
  category: { type: 'string', enum: ['business', 'personal', 'family', 'shared'] },
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  dueDate: { type: 'string', description: 'ISO date string when the task is due' },
  recurrenceRule: { type: 'string', description: 'RRULE string (e.g. FREQ=WEEKLY;INTERVAL=2)' },
  assignee: { type: 'string', description: 'Workspace member display name (workspace mode only)' },
  id: { type: 'string', description: 'Task id, required for update/delete/complete' },
};

const eventFields = {
  title: { type: 'string' },
  startTime: { type: 'string', description: 'ISO datetime' },
  endTime: { type: 'string', description: 'ISO datetime' },
  location: { type: 'string' },
  attendees: { type: 'array', items: { type: 'string' } },
  recurrenceRule: { type: 'string' },
  assignee: { type: 'string' },
};

export const NATIVE_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'manage_task',
      description: 'Create, update, complete, or delete a task. Always set dueDate when the user mentions any time reference.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'update', 'delete', 'complete'] },
          task: { type: 'object', properties: taskFields },
        },
        required: ['action', 'task'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_event',
      description: 'Create a calendar event. Use this for new events; use manage_event to update or delete existing ones.',
      parameters: {
        type: 'object',
        properties: { event: { type: 'object', properties: eventFields } },
        required: ['event'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_event',
      description: 'Update or delete an existing calendar event by fuzzy match on title.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['update', 'delete', 'search'] },
          event: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Title fragment to find the event' },
              ...eventFields,
            },
            required: ['query'],
          },
        },
        required: ['action', 'event'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_time',
      description: 'Workspace mode only. Returns 3-5 free slots when all named participants are available.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'object',
            properties: {
              participants: { type: 'array', items: { type: 'string' } },
              durationMinutes: { type: 'number' },
              withinDays: { type: 'number', description: 'default 7' },
              workStartHour: { type: 'number', description: 'default 9' },
              workEndHour: { type: 'number', description: 'default 18' },
            },
            required: ['participants', 'durationMinutes'],
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_note',
      description: 'Create, search, or delete notes.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'search', 'delete'] },
          note: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              query: { type: 'string', description: 'For search/delete' },
            },
          },
        },
        required: ['action', 'note'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_contact',
      description: 'Create, update, delete, search a contact, or mark one as contacted.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete', 'mark_contacted', 'search'] },
          contact: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              company: { type: 'string' },
              role: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              contactType: { type: 'string', enum: ['personal', 'business', 'family'] },
              notes: { type: 'string' },
              query: { type: 'string' },
            },
          },
        },
        required: ['action', 'contact'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_contract',
      description: 'Manage contracts/subscriptions.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'update', 'delete', 'search', 'get_costs'] },
          contract: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              provider: { type: 'string' },
              category: { type: 'string' },
              costAmount: { type: 'number' },
              costFrequency: { type: 'string', enum: ['monthly', 'yearly', 'weekly'] },
              renewalDate: { type: 'string' },
              autoRenews: { type: 'boolean' },
              notes: { type: 'string' },
              query: { type: 'string' },
            },
          },
        },
        required: ['action', 'contract'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: 'Set a one-off timed reminder for the user.',
      parameters: {
        type: 'object',
        properties: {
          reminder: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              triggerAt: { type: 'string', description: 'ISO datetime when to fire' },
            },
            required: ['message', 'triggerAt'],
          },
        },
        required: ['reminder'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_shopping_item',
      description: 'Add, remove, or clear items on the family shopping list. Use action="remove" with a name to delete a single item (fuzzy match), or action="clear" to empty all unchecked items.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['add', 'remove', 'clear'], description: 'Defaults to "add" if omitted.' },
          item: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              category: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compose_email',
      description: 'Draft an email for the user to review (does NOT send).',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['to', 'subject', 'body'],
          },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Send an email via the user connected Gmail account. Always shown to the user for confirmation first.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'object',
            properties: {
              to: { type: 'string' },
              subject: { type: 'string' },
              body: { type: 'string' },
              threadId: { type: 'string' },
              gmailMessageId: { type: 'string' },
            },
            required: ['to', 'subject', 'body'],
          },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for real-time / factual / news information outside the user personal data.',
      parameters: {
        type: 'object',
        properties: { q: { type: 'string', description: 'Search query' } },
        required: ['q'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: 'Persist a long-term fact / preference / pattern about the user. Silent — do not announce.',
      parameters: {
        type: 'object',
        properties: {
          memory: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['preference', 'fact', 'pattern', 'goal', 'milestone'] },
              key: { type: 'string', description: 'snake_case unique key' },
              value: { type: 'string' },
              category: { type: 'string' },
            },
            required: ['type', 'key', 'value'],
          },
        },
        required: ['memory'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'learn_preference',
      description: 'Silently record an inferred preference. Persisted to dori_learned_preferences.',
      parameters: {
        type: 'object',
        properties: {
          pref: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
              confidence: { type: 'number', description: '0-1' },
              source: { type: 'string' },
            },
            required: ['key', 'value'],
          },
        },
        required: ['pref'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_habit',
      description: 'Create, log today, delete, or summarise habits & streaks.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'log', 'delete', 'summary'] },
          habit: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              query: { type: 'string', description: 'Used by log/delete/summary to fuzzy-match' },
              frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
              target_count: { type: 'number' },
              count: { type: 'number', description: 'completed_count for log' },
              icon: { type: 'string' }, color: { type: 'string' },
            },
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_wellbeing',
      description: 'Log mood, energy, sleep hours, water, exercise, stress for today. Send only fields the user mentioned.',
      parameters: {
        type: 'object',
        properties: {
          wellbeing: {
            type: 'object',
            properties: {
              mood: { description: '1-5 number or low/mid/high' },
              energy_level: {},
              sleep_hours: { type: 'number' },
              water_glasses: { type: 'number', description: '1 glass = 250ml' },
              exercise_minutes: { type: 'number' },
              stress_level: { type: 'number' },
              checkin_type: { type: 'string', enum: ['morning', 'evening'] },
              notes: { type: 'string' },
            },
          },
        },
        required: ['wellbeing'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'manage_goal',
      description: 'Create, update progress on (use add or current_value), list, or delete a long-term goal.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['create', 'progress', 'list', 'delete'] },
          goal: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              query: { type: 'string' },
              description: { type: 'string' },
              target_value: { type: 'number' },
              current_value: { type: 'number' },
              add: { type: 'number', description: 'Increment current by this amount' },
              unit: { type: 'string' },
              target_date: { type: 'string', description: 'YYYY-MM-DD' },
            },
          },
        },
        required: ['action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_reschedule',
      description: 'Shift many open tasks at once. Use filter.when (today|overdue|tomorrow) or filter.date, plus shift_days.',
      parameters: {
        type: 'object',
        properties: {
          bulk: {
            type: 'object',
            properties: {
              filter: { type: 'object', properties: { when: { type: 'string', enum: ['today', 'overdue', 'tomorrow'] }, date: { type: 'string' } } },
              shift_days: { type: 'number' },
            },
            required: ['shift_days'],
          },
        },
        required: ['bulk'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bulk_delete_events',
      description: 'Cancel ALL events on a specific date for the user.',
      parameters: {
        type: 'object',
        properties: {
          bulk: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'] },
        },
        required: ['bulk'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_note',
      description: 'Append content to an existing note found by title fragment (does not create a new note).',
      parameters: {
        type: 'object',
        properties: {
          note: {
            type: 'object',
            properties: { query: { type: 'string' }, content: { type: 'string' } },
            required: ['query', 'content'],
          },
        },
        required: ['note'],
      },
    },
  },
  // ============= Phase 2: 19 new tools =============
  {
    type: 'function',
    function: {
      name: 'task_filter',
      description: 'List tasks with filters (status, priority, tag, due range). Use for "show my high-priority tasks", "what is tagged work".',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { status: { type: 'string' }, priority: { type: 'string' }, tag: { type: 'string' }, when: { type: 'string', enum: ['today','tomorrow','overdue','week'] } } } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_tag',
      description: 'Add or remove tags on a task (fuzzy match by query).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { query: { type: 'string' }, add: { type: 'array', items: { type: 'string' } }, remove: { type: 'array', items: { type: 'string' } } }, required: ['query'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_estimate',
      description: 'Set an estimated minutes value on a task.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { query: { type: 'string' }, minutes: { type: 'number' } }, required: ['query','minutes'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete_note',
      description: 'Complete a task and attach a short completion note.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { query: { type: 'string' }, note: { type: 'string' } }, required: ['query','note'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_duplicate',
      description: 'Duplicate a task (optionally with a new title or due date).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { query: { type: 'string' }, title: { type: 'string' }, dueDate: { type: 'string' } }, required: ['query'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_subtask',
      description: 'Add a subtask under an existing parent task (matched by query).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { parentQuery: { type: 'string' }, title: { type: 'string' } }, required: ['parentQuery','title'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_assign',
      description: 'Assign or reassign a task to a workspace member by display name.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { query: { type: 'string' }, assignee: { type: 'string' } }, required: ['query','assignee'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'summarize_emails',
      description: 'Summarize recent unread emails (top N) into a brief digest.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { limit: { type: 'number' } } } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'email_action',
      description: 'Perform an action on an email: star, unstar, archive, trash, snooze, mark_read, mark_unread, forward, unsubscribe.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { messageId: { type: 'string' }, query: { type: 'string', description: 'Subject fragment if no messageId' }, action: { type: 'string', enum: ['star','unstar','archive','trash','snooze','mark_read','mark_unread','forward','unsubscribe'] }, snoozeUntil: { type: 'string', description: 'ISO datetime for snooze' }, forwardTo: { type: 'string' } }, required: ['action'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'period_log',
      description: 'Log a period entry (start/end, flow, symptoms).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { date: { type: 'string' }, flow: { type: 'string', enum: ['light','medium','heavy'] }, symptoms: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fasting_log',
      description: 'Log a fast (start/end times, type).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { startedAt: { type: 'string' }, endedAt: { type: 'string' }, type: { type: 'string' }, notes: { type: 'string' } } } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pantry',
      description: 'Manage household pantry inventory: add, remove, list, check low-stock.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { action: { type: 'string', enum: ['add','remove','list','low'] }, name: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, lowThreshold: { type: 'number' } }, required: ['action'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flight_track',
      description: 'Add a flight to track (number, date) and set arrival/departure reminders.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { flightNumber: { type: 'string' }, date: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['flightNumber','date'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'presence',
      description: 'Set or query household presence ("home", "away", "work", "travel").',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { action: { type: 'string', enum: ['set','get'] }, status: { type: 'string' }, location: { type: 'string' } }, required: ['action'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'budget',
      description: 'Set or check a monthly category budget.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { action: { type: 'string', enum: ['set','check','list'] }, category: { type: 'string' }, amount: { type: 'number' }, month: { type: 'string', description: 'YYYY-MM, defaults to current' } }, required: ['action'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'meds',
      description: 'Log a medication taken or set a recurring med reminder.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { action: { type: 'string', enum: ['log','schedule','list'] }, name: { type: 'string' }, dose: { type: 'string' }, time: { type: 'string' } }, required: ['action'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'zakat',
      description: 'Calculate Zakat on a wealth amount (2.5%).',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { wealth: { type: 'number' }, currency: { type: 'string' } }, required: ['wealth'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'timezone',
      description: 'Look up the current local time / timezone for a city.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } }, required: ['data'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'currency',
      description: 'Convert an amount between currencies via Frankfurter API.',
      parameters: { type: 'object', properties: { data: { type: 'object', properties: { amount: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['amount','from','to'] } }, required: ['data'] },
    },
  },
];

// Convert a native tool_calls array (OpenAI-style) into the legacy XML
// blob the existing executeToolsServerSide() parser already handles.
// This lets us flip the model to native function-calling without
// rewriting 30 tool handlers — the executor is reused as-is.
export function toolCallsToLegacyXml(toolCalls: Array<{ id?: string; function: { name: string; arguments: string } }>): string {
  if (!toolCalls?.length) return '';
  const parts: string[] = [];
  for (const tc of toolCalls) {
    const name = tc.function?.name;
    let args: any;
    try {
      args = JSON.parse(tc.function?.arguments || '{}');
    } catch {
      // No naive single-quote-to-double-quote repair: it corrupts any
      // string value that legitimately contains an apostrophe (e.g.
      // {"text": "It's fine"}). If JSON.parse fails, the model
      // misformatted the call — drop it rather than silently mangle
      // the payload.
      console.warn('[toolCallsToLegacyXml] could not parse args for', name);
      continue;
    }
    parts.push(renderLegacy(name, args));
  }
  return parts.filter(Boolean).join('\n');
}

function renderLegacy(name: string, args: any): string {
  // Map back to the XML shape the existing parser expects. Each tool has
  // its own outer/inner tag pair — see the table inside chat/index.ts.
  switch (name) {
    case 'manage_task':
      return `<tool>manage_task</tool><action>${args.action}</action><task>${JSON.stringify(args.task ?? {})}</task>`;
    case 'schedule_event':
      return `<tool>schedule_event</tool><event>${JSON.stringify(args.event ?? {})}</event>`;
    case 'manage_event':
      return `<tool>manage_event</tool><action>${args.action}</action><event>${JSON.stringify(args.event ?? {})}</event>`;
    case 'find_time':
      return `<tool>find_time</tool><query>${JSON.stringify(args.query ?? {})}</query>`;
    case 'manage_note':
      return `<tool>manage_note</tool><action>${args.action}</action><note>${JSON.stringify(args.note ?? {})}</note>`;
    case 'manage_contact':
      return `<tool>manage_contact</tool><action>${args.action}</action><contact>${JSON.stringify(args.contact ?? {})}</contact>`;
    case 'manage_contract':
      return `<tool>manage_contract</tool><action>${args.action}</action><contract>${JSON.stringify(args.contract ?? {})}</contract>`;
    case 'set_reminder':
      return `<tool>set_reminder</tool><reminder>${JSON.stringify(args.reminder ?? {})}</reminder>`;
    case 'add_shopping_item':
      return `<tool>add_shopping_item</tool><action>${args.action || 'add'}</action><item>${JSON.stringify(args.item ?? {})}</item>`;
    case 'compose_email':
      return `<tool>compose_email</tool><email>${JSON.stringify(args.email ?? {})}</email>`;
    case 'send_email':
      return `<tool>send_email</tool><email>${JSON.stringify(args.email ?? {})}</email>`;
    case 'web_search':
      return `<tool>web_search</tool><query>${JSON.stringify({ q: args.q })}</query>`;
    case 'save_memory':
      return `<tool>save_memory</tool><memory>${JSON.stringify(args.memory ?? {})}</memory>`;
    case 'learn_preference':
      return `<tool>learn_preference</tool><pref>${JSON.stringify(args.pref ?? {})}</pref>`;
    case 'manage_habit':
      return `<tool>manage_habit</tool><action>${args.action}</action><habit>${JSON.stringify(args.habit ?? {})}</habit>`;
    case 'log_wellbeing':
      return `<tool>log_wellbeing</tool><wellbeing>${JSON.stringify(args.wellbeing ?? {})}</wellbeing>`;
    case 'manage_goal':
      return `<tool>manage_goal</tool><action>${args.action}</action><goal>${JSON.stringify(args.goal ?? {})}</goal>`;
    case 'bulk_reschedule':
      return `<tool>bulk_reschedule</tool><bulk>${JSON.stringify(args.bulk ?? {})}</bulk>`;
    case 'bulk_delete_events':
      return `<tool>bulk_delete_events</tool><bulk>${JSON.stringify(args.bulk ?? {})}</bulk>`;
    case 'append_note':
      return `<tool>append_note</tool><note>${JSON.stringify(args.note ?? {})}</note>`;
    case 'task_filter':
    case 'task_tag':
    case 'task_estimate':
    case 'task_complete_note':
    case 'task_duplicate':
    case 'task_subtask':
    case 'task_assign':
    case 'summarize_emails':
    case 'email_action':
    case 'period_log':
    case 'fasting_log':
    case 'pantry':
    case 'flight_track':
    case 'presence':
    case 'budget':
    case 'meds':
    case 'zakat':
    case 'timezone':
    case 'currency':
      return `<tool>${name}</tool><data>${JSON.stringify(args.data ?? {})}</data>`;
    default:
      console.warn('[toolCallsToLegacyXml] unknown tool name', name);
      return '';
  }
}
