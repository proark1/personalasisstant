// Pick a short status string to show while the assistant is preparing
// a reply. Pure function so it can be unit-tested and reused.
//
// The rules below mirror the original inline classifier in Index.tsx
// (first match wins, English keywords). Keep the order stable —
// reordering would change which status fires for ambiguous prompts
// like "remind me to email Sarah".

const RULES: Array<{ keywords: readonly string[]; status: string }> = [
  { keywords: ["search", "news", "latest"], status: "Searching the web..." },
  { keywords: ["task", "todo", "remind"], status: "Checking your tasks..." },
  { keywords: ["calendar", "event", "schedule"], status: "Looking at your calendar..." },
  { keywords: ["email", "mail", "inbox"], status: "Checking your emails..." },
  { keywords: ["health", "sleep", "steps"], status: "Analyzing health data..." },
  { keywords: ["contact", "who"], status: "Searching contacts..." },
];

export function classifyThinkingStatus(userText: string): string {
  const lower = userText.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.status;
  }
  return "Thinking...";
}
