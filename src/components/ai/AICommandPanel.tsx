import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task, CalendarEvent } from "@/types/flux";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import {
  Sparkles,
  CalendarClock,
  Loader2,
  Clock,
  CheckCircle2,
  Coffee,
  Target,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";

interface AICommandPanelProps {
  tasks: Task[];
  events: CalendarEvent[];
  onAddSubtasks?: (
    parentId: string,
    subtasks: { title: string; priority: "high" | "medium" | "low" }[],
  ) => void;
  onRescheduleTask?: (taskId: string, newDate: Date) => void;
}

export function AICommandPanel({
  tasks,
  events,
  onAddSubtasks: _onAddSubtasks,
  onRescheduleTask,
}: AICommandPanelProps) {
  const [showDayPlan, setShowDayPlan] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const { isLoading, dayPlanResult, rescheduleResult, suggestReschedule, planMyDay, clearResults } =
    useAIAssistant();

  const handlePlanDay = async () => {
    setShowDayPlan(true);
    await planMyDay(tasks, events);
  };

  const handleReschedule = async () => {
    setShowReschedule(true);
    await suggestReschedule(tasks, events);
  };

  const applyReschedule = (taskId: string, dateStr: string, timeStr: string) => {
    if (!onRescheduleTask) return;

    const dateTime = parse(`${dateStr} ${timeStr}`, "yyyy-MM-dd HH:mm", new Date());
    onRescheduleTask(taskId, dateTime);
    setShowReschedule(false);
    clearResults();
  };

  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && new Date(t.dueDate) < new Date(),
  );

  const typeIcons = {
    task: <CheckCircle2 className="w-4 h-4 text-primary" />,
    break: <Coffee className="w-4 h-4 text-warning" />,
    focus: <Target className="w-4 h-4 text-accent" />,
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlanDay}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-primary" />
          )}
          Plan My Day
        </Button>

        {overdueTasks.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReschedule}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarClock className="w-4 h-4 text-warning" />
            )}
            Reschedule ({overdueTasks.length})
          </Button>
        )}
      </div>

      {/* Day Plan Dialog */}
      <Dialog
        open={showDayPlan}
        onOpenChange={(open) => {
          setShowDayPlan(open);
          if (!open) clearResults();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Your AI Day Plan
            </DialogTitle>
            <DialogDescription>
              Optimized schedule based on your tasks and priorities
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Planning your perfect day...</p>
            </div>
          ) : dayPlanResult ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-sm">{dayPlanResult.summary}</p>
                </div>

                {/* Schedule */}
                <div className="space-y-2">
                  {dayPlanResult.schedule.map((item, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        item.type === "break" && "bg-warning/5 border-warning/20",
                        item.type === "focus" && "bg-accent/5 border-accent/20",
                        item.type === "task" && "bg-card border-border",
                      )}
                    >
                      <div className="text-sm font-mono text-muted-foreground w-12">
                        {item.time}
                      </div>
                      {typeIcons[item.type]}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.duration} min</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tips */}
                {dayPlanResult.tips && dayPlanResult.tips.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-warning" />
                      Tips
                    </h4>
                    {dayPlanResult.tips.map((tip, i) => (
                      <p key={i} className="text-xs text-muted-foreground pl-6">
                        • {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog
        open={showReschedule}
        onOpenChange={(open) => {
          setShowReschedule(open);
          if (!open) clearResults();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-warning" />
              Smart Reschedule
            </DialogTitle>
            <DialogDescription>AI suggestions for your overdue tasks</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyzing your schedule...</p>
            </div>
          ) : rescheduleResult && rescheduleResult.length > 0 ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-3">
                {rescheduleResult.map((suggestion, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{suggestion.taskTitle}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(suggestion.suggestedDate), "MMM d")} at{" "}
                          {suggestion.suggestedTime}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          applyReschedule(
                            suggestion.taskId,
                            suggestion.suggestedDate,
                            suggestion.suggestedTime,
                          )
                        }
                      >
                        Apply
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No overdue tasks to reschedule
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
