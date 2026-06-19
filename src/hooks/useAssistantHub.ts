import { useMemo } from "react";
import { usePlans } from "./usePlans";
import { useAgentActions } from "./useAgentActions";
import { useMeetingBots } from "./useMeetingBots";
import { useFinanceSummary } from "./useFinanceSummary";
import { useSchedule } from "./useSchedule";

export type HubItemSource = "plan" | "action" | "meeting_bot" | "bank_reauth" | "schedule";

export interface HubItem {
  id: string;
  source: HubItemSource;
  title: string;
  subtitle?: string;
  ageMs: number; // time since the source emitted/changed
  priority: number; // 0..1, higher = more urgent
  badge?: string; // small label, e.g. "3 steps", "live"
  // Action key — the hub UI maps these to deep-link callbacks.
  defaultActionKey?: string;
}

// Aggregator for the unified inbox. Reads every queue the user
// could need to act on, normalises them into a single HubItem
// list, and exposes the total count for the badge.
//
// Re-uses existing hooks rather than duplicating realtime
// subscriptions so the hub stays in sync without extra channels.
export function useAssistantHub() {
  const plans = usePlans();
  const actions = useAgentActions();
  const bots = useMeetingBots();
  const finance = useFinanceSummary();
  const schedule = useSchedule();

  const items = useMemo<HubItem[]>(() => {
    const now = Date.now();
    const out: HubItem[] = [];

    // Plans needing the next step approved.
    for (const p of plans.plans) {
      if (p.status === "awaiting_confirm" || p.status === "running") {
        out.push({
          id: `plan:${p.id}`,
          source: "plan",
          title: p.title,
          subtitle: p.currentStep
            ? `Next: ${p.currentStep.title}`
            : `${p.completedStepCount}/${p.stepCount} done`,
          ageMs: now - new Date(p.updatedAt).getTime(),
          priority: 0.7,
          badge: `${p.completedStepCount}/${p.stepCount}`,
          defaultActionKey: "open_plans",
        });
      }
    }

    // Single-action approvals.
    for (const a of actions.actions) {
      out.push({
        id: `action:${a.id}`,
        source: "action",
        title: a.reason,
        subtitle: a.actionType.replace(/_/g, " "),
        ageMs: now - new Date(a.createdAt).getTime(),
        priority: 0.6,
        defaultActionKey: "open_actions",
      });
    }

    // Meeting bots in flight (joining / live / wrapping up).
    for (const b of bots.bots) {
      const inFlight = ["joining", "in_call", "transcript_ready", "analysis_ready"].includes(
        b.status,
      );
      if (!inFlight) continue;
      out.push({
        id: `bot:${b.id}`,
        source: "meeting_bot",
        title: b.title || b.meetingUrl,
        subtitle: b.status === "in_call" ? "Bot is live in the meeting" : `Status: ${b.status}`,
        ageMs: now - new Date(b.updatedAt).getTime(),
        priority: b.status === "in_call" ? 0.9 : 0.4,
        badge: b.status === "in_call" ? "live" : undefined,
        defaultActionKey: "open_meeting_bots",
      });
    }

    // Bank connections needing re-auth.
    for (const c of finance.summary?.connections ?? []) {
      if (c.status === "reauth_required") {
        out.push({
          id: `bank_reauth:${c.id}`,
          source: "bank_reauth",
          title: `${c.institution_name || "Bank"} needs re-link`,
          subtitle: c.last_error || "Plaid item login required",
          ageMs: c.last_synced_at ? now - new Date(c.last_synced_at).getTime() : 0,
          priority: 0.85,
          badge: "reauth",
          defaultActionKey: "open_finance",
        });
      }
    }

    // Draft schedule waiting for review.
    if (schedule.latest && schedule.latest.status === "draft") {
      const pending = schedule.latest.blocks.filter(
        (b) => b.applied_event_id == null && b.accepted !== false,
      ).length;
      if (pending > 0) {
        out.push({
          id: `schedule:${schedule.latest.id}`,
          source: "schedule",
          title: `Week plan ready`,
          subtitle: `${pending} block${pending === 1 ? "" : "s"} to review`,
          ageMs: now - new Date(schedule.latest.updated_at).getTime(),
          priority: 0.5,
          badge: `${pending}`,
          defaultActionKey: "open_schedule",
        });
      }
    }

    // Sort: priority DESC, then age ASC (newest first within same priority).
    out.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.ageMs - b.ageMs;
    });

    return out;
  }, [plans.plans, actions.actions, bots.bots, finance.summary, schedule.latest]);

  return {
    items,
    count: items.length,
    plans,
    actions,
    bots,
    finance,
    schedule,
  };
}
