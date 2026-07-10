import type { components } from "./generated";

export type TodayResponse = components["schemas"]["TodayResponse"];
export type ProviderStatusResponse = components["schemas"]["ProviderStatusResponse"];
export type WorkdayInboxResponse = components["schemas"]["WorkdayInboxResponse"];
export type WorkdayFollowUpsResponse = components["schemas"]["WorkdayFollowUpsResponse"];
export type WorkdayCalendarResponse = components["schemas"]["WorkdayCalendarResponse"];
export type TelegramBindingStatusResponse =
  components["schemas"]["TelegramBindingStatusResponse"];
export type TelegramSetupResponse = components["schemas"]["TelegramSetupResponse"];
export type TelegramTestMessageResponse =
  components["schemas"]["TelegramTestMessageResponse"];
export type ApprovalCardData = TodayResponse["approvals"][number];
export type AssistantAskResponse = components["schemas"]["AssistantAskResponse"];

export type ApproveActionResult = {
  ok: boolean;
  status: number;
  reason?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "http://localhost:8000";
const BROWSER_PROXY_BASE = "/api/assistant";

export const SESSION_COOKIE = "assistant_session";

// Server components call the assistant API directly with the bearer read from the
// session cookie. Browser callers go through the same-origin BFF proxy, which reads
// the httpOnly session cookie and attaches the bearer server-side — the token is
// never exposed to client JavaScript.
function requestTarget(
  path: string,
  token?: string
): { url: string; headers: Record<string, string> } {
  if (typeof window === "undefined") {
    return {
      url: `${API_BASE_URL}${path}`,
      headers: token ? { authorization: `Bearer ${token}` } : {}
    };
  }
  return { url: `${BROWSER_PROXY_BASE}${path}`, headers: {} };
}

// An expired/revoked session surfaces as 401 on a browser call; bounce to login
// rather than silently showing degraded fallback data.
function redirectToLoginIfUnauthorized(status: number): void {
  if (typeof window !== "undefined" && status === 401) {
    const here = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(here)}`;
  }
}

export async function getToday(token?: string): Promise<TodayResponse> {
  try {
    const { url, headers } = requestTarget("/v1/today", token);
    const response = await fetch(url, {
      headers: { accept: "application/json", ...headers },
      cache: "no-store"
    });
    if (!response.ok) {
      redirectToLoginIfUnauthorized(response.status);
      throw new Error(`Assistant API returned ${response.status}`);
    }
    return (await response.json()) as TodayResponse;
  } catch {
    return fallbackToday();
  }
}

export async function getProviderStatus(token?: string): Promise<ProviderStatusResponse> {
  try {
    return await requestJson<ProviderStatusResponse>("/v1/providers", { method: "GET" }, token);
  } catch {
    return { providers: [], accounts: [] };
  }
}

export async function getWorkdayInbox(token?: string): Promise<WorkdayInboxResponse> {
  try {
    return await requestJson<WorkdayInboxResponse>("/v1/workday/inbox", { method: "GET" }, token);
  } catch {
    return {
      items: [],
      partial_state: fallbackPartialState("Assistant API unavailable")
    };
  }
}

export async function getWorkdayFollowUps(token?: string): Promise<WorkdayFollowUpsResponse> {
  try {
    return await requestJson<WorkdayFollowUpsResponse>(
      "/v1/workday/follow-ups",
      { method: "GET" },
      token
    );
  } catch {
    return {
      risks: [],
      partial_state: fallbackPartialState("Assistant API unavailable")
    };
  }
}

export async function getWorkdayCalendar(token?: string): Promise<WorkdayCalendarResponse> {
  try {
    return await requestJson<WorkdayCalendarResponse>(
      "/v1/workday/calendar",
      { method: "GET" },
      token
    );
  } catch {
    return {
      insights: [],
      partial_state: fallbackPartialState("Assistant API unavailable")
    };
  }
}

export async function proposeDraft(
  sourceRef: string,
  recipientRef: string,
  subject: string
): Promise<boolean> {
  try {
    await requestJson("/v1/drafts", {
      method: "POST",
      body: JSON.stringify({ source_ref: sourceRef, recipient_ref: recipientRef, subject })
    });
    return true;
  } catch {
    return false;
  }
}

export async function approveAction(
  actionId: string,
  contentHash?: string
): Promise<ApproveActionResult> {
  try {
    const { url, headers } = requestTarget(`/v1/actions/${actionId}/approve`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        ...headers
      },
      // Bind the approval to the exact snapshot the user saw, when known.
      body: JSON.stringify(contentHash ? { content_hash: contentHash } : {})
    });
    if (response.ok) {
      return { ok: true, status: response.status };
    }
    redirectToLoginIfUnauthorized(response.status);
    // The policy engine returns 409 with a decision (e.g. high-risk needs fresh auth);
    // transition conflicts return 409 with a string detail.
    let reason: string | undefined;
    try {
      const detail = (await response.json())?.detail;
      reason = typeof detail === "string" ? detail : detail?.reason;
    } catch {
      reason = undefined;
    }
    return { ok: false, status: response.status, reason };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function askAssistant(question: string): Promise<AssistantAskResponse> {
  return requestJson<AssistantAskResponse>("/v1/assistant/ask", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export async function startProviderOAuth(provider: "google" | "microsoft") {
  return requestJson<components["schemas"]["ProviderOAuthStartResponse"]>(
    `/v1/providers/oauth/${provider}/start`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function requestProviderSync(accountId: string) {
  return requestJson<components["schemas"]["ProviderSyncResponse"]>(
    `/v1/providers/accounts/${accountId}/sync`,
    {
      method: "POST",
      body: JSON.stringify({ sync_kind: "manual" })
    }
  );
}

export async function disconnectProviderAccount(accountId: string) {
  return requestJson<components["schemas"]["ProviderDisconnectResponse"]>(
    `/v1/providers/accounts/${accountId}/disconnect`,
    {
      method: "POST",
      body: JSON.stringify({})
    }
  );
}

export async function createTelegramSetup(botToken: string): Promise<TelegramSetupResponse> {
  return requestJson<TelegramSetupResponse>("/v1/telegram/setup", {
    method: "POST",
    body: JSON.stringify({ bot_token: botToken })
  });
}

export async function getTelegramBindingStatus(
  bindingId: string
): Promise<TelegramBindingStatusResponse> {
  return requestJson<TelegramBindingStatusResponse>(`/v1/telegram/bindings/${bindingId}`, {
    method: "GET"
  });
}

export async function sendTelegramTestMessage(
  bindingId: string,
  message: string
): Promise<TelegramTestMessageResponse> {
  return requestJson<TelegramTestMessageResponse>(
    `/v1/telegram/bindings/${bindingId}/test-message`,
    {
      method: "POST",
      body: JSON.stringify({ message })
    }
  );
}

async function requestJson<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const { url, headers } = requestTarget(path, token);
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...headers,
      ...init.headers
    }
  });
  if (!response.ok) {
    redirectToLoginIfUnauthorized(response.status);
    throw new Error(`Assistant API returned ${response.status}`);
  }
  return (await response.json()) as T;
}

function fallbackToday(): TodayResponse {
  const checkedAt = new Date().toISOString();
  return {
    account_id: "acct_demo",
    user_id: "user_demo",
    space_id: "space_demo",
    local_date: checkedAt.slice(0, 10),
    navigation: [
      { key: "today", label: "Today", href: "/" },
      { key: "inbox", label: "Inbox Review", href: "/inbox", count: 0 },
      { key: "followups", label: "Follow-Ups", href: "/follow-ups", count: 0 },
      { key: "calendar", label: "Calendar Plan", href: "/calendar" },
      { key: "assistant", label: "Assistant", href: "/assistant" },
      { key: "settings", label: "Settings", href: "/settings" }
    ],
    brief: [
      {
        title: "Cached brief",
        detail: "Live assistant state is unavailable.",
        source_ref: "onebrain://cached/today",
        status: "stale"
      }
    ],
    approvals: [],
    provider_health: [
      {
        provider: "Assistant API",
        status: "degraded",
        detail: API_BASE_URL,
        checked_at: checkedAt
      }
    ],
    degraded_mode: {
      active: true,
      reason: "Assistant API unavailable",
      blocked_actions: ["external sends", "calendar writes", "sensitive exports"],
      allowed_actions: ["cached read-only UI"]
    },
    priorities: [],
    follow_ups: [],
    calendar: [],
    inbox_count: 0,
    proactive_suggestion: "",
    partial_state: fallbackPartialState("Assistant API unavailable")
  };
}

function fallbackPartialState(reason: string) {
  return {
    durable: false,
    degraded: true,
    reasons: [reason],
    missing_sources: ["assistant_api"],
    stale_sources: [],
    generated_from: "fallback",
    onebrain_available: false,
    provider_accounts_seen: 0
  };
}
