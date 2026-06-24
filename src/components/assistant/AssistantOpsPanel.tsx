import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CalendarPlus,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Inbox,
  Loader2,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type AssistantDailyPlan,
  type AssistantOpportunity,
  type AssistantToolCallLog,
  useAssistantOperations,
} from "@/hooks/useAssistantOperations";
import { cn } from "@/lib/utils";

function when(value?: string | null): string {
  if (!value) return "unknown";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "unknown";
  return formatDistanceToNow(dt, { addSuffix: true });
}

function percent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function riskClass(risk: string): string {
  if (risk === "critical" || risk === "high") return "border-destructive/30 text-destructive";
  if (risk === "medium") return "border-amber-500/30 text-amber-600 dark:text-amber-400";
  return "border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
}

function statusIcon(status: string) {
  if (status === "success" || status === "completed" || status === "applied" || status === "accepted") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  }
  if (status === "error" || status === "failed" || status === "rejected") {
    return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  }
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}

function shortJson(value: unknown): string {
  try {
    return JSON.stringify(value).slice(0, 180);
  } catch {
    return String(value).slice(0, 180);
  }
}

export function AssistantOpsPanel() {
  const ops = useAssistantOperations();

  const latestEvalRun = ops.evalRuns[0];
  const latestEvalResults = useMemo(
    () =>
      latestEvalRun
        ? ops.evalResults.filter((result) => result.runId === latestEvalRun.id)
        : ops.evalResults.slice(0, 10),
    [latestEvalRun, ops.evalResults],
  );

  const passRate = ops.stats.evalPassRate == null ? null : percent(ops.stats.evalPassRate);

  return (
    <div className="h-full min-h-0 flex flex-col bg-background">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-primary" />
              Assistant Ops
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review assistant quality, memory, proactive candidates, and daily planning.
            </p>
          </div>
          <Button size="sm" variant="ghost" className="gap-2" onClick={ops.refresh} disabled={ops.loading}>
            {ops.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Metric icon={Brain} label="Memory review" value={ops.stats.queuedMemory} />
          <Metric icon={Inbox} label="Opportunities" value={ops.stats.candidateOpportunities} />
          <Metric icon={CalendarPlus} label="Plans" value={ops.stats.pendingPlans} />
          <Metric icon={AlertTriangle} label="Tool errors" value={ops.stats.failedToolCalls} />
          <Metric icon={ClipboardCheck} label="Eval pass" value={passRate == null ? "n/a" : `${passRate}%`} />
        </div>

        {ops.error && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {ops.error}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="min-h-0 flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 grid grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="evals" className="gap-1.5">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Evals
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="opportunities" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-1.5">
            <CalendarPlus className="h-3.5 w-3.5" />
            Plans
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1">
          <TabsContent value="overview" className="h-full m-0">
            <OverviewTab
              traces={ops.traces}
              toolCalls={ops.toolCalls}
              securityEvents={ops.securityEvents}
            />
          </TabsContent>

          <TabsContent value="evals" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <SectionTitle title="Latest Run" subtitle={latestEvalRun?.name ?? "No eval runs recorded yet"} />
                {latestEvalRun ? (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(latestEvalRun.status)}
                          <p className="truncate text-sm font-medium">{latestEvalRun.name}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {latestEvalRun.model ?? "model unknown"} · {when(latestEvalRun.createdAt)}
                        </p>
                      </div>
                      <Badge variant="outline">{latestEvalRun.status}</Badge>
                    </div>
                    {Object.keys(latestEvalRun.summary).length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">{shortJson(latestEvalRun.summary)}</p>
                    )}
                  </div>
                ) : (
                  <EmptyLine text="No eval runs have been persisted yet." />
                )}

                <SectionTitle title="Recent Results" subtitle={`${latestEvalResults.length} result rows`} />
                <div className="space-y-2">
                  {latestEvalResults.length === 0 ? (
                    <EmptyLine text="Run the eval harness to populate result rows." />
                  ) : (
                    latestEvalResults.map((result) => (
                      <div key={result.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {statusIcon(result.passed ? "success" : "error")}
                              <p className="truncate text-sm font-medium">{result.caseId}</p>
                            </div>
                            {result.failures.length > 0 && (
                              <p className="mt-1 text-xs text-destructive">{result.failures.join("; ")}</p>
                            )}
                          </div>
                          <Badge variant="outline">{percent(result.score)}%</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <SectionTitle title="Active Cases" subtitle={`${ops.evalCases.length} available cases`} />
                <div className="grid gap-2 lg:grid-cols-2">
                  {ops.evalCases.map((testCase) => (
                    <div key={testCase.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={testCase.active ? "secondary" : "outline"}>
                          {testCase.active ? "active" : "off"}
                        </Badge>
                        <p className="min-w-0 truncate text-sm font-medium">{testCase.name}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{testCase.input}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {testCase.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="memory" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-4">
                {ops.memoryQueue.length === 0 ? (
                  <EmptyLine text="No memory items need review." />
                ) : (
                  ops.memoryQueue.map((memory) => (
                    <div key={memory.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">{memory.sensitivity}</Badge>
                            <Badge variant="outline">{memory.memoryType}</Badge>
                            <Badge variant="outline">{Math.round(memory.confidence * 100)}% confidence</Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium">{memory.key}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{memory.value}</p>
                          {memory.context && (
                            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{memory.context}</p>
                          )}
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {memory.source} · updated {when(memory.updatedAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="sm"
                            className="h-7 gap-1.5"
                            disabled={ops.busyKey === `memory:${memory.id}`}
                            onClick={() => ops.reviewMemory(memory.id, "approve")}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-destructive hover:text-destructive"
                            disabled={ops.busyKey === `memory:${memory.id}`}
                            onClick={() => ops.reviewMemory(memory.id, "reject")}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="opportunities" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-4">
                {ops.opportunities.length === 0 ? (
                  <EmptyLine text="No proactive opportunities have been queued yet." />
                ) : (
                  ops.opportunities.map((opportunity) => (
                    <OpportunityRow
                      key={opportunity.id}
                      opportunity={opportunity}
                      busy={ops.busyKey === `opportunity:${opportunity.id}`}
                      onAsk={() => ops.askDoriAboutOpportunity(opportunity)}
                      onAccept={() => ops.updateOpportunity(opportunity.id, "accepted", "accepted_from_ops")}
                      onDeliver={() => ops.updateOpportunity(opportunity.id, "delivered", "delivered_from_ops")}
                      onDismiss={() => ops.updateOpportunity(opportunity.id, "dismissed", "dismissed_from_ops")}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="plans" className="h-full m-0">
            <ScrollArea className="h-full">
              <div className="space-y-3 p-4">
                {ops.dailyPlans.length === 0 ? (
                  <EmptyLine text="No daily plans have been generated yet." />
                ) : (
                  ops.dailyPlans.map((plan) => (
                    <DailyPlanRow
                      key={plan.id}
                      plan={plan}
                      busy={ops.busyKey === `plan:${plan.id}`}
                      onApprove={() => ops.approveDailyPlan(plan.id)}
                      onApply={() => ops.applyDailyPlan(plan)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60 px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate text-[11px]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function OverviewTab({
  traces,
  toolCalls,
  securityEvents,
}: {
  traces: ReturnType<typeof useAssistantOperations>["traces"];
  toolCalls: AssistantToolCallLog[];
  securityEvents: ReturnType<typeof useAssistantOperations>["securityEvents"];
}) {
  return (
    <ScrollArea className="h-full">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-3">
          <SectionTitle title="Recent Traces" subtitle={`${traces.length} conversations`} />
          {traces.length === 0 ? (
            <EmptyLine text="No traces recorded yet." />
          ) : (
            traces.slice(0, 20).map((trace) => (
              <div key={trace.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {statusIcon(trace.status)}
                      <p className="truncate text-sm font-medium">{trace.surface}</p>
                      <Badge variant="outline" className={cn("text-[10px]", riskClass(trace.riskLevel))}>
                        {trace.riskLevel}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {trace.inputExcerpt || trace.responseExcerpt || "No excerpt captured."}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                    <p>{when(trace.createdAt)}</p>
                    {trace.latencyMs != null && <p>{trace.latencyMs} ms</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-3">
            <SectionTitle title="Tool Calls" subtitle={`${toolCalls.length} recent calls`} />
            {toolCalls.length === 0 ? (
              <EmptyLine text="No tool calls logged yet." />
            ) : (
              toolCalls.slice(0, 12).map((call) => (
                <div key={call.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {statusIcon(call.status)}
                      <p className="truncate text-sm font-medium">{call.toolName}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", riskClass(call.riskLevel))}>
                      {call.approvalMode}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {call.resultSummary || call.errorMessage || call.operation || "No summary"}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3">
            <SectionTitle title="Security Events" subtitle={`${securityEvents.length} recent events`} />
            {securityEvents.length === 0 ? (
              <EmptyLine text="No security events logged yet." />
            ) : (
              securityEvents.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Shield className={cn("h-3.5 w-3.5", event.blocked ? "text-destructive" : "text-muted-foreground")} />
                      <p className="truncate text-sm font-medium">{event.eventType}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px]", riskClass(event.riskLevel))}>
                      {event.blocked ? "blocked" : event.riskLevel}
                    </Badge>
                  </div>
                  {event.reasons.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{shortJson(event.reasons)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function OpportunityRow({
  opportunity,
  busy,
  onAsk,
  onAccept,
  onDeliver,
  onDismiss,
}: {
  opportunity: AssistantOpportunity;
  busy: boolean;
  onAsk: () => void;
  onAccept: () => void;
  onDeliver: () => void;
  onDismiss: () => void;
}) {
  const gates = opportunity.gates.map((gate) => (typeof gate === "string" ? gate : shortJson(gate)));
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{opportunity.status}</Badge>
            <Badge variant="outline">{opportunity.type}</Badge>
            <Badge variant="outline" className={cn("text-[10px]", riskClass(opportunity.riskLevel))}>
              {opportunity.riskLevel}
            </Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{opportunity.title}</p>
          {opportunity.summary && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{opportunity.summary}</p>
          )}
          <div className="mt-3 max-w-md">
            <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Score</span>
              <span>{percent(opportunity.score)}%</span>
            </div>
            <Progress value={percent(opportunity.score)} className="h-1.5" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {opportunity.preferredChannels.map((channel) => (
              <Badge key={channel} variant="outline" className="text-[10px]">
                {channel}
              </Badge>
            ))}
            {gates.slice(0, 3).map((gate) => (
              <Badge key={gate} variant="outline" className="text-[10px] text-muted-foreground">
                {gate}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <Button size="sm" className="h-7 gap-1.5" disabled={busy} onClick={onAsk}>
            <Play className="h-3.5 w-3.5" />
            Act
          </Button>
          <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={onAccept}>
            Accept
          </Button>
          <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={onDeliver}>
            Delivered
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onDismiss}
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

function DailyPlanRow({
  plan,
  busy,
  onApprove,
  onApply,
}: {
  plan: AssistantDailyPlan;
  busy: boolean;
  onApprove: () => void;
  onApply: () => void;
}) {
  const canApply = plan.scheduledBlocks.length > 0 && !plan.appliedAt;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{plan.status}</Badge>
            <Badge variant="outline">{plan.planDate}</Badge>
            <Badge variant="outline">{percent(plan.score)}%</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{plan.summary || `Daily plan for ${plan.planDate}`}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {plan.scheduledBlocks.length} scheduled · {plan.unscheduledItems.length} unscheduled · {plan.timezone}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {plan.scheduledBlocks.slice(0, 6).map((block) => (
              <div key={block.key} className="rounded-md border border-border/70 px-3 py-2">
                <p className="truncate text-xs font-medium">{block.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(block.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}-
                  {new Date(block.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {!plan.approvedAt && (
            <Button size="sm" variant="ghost" className="h-7" disabled={busy} onClick={onApprove}>
              Approve
            </Button>
          )}
          <Button size="sm" className="h-7 gap-1.5" disabled={busy || !canApply} onClick={onApply}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
