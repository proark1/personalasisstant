

# Make Dori AI Assistant More Intelligent & Helpful

## Current State

Dori is already feature-rich: 15+ tools (tasks, events, contacts, contracts, habits, notes, email, reminders, shopping, projects, web search, memory), streaming responses, smart context injection, Perplexity web search, and long-term memory. The model used is `google/gemini-2.5-flash`.

## Issues Identified

1. **Model too weak for complex reasoning** — Using `gemini-2.5-flash` which is optimized for speed, not intelligence. For a personal assistant that needs to reason about schedules, prioritize tasks, and give nuanced advice, a stronger model would dramatically improve quality.

2. **Two-pass web search wastes tokens and adds latency** — The edge function does a non-streaming first pass to detect `<tool>web_search</tool>`, executes the search, then does a second streaming pass. This doubles AI calls for every web search query and adds 2-5 seconds of latency.

3. **Tool calls parsed via brittle XML regex** — The client-side `useAIChat.ts` parses `<tool>...</tool><action>...</action><task>{...}</task>` via regex. This is fragile — partial JSON across SSE chunks can break parsing, and the AI sometimes formats XML slightly differently, causing missed tool calls.

4. **No follow-up intelligence** — After executing a tool (e.g., creating a task), Dori doesn't proactively suggest next steps. Example: after adding "Prepare presentation", it should suggest "Would you like me to break this down into subtasks?"

5. **Context window bloat** — The system prompt alone is ~4000 tokens before any user context. Health data, family data, events, tasks all get appended verbatim. A 50-metric health history adds ~1000 tokens even when the user asks "add milk to shopping list".

6. **No conversation summarization for long sessions** — After 20 messages, the full history is sent. No summarization of older messages to save tokens.

7. **Empty state suggestions are static** — Time-based suggestions ("Plan my morning") don't adapt to actual user data (e.g., if there are overdue tasks, the suggestion should be "You have 3 overdue tasks").

---

## Plan

### 1. Upgrade to stronger model
Change the chat edge function from `google/gemini-2.5-flash` to `google/gemini-3-flash-preview` — better reasoning, same speed tier, significantly more capable for complex multi-tool interactions and nuanced advice.

**File:** `supabase/functions/chat/index.ts`

### 2. Add follow-up suggestions after tool execution
After Dori executes a tool call, inject follow-up prompts into the response. Add a `FOLLOW_UP_RULES` section to the system prompt:
- After creating a task → suggest breakdown or scheduling
- After creating an event → ask about reminders or invites
- After noting overdue tasks → offer to reschedule
- After health summary → suggest actionable next steps

**File:** `supabase/functions/chat/index.ts` (system prompt addition)

### 3. Smarter context injection — trim unused data
Reduce context bloat by:
- Limiting health metrics to top 5 most recent per type (not 50)
- Only sending weekly trends when health-related keywords detected
- Capping events to next 7 days by default (not 30)
- Truncating the system prompt: merge redundant guideline sections

**File:** `supabase/functions/chat/index.ts`, `src/lib/smartPayloadBuilder.ts`

### 4. Conversation summarization for long sessions
When conversation exceeds 12 messages, summarize older messages (messages 1-8) into a single context line before sending to the AI. This keeps token usage bounded while preserving continuity.

**File:** `src/pages/Index.tsx` (in `handleSendMessage` where `conversationMessages` is built)

### 5. Dynamic empty state suggestions
Replace static time-based suggestions with data-aware ones:
- If overdue tasks exist → "I have X overdue tasks"
- If unread emails → "Check my unread emails"
- If habit streaks at risk → "How are my habits?"
- If upcoming event today → "What's on my calendar?"

**File:** `src/components/assistant/DoriPanel.tsx`

### 6. Improve tool reliability with structured output
Add a `tool_call_format` instruction to the system prompt that enforces consistent JSON formatting within tool tags. Add a retry/fallback in `useAIChat.ts` for partial JSON: if `JSON.parse` fails on a tool payload, attempt to fix common issues (trailing commas, missing braces) before giving up.

**File:** `src/hooks/useAIChat.ts`, `supabase/functions/chat/index.ts`

---

## Summary

| # | Change | File(s) | Impact |
|---|--------|---------|--------|
| 1 | Upgrade model to gemini-3-flash-preview | `chat/index.ts` | High — better reasoning |
| 2 | Follow-up suggestions after tool use | `chat/index.ts` | High — more helpful |
| 3 | Trim context bloat | `chat/index.ts`, `smartPayloadBuilder.ts` | Medium — cost savings |
| 4 | Conversation summarization | `Index.tsx` | Medium — long session quality |
| 5 | Dynamic empty state | `DoriPanel.tsx` | Medium — better first impression |
| 6 | Robust tool parsing | `useAIChat.ts`, `chat/index.ts` | Medium — fewer missed actions |

