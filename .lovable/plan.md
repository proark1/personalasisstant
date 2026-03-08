

# Wave 8: AI Web Search & Knowledge Access

## The Gap

Dori can manage the user's life data but **cannot answer general questions**. "What's the weather tomorrow?", "Best Italian restaurant near me?", "How do I fix a leaking faucet?" — all of these hit a wall because Dori only has its training data. For a "handle everything" assistant, this is the single biggest remaining gap.

You have a **Perplexity connector** available in your workspace but not yet linked to this project. Perplexity provides real-time web search with AI-grounded responses and citations.

## Plan

### 1. Connect Perplexity
Link the existing Perplexity connector to the project so edge functions can access `PERPLEXITY_API_KEY`.

### 2. Web Search Edge Function
Create `supabase/functions/web-search/index.ts` — a simple proxy that calls Perplexity's `sonar` model with the user's query and returns a grounded answer with citations.

### 3. Add `web_search` Tool to Chat System Prompt
Update `supabase/functions/chat/index.ts`:
- Add a new tool definition: `<tool>web_search</tool><query>{"q": "user's question"}</query>`
- Instruct Dori: "When the user asks a general knowledge question, current events, recommendations, or anything outside their personal data, use web_search to get a real-time answer."

### 4. Server-Side Search Execution
Instead of returning the tool call to the client, execute the Perplexity search **server-side** within the chat edge function. After the AI's first response contains a `web_search` tool call, the function:
1. Extracts the query
2. Calls Perplexity API
3. Injects the search result as a system message
4. Makes a second AI call to synthesize the answer with citations
5. Streams the final response to the user

This keeps it seamless — the user just asks a question and gets an answer with sources.

### 5. Client-Side Citation Rendering
Update `src/hooks/useAIChat.ts` to strip any `<tool>web_search</tool>` tags from displayed content (same pattern as `save_memory`).

## Files Summary
- **New:** `supabase/functions/web-search/index.ts` (standalone endpoint, optional)
- **Modified:** `supabase/functions/chat/index.ts` — web_search tool + server-side Perplexity call
- **Modified:** `src/hooks/useAIChat.ts` — strip web_search tool tags from UI

