import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarRange,
  Sparkles,
  Loader2,
  CheckCheck,
  X,
  Brain,
  Coffee,
  Briefcase,
  ListTodo,
  MapPin,
} from "lucide-react";
import { useSchedule, type BlockKind, type ScheduleBlock } from "@/hooks/useSchedule";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

const KIND_META: Record<BlockKind, { icon: typeof Brain; label: string; tone: string }> = {
  deep: { icon: Brain, label: "Deep work", tone: "border-l-primary bg-primary/5" },
  shallow: { icon: ListTodo, label: "Shallow", tone: "border-l-muted-foreground bg-muted/30" },
  meeting: { icon: Briefcase, label: "Meeting", tone: "border-l-amber-500 bg-amber-500/10" },
  admin: { icon: ListTodo, label: "Admin", tone: "border-l-sky-500 bg-sky-500/10" },
  break: { icon: Coffee, label: "Break", tone: "border-l-emerald-500 bg-emerald-500/10" },
  errand: { icon: MapPin, label: "Errand", tone: "border-l-rose-500 bg-rose-500/10" },
};

// "Plan my week" — predictive scheduler entry point.
// Lives in the header next to the other concierge sheets; opens a
// pane that shows the current draft proposal, lets the user generate
// a new one, and select-then-apply blocks.

export function SchedulePlannerSheet() {
  const [open, setOpen] = useState(false);
  const sched = useSchedule();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onGenerate = async () => {
    setSelected(new Set());
    await sched.generate({ days: 7 });
  };

  const onApplySelected = async () => {
    if (!sched.latest || selected.size === 0) return;
    await sched.acceptBlocks(sched.latest.id, Array.from(selected));
    setSelected(new Set());
  };

  // Group blocks by date for the day-column layout.
  const grouped = useMemo(() => {
    const out: Record<string, ScheduleBlock[]> = {};
    for (const b of sched.latest?.blocks ?? []) {
      if (!out[b.date]) out[b.date] = [];
      out[b.date].push(b);
    }
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    return out;
  }, [sched.latest]);

  const orderedDates = Object.keys(grouped).sort();
  const pendingCount = (sched.latest?.blocks ?? []).filter(
    (b) => b.applied_event_id == null && b.accepted !== false,
  ).length;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && sched.latest?.status === "draft") {
          sched.markReviewed(sched.latest.id);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Plan my week">
          <CalendarRange className="w-4.5 h-4.5" />
          {pendingCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] flex items-center justify-center"
            >
              {pendingCount > 9 ? "9+" : pendingCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border space-y-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="w-4 h-4 text-primary" />
            Plan my week
            {sched.latest?.status && (
              <Badge variant="outline" className="text-[10px] uppercase ml-1">
                {sched.latest.status}
              </Badge>
            )}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            AI-drafted week from your tasks, calendar, and energy profile. Pick the blocks you want
            and they'll be added as calendar events.
          </p>
        </SheetHeader>

        <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onGenerate} disabled={sched.busy} className="gap-1.5">
            {sched.busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {sched.latest ? "Re-plan week" : "Plan my week"}
          </Button>
          {sched.latest && sched.latest.blocks.length > 0 && (
            <>
              <Button
                size="sm"
                variant="default"
                disabled={sched.busy || selected.size === 0}
                onClick={onApplySelected}
                className="gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                Apply selected ({selected.size})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={sched.busy}
                onClick={() => sched.acceptAll(sched.latest!.id)}
              >
                Accept all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive ml-auto"
                disabled={sched.busy}
                onClick={() => sched.rejectAll(sched.latest!.id)}
              >
                <X className="w-4 h-4 mr-1" /> Discard
              </Button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sched.loading && !sched.latest ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : !sched.latest ? (
            <Empty />
          ) : (
            <>
              {sched.latest.rationale && (
                <div className="rounded-md bg-muted/30 border border-dashed p-3 text-xs">
                  <p className="font-medium text-foreground mb-1">Plan rationale</p>
                  <p className="text-muted-foreground">{sched.latest.rationale}</p>
                </div>
              )}

              {orderedDates.map((date) => (
                <DayColumn
                  key={date}
                  date={date}
                  blocks={grouped[date]}
                  selected={selected}
                  onToggle={toggle}
                />
              ))}

              {sched.latest.blocks.length === 0 && (
                <p className="text-sm text-muted-foreground italic text-center py-12">
                  The model returned no blocks. Try regenerating with explicit constraints.
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Empty() {
  return (
    <div className="text-center py-20 text-muted-foreground">
      <CalendarRange className="w-12 h-12 mx-auto opacity-40 mb-3" />
      <p className="font-medium text-sm">No plan yet</p>
      <p className="text-xs mt-1 max-w-sm mx-auto">
        Click "Plan my week" to have the assistant draft a schedule from your open tasks, calendar,
        and energy profile.
      </p>
    </div>
  );
}

function DayColumn({
  date,
  blocks,
  selected,
  onToggle,
}: {
  date: string;
  blocks: ScheduleBlock[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const d = parseISO(date);
  const heading = isValid(d) ? format(d, "EEEE, MMM d") : date;
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </h3>
      <div className="space-y-1.5">
        {blocks.map((b) => (
          <BlockRow
            key={b.id}
            block={b}
            selected={selected.has(b.id)}
            onToggle={() => onToggle(b.id)}
          />
        ))}
      </div>
    </section>
  );
}

function BlockRow({
  block,
  selected,
  onToggle,
}: {
  block: ScheduleBlock;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = KIND_META[block.kind] ?? KIND_META.shallow;
  const Icon = meta.icon;
  const start = safeTime(block.start_time);
  const end = safeTime(block.end_time);
  const applied = !!block.applied_event_id;
  const dismissed = block.accepted === false && !applied;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={applied || dismissed}
      className={cn(
        "w-full text-left flex items-start gap-2 rounded-md border-l-4 p-2 transition-colors",
        meta.tone,
        applied && "opacity-60 cursor-default",
        dismissed && "opacity-40 cursor-default line-through",
        !applied && !dismissed && (selected ? "ring-1 ring-primary" : "hover:bg-muted/40"),
      )}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5 text-foreground/70" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {start}–{end}
          </span>
          <span className="font-medium text-sm">{block.title}</span>
          {block.priority && (
            <Badge variant="outline" className="text-[9px] uppercase">
              {block.priority}
            </Badge>
          )}
          {applied && (
            <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600">on calendar</Badge>
          )}
          {dismissed && (
            <Badge variant="outline" className="text-[9px]">
              dismissed
            </Badge>
          )}
        </div>
        {block.rationale && (
          <p className="text-[11px] text-muted-foreground line-clamp-2">{block.rationale}</p>
        )}
        {block.task_id && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ListTodo className="w-3 h-3" />
            linked task
          </p>
        )}
      </div>
      {!applied && !dismissed && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 accent-primary"
          aria-label={`Select ${block.title}`}
        />
      )}
    </button>
  );
}

function safeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!isValid(d)) return iso;
    return format(d, "HH:mm");
  } catch {
    return iso;
  }
}
