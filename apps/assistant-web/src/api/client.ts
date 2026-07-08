import type { components } from "./generated";

export type TodayResponse = components["schemas"]["TodayResponse"];

const API_BASE_URL = process.env.NEXT_PUBLIC_ASSISTANT_API_URL ?? "http://localhost:8000";

export async function getToday(): Promise<TodayResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/today`, {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Assistant API returned ${response.status}`);
    }
    return (await response.json()) as TodayResponse;
  } catch {
    return fallbackToday();
  }
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
    }
  };
}
