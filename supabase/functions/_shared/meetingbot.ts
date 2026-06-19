// MeetingBot HTTP client.
//
// Centralises the base URL + bearer token + per-user X-Sub-User scoping
// so every edge function speaks to the upstream service the same way.
//
// Required secrets (Supabase function env):
//   MEETINGBOT_BASE_URL    e.g. https://meetings.example.com  (no trailing slash)
//   MEETINGBOT_API_KEY     sk_live_… token from MeetingBot's /auth/keys
//   MEETINGBOT_WEBHOOK_SECRET  HMAC-SHA256 secret for webhook verify
//
// All helpers throw on non-2xx so callers can wrap in one try/catch.

const KEEPALIVE_MS = 30_000;

export interface MeetingBotConfig {
  baseUrl: string;
  apiKey: string;
}

export function loadConfig(): MeetingBotConfig {
  const baseUrl = (Deno.env.get("MEETINGBOT_BASE_URL") || "").replace(/\/+$/, "");
  const apiKey = Deno.env.get("MEETINGBOT_API_KEY") || "";
  if (!baseUrl) throw new Error("MEETINGBOT_BASE_URL is not configured");
  if (!apiKey) throw new Error("MEETINGBOT_API_KEY is not configured");
  return { baseUrl, apiKey };
}

export interface CreateBotRequest {
  meeting_url: string;
  bot_name?: string;
  // ISO-8601. If omitted, MeetingBot joins immediately.
  join_at?: string;
  // Where MeetingBot delivers terminal-state webhooks. We always pass
  // our own webhook function URL and rely on HMAC verify.
  webhook_url?: string;
  template?: string;
  analysis_mode?: "default" | "detailed" | "minimal";
  record_video?: boolean;
  live_transcription?: boolean;
  vocabulary?: string[];
  metadata?: Record<string, unknown>;
  sub_user_id?: string;
}

export interface MeetingBotRow {
  id: string;
  status: string;
  meeting_url?: string;
  bot_name?: string;
  join_at?: string | null;
  joined_at?: string | null;
  ended_at?: string | null;
  transcript?: TranscriptEntry[];
  analysis?: BotAnalysis | null;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
  source?: "voice" | "chat";
  message_id?: string;
  bot_generated?: boolean;
}

export interface BotAnalysis {
  summary?: string;
  key_points?: string[];
  action_items?: Array<{ task: string; assignee?: string }>;
  decisions?: string[];
  next_steps?: string[];
  sentiment?: string;
  topics?: string[];
}

// Tag every outbound MeetingBot row with the calling user so multi-
// tenant isolation works on their side too. The header is the
// canonical method per the API; sub_user_id in the body is also
// honoured but redundant.
export function buildHeaders(cfg: MeetingBotConfig, subUser: string): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
    "X-Sub-User": subUser,
  };
}

export async function createBot(
  cfg: MeetingBotConfig,
  subUser: string,
  body: CreateBotRequest,
): Promise<MeetingBotRow> {
  const res = await fetch(`${cfg.baseUrl}/api/v1/bot`, {
    method: "POST",
    headers: buildHeaders(cfg, subUser),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(KEEPALIVE_MS),
  });
  if (!res.ok) {
    throw new Error(`createBot failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as MeetingBotRow;
}

export async function getBot(
  cfg: MeetingBotConfig,
  subUser: string,
  botId: string,
): Promise<MeetingBotRow> {
  const res = await fetch(`${cfg.baseUrl}/api/v1/bot/${botId}`, {
    headers: buildHeaders(cfg, subUser),
    signal: AbortSignal.timeout(KEEPALIVE_MS),
  });
  if (!res.ok) {
    throw new Error(`getBot failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  return (await res.json()) as MeetingBotRow;
}

export async function deleteBot(
  cfg: MeetingBotConfig,
  subUser: string,
  botId: string,
): Promise<void> {
  const res = await fetch(`${cfg.baseUrl}/api/v1/bot/${botId}`, {
    method: "DELETE",
    headers: buildHeaders(cfg, subUser),
    signal: AbortSignal.timeout(KEEPALIVE_MS),
  });
  // 204 expected; tolerate 404 too (already deleted upstream).
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteBot failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

// Verify an HMAC-SHA256 signature on the raw webhook body. MeetingBot
// signs with the shared secret when one is configured; we expose this
// helper so the webhook function can short-circuit unsigned posts.
export async function verifyHmac(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  // Header may be "sha256=<hex>" or just "<hex>". Tolerate both.
  const hex = signatureHeader
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToHex(new Uint8Array(sig));
  return constantTimeEquals(expected, hex);
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Map MeetingBot's lifecycle into ours. We accept anything they send
// but coerce to the local CHECK constraint values.
export function normaliseStatus(s: string | undefined | null): string {
  const v = (s || "").toLowerCase();
  switch (v) {
    case "joining":
    case "scheduled":
    case "in_call":
    case "call_ended":
    case "transcript_ready":
    case "analysis_ready":
    case "done":
    case "error":
    case "cancelled":
      return v;
    case "in-call":
      return "in_call";
    case "call-ended":
      return "call_ended";
    case "transcript-ready":
      return "transcript_ready";
    case "analysis-ready":
      return "analysis_ready";
    default:
      return "pending";
  }
}
