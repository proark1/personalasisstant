
# Add Email Reply/Compose to Voice Assistant

## Problem

When you ask the voice assistant to reply to an email (e.g., "reply to the Eurowings email with thank you"), it fails because:

1. **No reply tool exists** -- Voice mode only has `get_email_summary` and `search_emails`. There is no `reply_to_email` or `compose_email` tool registered with OpenAI.
2. **Email context is incomplete** -- The email data sent to the assistant only includes `from` (display name), `subject`, `priority`, and `snippet`. It does NOT include `from_email` (the actual email address), `gmail_message_id`, or `thread_id` -- all of which are required to send a reply.
3. **Fallback fails** -- Without a reply tool, the assistant likely tries `send_chat_message`, which looks up contacts by name -- and "Eurowings" is not a contact.

## Solution

### 1. Add `from_email`, `gmail_message_id`, and `thread_id` to email context

**File: `src/lib/smartPayloadBuilder.ts`**

Update the email summary mapping to include the reply-critical fields:
```typescript
payload.emailSummary = unread.map(e => ({
  subject: e.subject || '(no subject)',
  from: e.from_name || e.from_email,
  from_email: e.from_email,           // NEW
  gmail_message_id: e.gmail_message_id, // NEW
  thread_id: e.thread_id,              // NEW
  priority: ...,
  snippet: ...,
}));
```

### 2. Register a `reply_to_email` tool with OpenAI

**File: `supabase/functions/openai-realtime-session/index.ts`**

Add a new tool after the existing email tools:
```
reply_to_email:
  - email_query: string (to identify which email, e.g., "Eurowings", "the flight email")
  - reply_body: string (the reply content)
```

Also add a `compose_new_email` tool:
```
compose_new_email:
  - to: string (recipient email address)
  - subject: string
  - body: string
```

### 3. Handle the new tools in the client

**File: `src/hooks/useOpenAIRealtime.ts`**

Add handler cases for `reply_to_email` and `compose_new_email`:

- **reply_to_email**: Fuzzy-match the `email_query` against the email context data (by sender name or subject). Once matched, call `supabase.functions.invoke('gmail-send-reply')` with the matched email's `from_email`, `subject`, `thread_id`, and `gmail_message_id`.
- **compose_new_email**: Call `supabase.functions.invoke('gmail-send-reply')` with the provided `to`, `subject`, and `body`.

### 4. Pass `sendReply` / `composeEmail` to the hook

**File: `src/pages/Index.tsx`**

The `useEmails` hook already provides `sendReply` and `composeEmail` functions. Pass these (or the underlying Supabase function invocation) into `useOpenAIRealtime` options so the tool handlers can actually send emails.

## Files to Modify

1. **`src/lib/smartPayloadBuilder.ts`** -- Add `from_email`, `gmail_message_id`, `thread_id` to email context
2. **`supabase/functions/openai-realtime-session/index.ts`** -- Add `reply_to_email` and `compose_new_email` tool definitions
3. **`src/hooks/useOpenAIRealtime.ts`** -- Add tool handler cases + accept email operation callbacks
4. **`src/pages/Index.tsx`** -- Wire `sendReply`/`composeEmail` from `useEmails` into the voice assistant hook

## How It Will Work

1. User: "Do I have any important emails?"
2. Assistant reads email summary, mentions Eurowings email
3. User: "Reply with thank you"
4. Assistant calls `reply_to_email(email_query="Eurowings", reply_body="Thank you!")`
5. Client matches "Eurowings" against the email context, finds the email with `from_email`, `thread_id`, `gmail_message_id`
6. Client calls `gmail-send-reply` edge function with those details
7. Reply is sent as a proper Gmail thread reply
