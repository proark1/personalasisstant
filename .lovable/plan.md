

# Unify Voice and Text Mode Data Access

## Problem
Voice mode and text mode have different data access -- each has things the other lacks:

**Voice mode is missing:**
- Email data (no `useEmails` hook, no email tools)
- Family context (children, spouse, school info, activities, shopping lists)
- Shopping list data

**Text mode is missing:**
- Tool-based actions (create/delete/search tasks, contacts, etc.) -- this is by design since text mode uses XML tool markup instead
- Startup brainstorming tools -- also by design

The main fix is giving voice mode the same data text mode has: emails, family, and shopping lists.

## Changes

### 1. GhostMode.tsx -- Add missing data hooks
- Import `useEmails` to get email data
- Import `useFamilyMembers` and `useFamilyContext` to get family data
- Import `useShoppingLists` to get shopping list data
- Add all of this to the `contextData` useMemo so it's sent to the OpenAI Realtime session

### 2. openai-realtime-session/index.ts -- Add email tools and family/email context to system prompt
- Add two new tools: `get_email_summary` (get unread emails) and `search_emails` (search by sender/subject)
- Update `buildSystemPrompt` to include:
  - Email/Inbox capabilities section
  - Unread email data when present in contextData
  - Family member details (children, spouse, schools, activities, allergies)
  - Family schedule (today/tomorrow events)
  - Shopping lists
- Add "Email/Inbox" to the capabilities list in the system prompt

### 3. GhostMode.tsx -- Handle email and family tool responses
- Add handlers in the tool call response section for `get_email_summary` and `search_emails`
- These are read-only tools that return data from the already-loaded context

## Technical Details

### GhostMode.tsx contextData additions
```text
// New imports
useEmails, useFamilyMembers, useFamilyContext, useShoppingLists

// New contextData fields
unreadEmails: emails filtered to unread, mapped to { subject, from, snippet, category, priority }
totalUnreadEmails: count
familyMembers: from useFamilyMembers (name, relationship, age, school, activities, allergies)
familyEvents: from useFamilyContext (today/tomorrow events)
shoppingLists: from useShoppingLists (active lists with item counts)
```

### openai-realtime-session/index.ts new tools
- `get_email_summary`: Returns unread count and top emails from context
- `search_emails`: Fuzzy search emails by sender/subject keyword from context

### openai-realtime-session/index.ts buildSystemPrompt additions
- Add "Email/Inbox" to capabilities list with: view unread emails, search emails, summarize inbox
- Render unread emails section if contextData.unreadEmails exists
- Render family members section if contextData.familyMembers exists (same format as text mode's chat/index.ts)
- Render family schedule if contextData.familyEvents exists
- Render shopping lists if contextData.shoppingLists exists

### Files to modify
1. `src/components/ghost/GhostMode.tsx` -- add hooks + contextData + tool handlers
2. `supabase/functions/openai-realtime-session/index.ts` -- add tools + system prompt sections

### No database changes needed
All data sources already exist. This is purely wiring existing hooks into the voice pipeline.

