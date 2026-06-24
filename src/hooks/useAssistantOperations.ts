import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { moduleBus } from "@/lib/moduleEventBus";
import { useAuth } from "./useAuth";

type DbRow = Record<string, unknown>;
type DbError = { message?: string } | null;

type QueryChain<T extends DbRow = DbRow> = Promise<{ data: T[] | null; error: DbError }> & {
  eq(col: string, val: unknown): QueryChain<T>;
  order(col: string, opts?: Record<string, boolean>): QueryChain<T>;
  limit(n: number): QueryChain<T>;
};

type MutationChain<T extends DbRow = DbRow> = Promise<{ data: T[] | null; error: DbError }> & {
  eq(col: string, val: unknown): MutationChain<T>;
  select(cols?: string): MutationChain<T>;
};

interface UntypedTable<T extends DbRow = DbRow> {
  select(cols?: string): QueryChain<T>;
  update(values: DbRow): MutationChain<T>;
  insert(values: DbRow | DbRow[]): MutationChain<T>;
  upsert(values: DbRow | DbRow[], opts?: Record<string, unknown>): MutationChain<T>;
}

function fromUntyped<T extends DbRow = DbRow>(table: string): UntypedTable<T> {
  return (supabase as unknown as { from: (t: string) => UntypedTable<T> }).from(table);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): DbRow {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as DbRow) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function arrayOfStrings(value: unknown): string[] {
  return asArray(value).filter((item): item is string => typeof item === "string");
}

function messageFrom(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

export interface AssistantTrace {
  id: string;
  surface: string;
  conversationId: string | null;
  inputExcerpt: string | null;
  responseExcerpt: string | null;
  model: string | null;
  promptVersion: string | null;
  status: string;
  latencyMs: number | null;
  riskLevel: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AssistantToolCallLog {
  id: string;
  traceId: string | null;
  toolName: string;
  operation: string | null;
  riskLevel: string;
  approvalMode: string;
  sensitivity: string;
  status: string;
  resultSummary: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface AssistantEvalCaseRow {
  id: string;
  name: string;
  locale: string | null;
  surface: string | null;
  input: string;
  expected: DbRow;
  tags: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantEvalRun {
  id: string;
  name: string;
  gitSha: string | null;
  model: string | null;
  status: string;
  summary: DbRow;
  createdAt: string;
  completedAt: string | null;
}

export interface AssistantEvalResult {
  id: string;
  runId: string;
  caseId: string;
  passed: boolean;
  score: number;
  failures: string[];
  observed: DbRow;
  traceId: string | null;
  createdAt: string;
}

export interface AssistantMemoryReview {
  id: string;
  memoryType: string;
  category: string | null;
  key: string;
  value: string;
  context: string | null;
  confidence: number;
  sensitivity: string;
  status: string;
  importance: number;
  provenance: DbRow;
  source: string;
  sourceRef: string | null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantOpportunity {
  id: string;
  candidateKey: string;
  type: string;
  title: string;
  summary: string | null;
  evidence: unknown[];
  preferredChannels: string[];
  selectedChannel: string | null;
  urgency: number;
  impact: number;
  actionability: number;
  confidence: number;
  novelty: number;
  score: number;
  gates: unknown[];
  riskLevel: string;
  sensitivity: string;
  status: string;
  metadata: DbRow;
  expiresAt: string | null;
  deliveredAt: string | null;
  feedback: string | null;
  feedbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPlanBlock {
  key: string;
  taskId: string | null;
  title: string;
  start: string;
  end: string;
  reason: string | null;
  category: "business" | "personal" | "family";
}

export interface AssistantDailyPlan {
  id: string;
  planDate: string;
  timezone: string;
  status: string;
  summary: string | null;
  scheduledBlocks: DailyPlanBlock[];
  unscheduledItems: unknown[];
  score: number;
  metadata: DbRow;
  approvedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  workspaceId: string | null;
}

export interface AssistantSecurityEvent {
  id: string;
  surface: string | null;
  eventType: string;
  contentTrust: string | null;
  toolName: string | null;
  riskLevel: string;
  approvalMode: string | null;
  blocked: boolean;
  reasons: unknown[];
  metadata: DbRow;
  createdAt: string;
}

export interface AssistantOpsSnapshot {
  traces: AssistantTrace[];
  toolCalls: AssistantToolCallLog[];
  evalCases: AssistantEvalCaseRow[];
  evalRuns: AssistantEvalRun[];
  evalResults: AssistantEvalResult[];
  memoryQueue: AssistantMemoryReview[];
  opportunities: AssistantOpportunity[];
  dailyPlans: AssistantDailyPlan[];
  securityEvents: AssistantSecurityEvent[];
}

function mapTrace(row: DbRow): AssistantTrace {
  return {
    id: asString(row.id),
    surface: asString(row.surface, "web"),
    conversationId: asNullableString(row.conversation_id),
    inputExcerpt: asNullableString(row.input_excerpt),
    responseExcerpt: asNullableString(row.response_excerpt),
    model: asNullableString(row.model),
    promptVersion: asNullableString(row.prompt_version),
    status: asString(row.status, "started"),
    latencyMs: row.latency_ms == null ? null : asNumber(row.latency_ms),
    riskLevel: asString(row.risk_level, "low"),
    createdAt: asString(row.created_at),
    completedAt: asNullableString(row.completed_at),
  };
}

function mapToolCall(row: DbRow): AssistantToolCallLog {
  return {
    id: asString(row.id),
    traceId: asNullableString(row.trace_id),
    toolName: asString(row.tool_name),
    operation: asNullableString(row.operation),
    riskLevel: asString(row.risk_level, "low"),
    approvalMode: asString(row.approval_mode, "auto"),
    sensitivity: asString(row.sensitivity, "personal"),
    status: asString(row.status, "started"),
    resultSummary: asNullableString(row.result_summary),
    errorMessage: asNullableString(row.error_message),
    latencyMs: row.latency_ms == null ? null : asNumber(row.latency_ms),
    createdAt: asString(row.created_at),
  };
}

function mapEvalCase(row: DbRow): AssistantEvalCaseRow {
  return {
    id: asString(row.id),
    name: asString(row.name),
    locale: asNullableString(row.locale),
    surface: asNullableString(row.surface),
    input: asString(row.input),
    expected: asRecord(row.expected),
    tags: arrayOfStrings(row.tags),
    active: asBool(row.active, true),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapEvalRun(row: DbRow): AssistantEvalRun {
  return {
    id: asString(row.id),
    name: asString(row.name),
    gitSha: asNullableString(row.git_sha),
    model: asNullableString(row.model),
    status: asString(row.status, "running"),
    summary: asRecord(row.summary),
    createdAt: asString(row.created_at),
    completedAt: asNullableString(row.completed_at),
  };
}

function mapEvalResult(row: DbRow): AssistantEvalResult {
  return {
    id: asString(row.id),
    runId: asString(row.run_id),
    caseId: asString(row.case_id),
    passed: asBool(row.passed),
    score: asNumber(row.score),
    failures: arrayOfStrings(row.failures),
    observed: asRecord(row.observed),
    traceId: asNullableString(row.trace_id),
    createdAt: asString(row.created_at),
  };
}

function mapMemory(row: DbRow): AssistantMemoryReview {
  return {
    id: asString(row.id),
    memoryType: asString(row.memory_type),
    category: asNullableString(row.category),
    key: asString(row.key),
    value: asString(row.value),
    context: asNullableString(row.context),
    confidence: asNumber(row.confidence, 0),
    sensitivity: asString(row.sensitivity, "personal"),
    status: asString(row.status, "needs_review"),
    importance: asNumber(row.importance, 0.5),
    provenance: asRecord(row.provenance),
    source: asString(row.source, "unknown"),
    sourceRef: asNullableString(row.source_ref),
    reviewRequired: asBool(row.review_required),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function mapOpportunity(row: DbRow): AssistantOpportunity {
  return {
    id: asString(row.id),
    candidateKey: asString(row.candidate_key),
    type: asString(row.type),
    title: asString(row.title),
    summary: asNullableString(row.summary),
    evidence: asArray(row.evidence),
    preferredChannels: arrayOfStrings(row.preferred_channels),
    selectedChannel: asNullableString(row.selected_channel),
    urgency: asNumber(row.urgency, 0.5),
    impact: asNumber(row.impact, 0.5),
    actionability: asNumber(row.actionability, 0.5),
    confidence: asNumber(row.confidence, 0.5),
    novelty: asNumber(row.novelty, 0.8),
    score: asNumber(row.score, 0),
    gates: asArray(row.gates),
    riskLevel: asString(row.risk_level, "low"),
    sensitivity: asString(row.sensitivity, "personal"),
    status: asString(row.status, "candidate"),
    metadata: asRecord(row.metadata),
    expiresAt: asNullableString(row.expires_at),
    deliveredAt: asNullableString(row.delivered_at),
    feedback: asNullableString(row.feedback),
    feedbackAt: asNullableString(row.feedback_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

function normalizeCategory(value: unknown): "business" | "personal" | "family" {
  return value === "business" || value === "family" ? value : "personal";
}

function mapBlock(value: unknown, index: number): DailyPlanBlock | null {
  const row = asRecord(value);
  const start = asString(row.start || row.startTime || row.start_time);
  const end = asString(row.end || row.endTime || row.end_time);
  const title = asString(row.title || row.name, "Focus block");
  if (!start || !end || Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) {
    return null;
  }
  return {
    key: asString(row.id || row.key, `${index}:${title}:${start}`),
    taskId: asNullableString(row.taskId || row.task_id),
    title,
    start,
    end,
    reason: asNullableString(row.reason),
    category: normalizeCategory(row.category),
  };
}

function mapDailyPlan(row: DbRow): AssistantDailyPlan {
  return {
    id: asString(row.id),
    planDate: asString(row.plan_date),
    timezone: asString(row.timezone, "UTC"),
    status: asString(row.status, "draft"),
    summary: asNullableString(row.summary),
    scheduledBlocks: asArray(row.scheduled_blocks)
      .map(mapBlock)
      .filter((block): block is DailyPlanBlock => Boolean(block)),
    unscheduledItems: asArray(row.unscheduled_items),
    score: asNumber(row.score),
    metadata: asRecord(row.metadata),
    approvedAt: asNullableString(row.approved_at),
    appliedAt: asNullableString(row.applied_at),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    workspaceId: asNullableString(row.workspace_id),
  };
}

function mapSecurityEvent(row: DbRow): AssistantSecurityEvent {
  return {
    id: asString(row.id),
    surface: asNullableString(row.surface),
    eventType: asString(row.event_type),
    contentTrust: asNullableString(row.content_trust),
    toolName: asNullableString(row.tool_name),
    riskLevel: asString(row.risk_level, "low"),
    approvalMode: asNullableString(row.approval_mode),
    blocked: asBool(row.blocked),
    reasons: asArray(row.reasons),
    metadata: asRecord(row.metadata),
    createdAt: asString(row.created_at),
  };
}

async function readTable<T extends DbRow>(
  table: string,
  build: (q: QueryChain<T>) => QueryChain<T>,
): Promise<T[]> {
  const { data, error } = await build(fromUntyped<T>(table).select("*"));
  if (error) throw error;
  return data ?? [];
}

export function useAssistantOperations() {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<AssistantOpsSnapshot>({
    traces: [],
    toolCalls: [],
    evalCases: [],
    evalRuns: [],
    evalResults: [],
    memoryQueue: [],
    opportunities: [],
    dailyPlans: [],
    securityEvents: [],
  });
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [
        traces,
        toolCalls,
        evalCases,
        evalRuns,
        evalResults,
        memoryQueue,
        opportunities,
        dailyPlans,
        securityEvents,
      ] = await Promise.all([
        readTable("assistant_traces", (q) =>
          q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        ),
        readTable("assistant_tool_calls", (q) =>
          q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
        ),
        readTable("assistant_eval_cases", (q) =>
          q.order("active", { ascending: false }).order("created_at", { ascending: false }).limit(100),
        ),
        readTable("assistant_eval_runs", (q) =>
          q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        ),
        readTable("assistant_eval_results", (q) =>
          q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(150),
        ),
        readTable("assistant_memory_review_queue", (q) =>
          q.eq("user_id", user.id).order("updated_at", { ascending: false }).limit(80),
        ),
        readTable("assistant_opportunities", (q) =>
          q.eq("user_id", user.id).order("status", { ascending: true }).order("score", { ascending: false }).limit(80),
        ),
        readTable("assistant_daily_plans", (q) =>
          q.eq("user_id", user.id).order("plan_date", { ascending: false }).limit(30),
        ),
        readTable("assistant_security_events", (q) =>
          q.eq("user_id", user.id).order("created_at", { ascending: false }).limit(80),
        ),
      ]);

      setSnapshot({
        traces: traces.map(mapTrace),
        toolCalls: toolCalls.map(mapToolCall),
        evalCases: evalCases.map(mapEvalCase),
        evalRuns: evalRuns.map(mapEvalRun),
        evalResults: evalResults.map(mapEvalResult),
        memoryQueue: memoryQueue.map(mapMemory),
        opportunities: opportunities.map(mapOpportunity),
        dailyPlans: dailyPlans.map(mapDailyPlan),
        securityEvents: securityEvents.map(mapSecurityEvent),
      });
    } catch (e) {
      const msg = messageFrom(e, "Could not load assistant operations.");
      console.warn("[useAssistantOperations] refresh failed", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const queuedMemory = snapshot.memoryQueue.length;
    const candidateOpportunities = snapshot.opportunities.filter((o) => o.status === "candidate").length;
    const pendingPlans = snapshot.dailyPlans.filter((p) => !p.appliedAt && p.scheduledBlocks.length > 0).length;
    const failedToolCalls = snapshot.toolCalls.filter((c) => c.status === "error").length;
    const evalPassRate =
      snapshot.evalResults.length === 0
        ? null
        : snapshot.evalResults.filter((r) => r.passed).length / snapshot.evalResults.length;
    return {
      queuedMemory,
      candidateOpportunities,
      pendingPlans,
      failedToolCalls,
      evalPassRate,
    };
  }, [snapshot]);

  const reviewMemory = useCallback(
    async (id: string, action: "approve" | "reject") => {
      if (!user?.id) return false;
      const now = new Date().toISOString();
      setBusyKey(`memory:${id}`);
      try {
        const patch =
          action === "approve"
            ? {
                status: "accepted",
                review_required: false,
                reviewed_at: now,
                updated_at: now,
              }
            : {
                status: "rejected",
                is_active: false,
                review_required: false,
                reviewed_at: now,
                updated_at: now,
              };
        const { error: dbError } = await fromUntyped("ai_memory")
          .update(patch)
          .eq("id", id)
          .eq("user_id", user.id);
        if (dbError) throw dbError;
        toast.success(action === "approve" ? "Memory approved" : "Memory rejected");
        moduleBus.emit("ai:memory-updated", { memoryId: id, reviewed: true }, "useAssistantOperations");
        await refresh();
        return true;
      } catch (e) {
        toast.error(messageFrom(e, "Memory review failed"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refresh, user?.id],
  );

  const updateOpportunity = useCallback(
    async (id: string, status: "accepted" | "dismissed" | "delivered", feedback?: string) => {
      if (!user?.id) return false;
      const now = new Date().toISOString();
      setBusyKey(`opportunity:${id}`);
      try {
        const patch: DbRow = {
          status,
          feedback: feedback ?? status,
          feedback_at: now,
          updated_at: now,
        };
        if (status === "delivered") patch.delivered_at = now;
        const { error: dbError } = await fromUntyped("assistant_opportunities")
          .update(patch)
          .eq("id", id)
          .eq("user_id", user.id);
        if (dbError) throw dbError;
        toast.success(status === "dismissed" ? "Opportunity dismissed" : "Opportunity updated");
        await refresh();
        return true;
      } catch (e) {
        toast.error(messageFrom(e, "Opportunity update failed"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refresh, user?.id],
  );

  const askDoriAboutOpportunity = useCallback((opportunity: AssistantOpportunity) => {
    const prompt = [
      `Help me act on this opportunity: ${opportunity.title}`,
      opportunity.summary ? `Summary: ${opportunity.summary}` : "",
      `Type: ${opportunity.type}. Score: ${Math.round(opportunity.score * 100)}%.`,
    ]
      .filter(Boolean)
      .join("\n");
    window.dispatchEvent(new CustomEvent("dori:ask", { detail: { text: prompt } }));
  }, []);

  const approveDailyPlan = useCallback(
    async (id: string) => {
      if (!user?.id) return false;
      const now = new Date().toISOString();
      setBusyKey(`plan:${id}`);
      try {
        const { error: dbError } = await fromUntyped("assistant_daily_plans")
          .update({ status: "approved", approved_at: now, updated_at: now })
          .eq("id", id)
          .eq("user_id", user.id);
        if (dbError) throw dbError;
        toast.success("Daily plan approved");
        await refresh();
        return true;
      } catch (e) {
        toast.error(messageFrom(e, "Could not approve daily plan"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refresh, user?.id],
  );

  const applyDailyPlan = useCallback(
    async (plan: AssistantDailyPlan) => {
      if (!user?.id || plan.scheduledBlocks.length === 0) return false;
      const now = new Date().toISOString();
      setBusyKey(`plan:${plan.id}`);
      try {
        const rows = plan.scheduledBlocks.map((block) => {
          const startIso = new Date(block.start).toISOString();
          const endIso = new Date(block.end).toISOString();
          const externalId = `${plan.id}:${block.taskId ?? block.key}:${startIso}`;
          return {
            user_id: user.id,
            workspace_id: plan.workspaceId,
            title: block.title.slice(0, 200),
            description: [plan.summary, block.reason ? `Reason: ${block.reason}` : ""]
              .filter(Boolean)
              .join("\n\n"),
            start_time: startIso,
            end_time: endIso,
            category: block.category,
            created_via: "assistant_daily_plan",
            external_source: "assistant_daily_plan",
            external_id: externalId,
          };
        });

        const { error: eventError } = await fromUntyped("events").upsert(rows, {
          onConflict: "user_id,external_source,external_id",
        });
        if (eventError) throw eventError;

        const { error: planError } = await fromUntyped("assistant_daily_plans")
          .update({
            status: "applied",
            approved_at: plan.approvedAt ?? now,
            applied_at: now,
            updated_at: now,
            metadata: {
              ...plan.metadata,
              applied_event_count: rows.length,
              applied_from: "assistant_operations",
            },
          })
          .eq("id", plan.id)
          .eq("user_id", user.id);
        if (planError) throw planError;

        moduleBus.emit("event:created", { planId: plan.id, count: rows.length }, "useAssistantOperations");
        toast.success(`Applied ${rows.length} calendar block${rows.length === 1 ? "" : "s"}`);
        await refresh();
        return true;
      } catch (e) {
        toast.error(messageFrom(e, "Could not apply daily plan"));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [refresh, user?.id],
  );

  return {
    ...snapshot,
    stats,
    loading,
    busyKey,
    error,
    refresh,
    reviewMemory,
    updateOpportunity,
    askDoriAboutOpportunity,
    approveDailyPlan,
    applyDailyPlan,
  };
}
