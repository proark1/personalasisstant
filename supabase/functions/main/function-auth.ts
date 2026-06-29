export type FunctionAuthMode = "public" | "user" | "service" | "webhook";

export const FUNCTION_AUTH_MODES = {
  "admin-data-export": "user",
  "admin-data-import": "user",
  "admin-user-management": "user",
  "ai-assistant": "user",
  "analyze-patterns": "user",
  "apple-caldav-connect": "user",
  "apple-caldav-sync": "user",
  "apply-schedule": "user",
  "auto-pilot": "user",
  "briefing-dispatch-cron": "service",
  "calendar-oauth-callback": "public",
  "calendar-oauth-start": "user",
  "calendar-sync": "user",
  "calendar-sync-all": "service",
  "call-push-notification": "user",
  "cancel-subscription": "user",
  chat: "public",
  "chat-ai": "user",
  "conflict-detector": "public",
  "contact-insights": "user",
  "content-ideas": "user",
  "content-ideas-cron": "service",
  "content-script": "user",
  "daily-voice-briefing": "user",
  "detect-recurring-payments": "user",
  "dori-execute-action": "user",
  "dori-onboarding-seed": "user",
  "dori-plan-execute": "user",
  "dori-proactive": "public",
  "email-autopilot": "public",
  "email-classifier": "public",
  "email-draft-reply": "user",
  "embed-memories-backfill": "service",
  "energy-coach": "user",
  "episodic-memory-builder": "public",
  "extract-contract-from-email": "user",
  "family-agent": "user",
  "family-assistant": "user",
  "family-expiry-scanner": "public",
  "finance-summary": "user",
  "gemini-live": "user",
  "generate-cancellation-email": "user",
  "generate-packing-list": "user",
  "gmail-fetch-email": "user",
  "gmail-send-reply": "user",
  "gmail-sync": "user",
  "gmail-sync-cron": "service",
  "health-coach": "user",
  "health-insights": "user",
  "import-calendar": "user",
  "islamic-daily-hadith": "service",
  "islamic-event-reminders": "service",
  "kg-extract": "user",
  "learned-preferences-rollup": "service",
  "life-correlator": "user",
  "life-score-commentary": "public",
  "meeting-bot-control": "user",
  "meeting-bot-reconciler-cron": "service",
  "meeting-bot-schedule": "user",
  "meeting-bot-webhook": "webhook",
  "meeting-followup": "public",
  "meeting-preflight": "public",
  "meeting-prep": "public",
  "memory-consolidation-cron": "service",
  "memory-forget": "user",
  "morning-briefing": "user",
  "morning-thread": "public",
  "openai-realtime-session": "user",
  "outlook-oauth-callback": "public",
  "outlook-oauth-start": "user",
  "outlook-sync": "user",
  "plaid-exchange": "user",
  "plaid-link-token": "user",
  "plaid-sync": "user",
  "plaid-sync-cron": "service",
  "prayer-times": "user",
  "proactive-assistant": "public",
  "proactive-feedback": "user",
  "propose-schedule": "user",
  "push-delivery": "service",
  "recipe-assistant": "user",
  "routine-learner": "public",
  "scan-contract": "user",
  "send-push-notification": "user",
  "spouse-handoff": "user",
  "telegram-diagnostics": "public",
  "telegram-family-morning-digest": "service",
  "telegram-link": "user",
  "telegram-poll": "webhook",
  "telegram-register-commands": "service",
  "telegram-router": "webhook",
  "telegram-weekly-briefing": "service",
  "text-to-speech": "user",
  "travel-intelligence": "public",
  "trip-overview": "user",
  "trip-prep": "user",
  "trip-prep-cron": "service",
  "user-data-export": "user",
  "vision-capture": "user",
  "vision-commit": "user",
  "voice-to-text": "user",
  "weather-forecast": "user",
  "web-search": "user",
  "weekly-coach": "user",
  "weekly-review": "user",
  "workspace-join": "user",
  "workspace-recap-cron": "service",
  "workspace-weekly-recap": "service",
} as const satisfies Record<string, FunctionAuthMode>;

export function getFunctionAuthMode(fnName: string): FunctionAuthMode | null {
  return FUNCTION_AUTH_MODES[fnName as keyof typeof FUNCTION_AUTH_MODES] ?? null;
}

export function authorizeFunctionRequest(req: Request, fnName: string): Response | null {
  if (req.method === "OPTIONS") return null;

  const authMode = getFunctionAuthMode(fnName);
  if (!authMode) {
    return authJson({ error: "function not found" }, 404);
  }

  if (authMode === "public" || authMode === "webhook") return null;

  const authHeader = req.headers.get("Authorization") || "";
  if (authMode === "user") {
    return /^Bearer\s+\S+/i.test(authHeader)
      ? null
      : authJson({ error: "missing bearer token" }, 401);
  }

  if (hasServiceAccess(req, authHeader)) return null;
  return authJson({ error: "service authorization required" }, 403);
}

function hasServiceAccess(req: Request, authHeader: string): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true;

  const serviceSecret = Deno.env.get("EDGE_FUNCTION_SERVICE_SECRET") || Deno.env.get("CRON_SECRET");
  if (!serviceSecret) return false;

  return (
    authHeader === `Bearer ${serviceSecret}` ||
    req.headers.get("x-edge-function-secret") === serviceSecret ||
    req.headers.get("x-cron-secret") === serviceSecret
  );
}

function authJson(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
