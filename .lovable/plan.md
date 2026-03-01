
# Unify Text Mode and Voice Mode: Full Feature Parity

## Problem
Text mode (chat) and voice mode have diverged significantly. Voice mode has **far more capabilities** than text mode:

### Voice mode CAN do but text mode CANNOT:
- **Contacts**: Search, create, update, delete, mark contacted, get contacts due
- **Contracts**: Search, create, update, delete, get costs, get expiring
- **Projects**: Create, list, get status, add tasks to project, update, delete
- **Habits**: Create, log as done, delete
- **Health**: Get health summary, steps, sleep, calories, heart rate
- **Email**: Get inbox summary, search emails
- **Messaging**: Send chat messages to contacts
- **Calls**: Initiate calls to contacts
- **Startup brainstorming**: Brainstorm, save, list ideas
- **Notes**: Search, delete (text can create but not search/delete)
- **Tasks**: Search, get summaries, reschedule, edit (text can add/complete/delete but not search or reschedule)

### Text mode CAN do but voice mode already covers:
- Add tasks, schedule events, create notes, add shopping items (voice has all these too)

**Root cause**: Text mode uses XML-tag-based tool markup parsed client-side, while voice mode uses OpenAI native function calling. The XML tool set was never expanded to match voice's tool set.

## Solution
Add the missing tools to text mode by:
1. Expanding the system prompt in `chat/index.ts` with new XML tool definitions
2. Expanding the parser in `useAIChat.ts` to recognize the new XML tool tags
3. Expanding the handler in `Index.tsx` to execute the new tool calls

## Changes

### 1. `supabase/functions/chat/index.ts` -- Add new XML tool definitions to system prompt

Add these new tool definitions alongside the existing ones (manage_task, schedule_event, create_note, add_shopping_item):

- **manage_contact**: `<tool>manage_contact</tool><action>create|update|delete|mark_contacted|search</action><contact>JSON</contact>`
  - Fields: name, email, phone, company, role, city, country, contactType, notes, query (for search/update/delete)

- **manage_contract**: `<tool>manage_contract</tool><action>create|update|delete|search|get_costs</action><contract>JSON</contract>`
  - Fields: name, provider, category, costAmount, costFrequency, renewalDate, autoRenews, notes, query

- **manage_project**: `<tool>manage_project</tool><action>create|update|delete|list|get_status</action><project>JSON</project>`
  - Fields: name, description, color, query

- **manage_habit**: `<tool>manage_habit</tool><action>create|log|delete|summary</action><habit>JSON</habit>`
  - Fields: name, description, icon, frequency, targetCount, query

- **manage_note** (extend existing create_note): `<tool>manage_note</tool><action>create|search|delete</action><note>JSON</note>`
  - Fields: title, content, tags, query

- **compose_email**: `<tool>compose_email</tool><email>JSON</email>`
  - Fields: to, subject, body (for drafting a reply or new email)

- **get_summary**: `<tool>get_summary</tool><type>health|email|contacts_due|contract_costs|habits</type>`
  - For read-only summaries that return data from context

Also update the system prompt capabilities section to mention all these features.

### 2. `src/hooks/useAIChat.ts` -- Add parsers for new tool XML tags

Add regex parsers for each new tool tag in `parseToolCalls()`:
- `manage_contact` with action extraction
- `manage_contract` with action extraction
- `manage_project` with action extraction
- `manage_habit` with action extraction
- `manage_note` (update existing create_note to support actions)
- `compose_email`
- `get_summary`

Update the `ToolCall` interface to include new tool types and their associated data shapes.

### 3. `src/pages/Index.tsx` -- Add tool call handlers

In the `onToolCall` handler (around line 553), add cases for:
- `manage_contact`: Call addContact/updateContact/deleteContact/markContacted from useContacts
- `manage_contract`: Call addContract/updateContract/deleteContract from useContracts
- `manage_project`: Call addProject/updateProject/deleteProject from useProjects
- `manage_habit`: Call createHabit/logHabit/deleteHabit (need to wire up habit hooks)
- `manage_note`: Call createNote/deleteNote (search returns from context)
- `compose_email`: Open compose sheet or draft email
- `get_summary`: Return data from existing context (health, emails, contacts due, etc.)

Need to import and wire up hooks that aren't currently used in Index.tsx: useHabits (or the existing todayHabits data), useProjects, useContracts (check if already available).

### 4. `src/lib/smartPayloadBuilder.ts` -- No changes needed
The smart payload builder already handles context injection for all data types. The text mode already receives contacts, contracts, emails, notes, habits, and family context when relevant keywords are detected.

## Files to Modify
1. `supabase/functions/chat/index.ts` -- Add ~15 new tool definitions to system prompt
2. `src/hooks/useAIChat.ts` -- Add ~7 new XML tag parsers + update ToolCall interface  
3. `src/pages/Index.tsx` -- Add ~6 new tool call handlers in onToolCall callback

## Technical Notes
- Text mode uses Gemini (via Lovable API) which handles XML tool tags well
- The XML tag pattern is already proven with manage_task, schedule_event, create_note
- All hooks (useContacts, useContracts, useProjects, useNotes, useHabits) are already imported or available in Index.tsx
- Email compose will open the compose sheet UI rather than sending directly (matching the existing email UX)
- Health summaries are read-only from context already present in the payload
- No database changes needed -- all CRUD operations use existing hooks and tables
