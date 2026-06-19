import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ListChecks,
  Inbox,
  Play,
  SkipForward,
  Pause,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  usePlans,
  type PlanRow,
  type PlanStatus,
  type PlanStepStatus,
  type PlanStep,
} from "@/hooks/usePlans";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// "Plans" inbox — sister to AgentActionInbox. Lists active multi-step
// plans the assistant has proposed; each card shows progress + the
// next gated step + control buttons.

export function PlansPanel() {
  const [open, setOpen] = useState(false);
  const plans = usePlans();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Action plans">
          <ListChecks className="w-4.5 h-4.5" />
          {plans.activeCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] flex items-center justify-center"
            >
              {plans.activeCount > 9 ? "9+" : plans.activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ListChecks className="w-4 h-4 text-primary" />
            Action plans
            {plans.activeCount > 0 && <Badge variant="secondary">{plans.activeCount}</Badge>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Multi-step plans the assistant proposed. Approve each step yourself; nothing runs
            without your click.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {plans.plans.length === 0 ? (
            <EmptyState />
          ) : (
            plans.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                busy={plans.busyPlanId === plan.id}
                onExecuteNext={() => plans.executeNext(plan.id)}
                onSkip={() => plans.skipStep(plan.id)}
                onAbort={() => plans.abortPlan(plan.id)}
                onPause={() => plans.pausePlan(plan.id)}
                onResume={() => plans.resumePlan(plan.id)}
                fetchSteps={() => plans.fetchSteps(plan.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
      <Inbox className="w-10 h-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">No active plans</p>
      <p className="text-xs mt-1 max-w-xs">
        Ask Dori for something multi-step ("plan my Dubai trip", "set up a weekly review") and a
        plan will appear here.
      </p>
    </div>
  );
}

interface PlanCardProps {
  plan: PlanRow;
  busy: boolean;
  onExecuteNext: () => void;
  onSkip: () => void;
  onAbort: () => void;
  onPause: () => void;
  onResume: () => void;
  fetchSteps: () => Promise<PlanStep[]>;
}

function PlanCard(props: PlanCardProps) {
  const { plan, busy } = props;
  const [stepsOpen, setStepsOpen] = useState(false);
  const [steps, setSteps] = useState<PlanStep[]>([]);

  const pct = plan.stepCount > 0 ? Math.round((plan.completedStepCount / plan.stepCount) * 100) : 0;

  const terminal =
    plan.status === "completed" || plan.status === "aborted" || plan.status === "failed";

  const handleToggleSteps = async () => {
    if (!stepsOpen) {
      const fresh = await props.fetchSteps();
      setSteps(fresh);
    }
    setStepsOpen(!stepsOpen);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <PlanStatusBadge status={plan.status} />
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm font-medium leading-snug mt-1">{plan.title}</p>
          {plan.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plan.description}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {plan.completedStepCount} of {plan.stepCount} done
          </span>
          <span>{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      {/* Current step */}
      {!terminal && plan.currentStep && (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-2">
          <div className="flex items-center gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Next step ({plan.currentStep.idx + 1}/{plan.stepCount})
            </span>
          </div>
          <p className="text-sm font-medium mt-1">{plan.currentStep.title}</p>
          {plan.currentStep.description &&
            plan.currentStep.description !== plan.currentStep.title && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                {plan.currentStep.description}
              </p>
            )}
        </div>
      )}

      {/* Last result if terminal-ish */}
      {terminal && (
        <div className="text-xs text-muted-foreground italic">
          {plan.status === "completed" && "✅ All steps completed."}
          {plan.status === "aborted" && "⛔ Aborted."}
          {plan.status === "failed" && "❌ Stopped after a failed step."}
        </div>
      )}

      {/* Controls */}
      {!terminal && (
        <div className="flex flex-wrap gap-1.5">
          {plan.status === "paused" ? (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5"
              disabled={busy}
              onClick={props.onResume}
            >
              <RotateCcw className="w-3 h-3" /> Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs gap-1.5"
              disabled={busy || !plan.currentStep}
              onClick={props.onExecuteNext}
            >
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Run next
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            disabled={busy || !plan.currentStep}
            onClick={props.onSkip}
          >
            <SkipForward className="w-3 h-3" /> Skip
          </Button>
          {plan.status !== "paused" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              disabled={busy}
              onClick={props.onPause}
            >
              <Pause className="w-3 h-3" /> Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive ml-auto"
            disabled={busy}
            onClick={props.onAbort}
          >
            <XCircle className="w-3 h-3" /> Abort
          </Button>
        </div>
      )}

      {/* Step list (collapsed by default) */}
      <Collapsible open={stepsOpen} onOpenChange={handleToggleSteps}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-full text-[10px] text-muted-foreground gap-1"
          >
            {stepsOpen ? "Hide" : "Show"} all {plan.stepCount} steps
            <ChevronRight
              className={cn("w-3 h-3 transition-transform", stepsOpen && "rotate-90")}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 pt-1">
          {steps.length === 0 && stepsOpen && (
            <p className="text-[10px] text-muted-foreground italic">Loading…</p>
          )}
          {steps.map((s) => (
            <StepRow key={s.id} step={s} totalSteps={plan.stepCount} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function StepRow({ step, totalSteps }: { step: PlanStep; totalSteps: number }) {
  return (
    <div className="flex items-start gap-2 rounded px-2 py-1.5 bg-background/50">
      <StepStatusIcon status={step.status} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">
          <span className="text-muted-foreground">
            {step.idx + 1}/{totalSteps}.
          </span>{" "}
          {step.title}
        </p>
        {step.result_summary && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
            {step.result_summary}
          </p>
        )}
        {step.error_message && (
          <p className="text-[10px] text-destructive line-clamp-2 mt-0.5">{step.error_message}</p>
        )}
      </div>
    </div>
  );
}

function StepStatusIcon({ status }: { status: PlanStepStatus }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />;
    case "failed":
      return <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />;
    case "running":
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0 mt-0.5" />;
    case "skipped":
      return <SkipForward className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />;
    case "aborted":
      return <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />;
    default:
      return (
        <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/40 shrink-0 mt-0.5" />
      );
  }
}

function PlanStatusBadge({ status }: { status: PlanStatus }) {
  const meta: Record<PlanStatus, { label: string; tone: string }> = {
    draft: { label: "Draft", tone: "bg-muted text-muted-foreground" },
    awaiting_confirm: { label: "Ready", tone: "bg-primary/15 text-primary" },
    running: { label: "Running", tone: "bg-amber-500/15 text-amber-600" },
    paused: { label: "Paused", tone: "bg-muted text-muted-foreground" },
    completed: { label: "Done", tone: "bg-emerald-500/15 text-emerald-600" },
    aborted: { label: "Aborted", tone: "bg-muted text-muted-foreground" },
    failed: { label: "Failed", tone: "bg-destructive/15 text-destructive" },
  };
  const m = meta[status];
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded uppercase", m.tone)}>
      {m.label}
    </span>
  );
}
