import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { useAuth } from "./useAuth";
import { useSharedRealtime } from "./useSharedRealtime";
import { toast } from "sonner";

// Custom tables not yet in the generated Supabase types
interface DbRow {
  id: string;
  [key: string]: unknown;
}
interface PlanDbRow extends DbRow {
  title: string;
  description: string | null;
  status: PlanStatus;
  source: string;
  channel: string;
  step_count: number | null;
  completed_step_count: number | null;
  current_step_idx: number | null;
  current_step: {
    id: string;
    idx: number | null;
    title: string;
    description: string | null;
    status: PlanStepStatus;
    requires_confirmation: boolean | null;
    result_summary: string | null;
    error_message: string | null;
  } | null;
  expires_at: string;
  completed_at: string | null;
  aborted_at: string | null;
  created_at: string;
  updated_at: string;
}
interface StepDbRow extends DbRow {
  idx: number | null;
  title: string;
  description: string | null;
  status: PlanStepStatus;
  requires_confirmation: boolean | null;
  result_summary: string | null;
  error_message: string | null;
  tool_hint: string | null;
  executed_at: string | null;
  undo_log_id: string | null;
}
type QueryChain<T extends DbRow = DbRow> = Promise<{ data: T[] | null; error: unknown }> & {
  eq(col: string, val: unknown): QueryChain<T>;
  order(col: string, opts?: Record<string, boolean>): QueryChain<T>;
  limit(n: number): QueryChain<T>;
};
function fromUntyped<T extends DbRow = DbRow>(
  table: string,
): { select(cols: string): QueryChain<T> } {
  return (
    supabase as unknown as { from: (t: string) => { select: (c: string) => QueryChain<T> } }
  ).from(table);
}

export type PlanStatus =
  | "draft"
  | "awaiting_confirm"
  | "running"
  | "paused"
  | "completed"
  | "aborted"
  | "failed";

export type PlanStepStatus =
  | "pending"
  | "awaiting_confirm"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "aborted";

export interface PlanStepSummary {
  id: string;
  idx: number;
  title: string;
  description: string | null;
  status: PlanStepStatus;
  requires_confirmation: boolean;
  result_summary: string | null;
  error_message: string | null;
}

export interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  status: PlanStatus;
  source: string;
  channel: string;
  stepCount: number;
  completedStepCount: number;
  currentStepIdx: number | null;
  currentStep: PlanStepSummary | null;
  expiresAt: string;
  completedAt: string | null;
  abortedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanStep extends PlanStepSummary {
  toolHint: string | null;
  executedAt: string | null;
  undoLogId: string | null;
}

const ACTIVE_STATUSES: PlanStatus[] = ["draft", "awaiting_confirm", "running", "paused"];

// Manages persisted multi-step plans (`dori_action_plans`). Reads the
// audit-feed view, exposes per-plan controls, and subscribes to
// realtime so the inbox badge updates the moment a plan changes
// status (chat finishes one step, user aborts on another device, …).
export function usePlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await fromUntyped<PlanDbRow>("dori_active_plans")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows: PlanRow[] = (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        source: r.source,
        channel: r.channel,
        stepCount: Number(r.step_count ?? 0),
        completedStepCount: Number(r.completed_step_count ?? 0),
        currentStepIdx: r.current_step_idx == null ? null : Number(r.current_step_idx),
        currentStep: r.current_step
          ? {
              id: r.current_step.id,
              idx: Number(r.current_step.idx ?? 0),
              title: r.current_step.title,
              description: r.current_step.description ?? null,
              status: r.current_step.status,
              requires_confirmation: !!r.current_step.requires_confirmation,
              result_summary: r.current_step.result_summary ?? null,
              error_message: r.current_step.error_message ?? null,
            }
          : null,
        expiresAt: r.expires_at,
        completedAt: r.completed_at,
        abortedAt: r.aborted_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      setPlans(rows);
    } catch (e) {
      console.warn("[usePlans] refresh failed", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: any change to plans or steps for this user triggers a
  // refresh. Two subscriptions because postgres_changes only filters
  // one table at a time. Routed through the shared coordinator so
  // multiple usePlans() callers don't each spin up their own channel.
  useSharedRealtime("dori_action_plans", user?.id, () => {
    refresh();
  });
  useSharedRealtime("dori_plan_steps", user?.id, () => {
    refresh();
  });

  const callExec = useCallback(
    async (planId: string, action: string, extra?: Record<string, unknown>) => {
      setBusyPlanId(planId);
      try {
        const { data, error } = await supabase.functions.invoke("dori-plan-execute", {
          body: { plan_id: planId, action, ...(extra ?? {}) },
        });
        if (error) throw error;
        return data;
      } finally {
        setBusyPlanId(null);
      }
    },
    [],
  );

  const executeNext = useCallback(
    async (planId: string) => {
      try {
        const data = await callExec(planId, "execute_next");
        if (data?.ok) {
          toast.success(
            `Step done${data?.result_summary ? ": " + truncate(String(data.result_summary), 80) : ""}`,
          );
        } else {
          toast.error(`Step failed: ${data?.error || "unknown"}`);
        }
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [callExec, refresh],
  );

  const skipStep = useCallback(
    async (planId: string, reason?: string) => {
      try {
        await callExec(planId, "skip", { reason });
        toast.info("Step skipped");
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [callExec, refresh],
  );

  const abortPlan = useCallback(
    async (planId: string, reason?: string) => {
      try {
        await callExec(planId, "abort", { reason });
        toast.info("Plan aborted");
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [callExec, refresh],
  );

  const pausePlan = useCallback(
    async (planId: string) => {
      try {
        await callExec(planId, "pause");
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [callExec, refresh],
  );

  const resumePlan = useCallback(
    async (planId: string) => {
      try {
        await callExec(planId, "resume");
        await refresh();
      } catch (e) {
        toast.error(await describeEdgeError(e, "Failed"));
      }
    },
    [callExec, refresh],
  );

  const fetchSteps = useCallback(
    async (planId: string): Promise<PlanStep[]> => {
      if (!user?.id) return [];
      const { data, error } = await fromUntyped<StepDbRow>("dori_plan_steps")
        .select("*")
        .eq("user_id", user.id)
        .eq("plan_id", planId)
        .order("idx", { ascending: true });
      if (error) {
        console.warn("[usePlans] fetchSteps failed", (error as { message: string }).message);
        return [];
      }
      return (data ?? []).map((r) => ({
        id: r.id,
        idx: Number(r.idx ?? 0),
        title: r.title,
        description: r.description ?? null,
        status: r.status,
        requires_confirmation: !!r.requires_confirmation,
        result_summary: r.result_summary ?? null,
        error_message: r.error_message ?? null,
        toolHint: r.tool_hint ?? null,
        executedAt: r.executed_at ?? null,
        undoLogId: r.undo_log_id ?? null,
      }));
    },
    [user?.id],
  );

  const activeCount = plans.filter((p) => ACTIVE_STATUSES.includes(p.status)).length;

  return {
    plans,
    activeCount,
    loading,
    busyPlanId,
    refresh,
    executeNext,
    skipStep,
    abortPlan,
    pausePlan,
    resumePlan,
    fetchSteps,
  };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
