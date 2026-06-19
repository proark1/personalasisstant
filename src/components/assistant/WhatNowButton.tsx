import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";
import { trackProactiveOutcome } from "@/lib/telemetry";
import { Task, CalendarEvent } from "@/types/flux";
import { useDailyCheckins } from "@/hooks/useDailyCheckins";
import { useLanguage } from "@/contexts/LanguageContext";
import { Sparkles, Play, Brain, Coffee, Target, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatNowButtonProps {
  tasks: Task[];
  events?: CalendarEvent[];
  onStartTask?: (task: Task) => void;
  className?: string;
  variant?: "default" | "fab";
}

interface AISuggestion {
  task: Task | null;
  reason: string;
  alternatives: { task: Task; reason: string }[];
  tip: string;
  suggestedBreak?: boolean;
  breakReason?: string;
}

export function WhatNowButton({
  tasks,
  events,
  onStartTask,
  className,
  variant = "default",
}: WhatNowButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const { todayMorning } = useDailyCheckins();
  // Hook order matters — call useLanguage here so it runs on every
  // render regardless of the `variant === 'fab'` branch below.
  const { t } = useLanguage();

  const getSuggestion = useCallback(async () => {
    setIsLoading(true);
    setSuggestion(null);

    const now = new Date();
    const hour = now.getHours();

    // Filter incomplete tasks
    const incompleteTasks = tasks.filter((t) => !t.completed && !t.trashed);

    // Get today's events
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEvents = (events || []).filter(
      (e) => e.startTime >= todayStart && e.startTime <= todayEnd,
    );

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          type: "what_now",
          context: {
            currentTime: now.toISOString(),
            currentHour: hour,
            energyLevel: todayMorning?.energy_level || "medium",
            mood: todayMorning?.mood || "neutral",
            mainFocus: todayMorning?.main_focus,
            tasks: incompleteTasks.map((t) => ({
              id: t.id,
              title: t.title,
              priority: t.priority,
              category: t.category,
              dueDate: t.dueDate?.toISOString(),
            })),
            upcomingEvents: todayEvents.map((e) => ({
              title: e.title,
              startTime: e.startTime.toISOString(),
              endTime: e.endTime.toISOString(),
            })),
          },
        },
      });

      if (error) throw error;

      // Match returned task ID to actual task object
      const matchedTask = data.taskId ? incompleteTasks.find((t) => t.id === data.taskId) : null;

      const matchedAlternatives = (data.alternatives || [])
        .map((alt: { taskId: string; reason: string }) => ({
          task: incompleteTasks.find((t) => t.id === alt.taskId)!,
          reason: alt.reason,
        }))
        .filter((alt: { task: Task; reason: string }) => alt.task);

      setSuggestion({
        task: matchedTask,
        reason: data.reason || "Based on your current context",
        alternatives: matchedAlternatives,
        tip: data.tip || "Take it one step at a time",
        suggestedBreak: data.suggestedBreak,
        breakReason: data.breakReason,
      });
    } catch (error) {
      console.error("What now error:", error);
      toast.error(await describeEdgeError(error, t("whatNow.aiError")));

      // Fallback to simple logic
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const sortedTasks = incompleteTasks.sort(
        (a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0),
      );

      if (sortedTasks.length > 0) {
        setSuggestion({
          task: sortedTasks[0],
          reason: "This is your highest priority task",
          alternatives: sortedTasks.slice(1, 3).map((t) => ({
            task: t,
            reason: `${t.priority} priority`,
          })),
          tip: "Start small - even 2 minutes counts!",
        });
      } else {
        setSuggestion({
          task: null,
          reason: "All caught up!",
          alternatives: [],
          tip: "Great job staying on top of things!",
          suggestedBreak: true,
          breakReason: "You've completed all your tasks. Take a well-deserved break!",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [tasks, events, todayMorning, t]);

  const handleOpen = () => {
    setOpen(true);
    getSuggestion();
  };

  const handleStartTask = (task: Task) => {
    trackProactiveOutcome("what_now", "accepted", { taskId: task.id });
    onStartTask?.(task);
    setOpen(false);
  };

  if (variant === "fab") {
    return (
      <>
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full",
            "bg-gradient-to-br from-primary via-accent to-primary",
            "shadow-lg shadow-primary/30 flex items-center justify-center",
            "animate-pulse hover:animate-none hover:scale-110 transition-transform",
            className,
          )}
        >
          <Brain className="w-6 h-6 text-primary-foreground" />
        </button>

        <WhatNowDialog
          open={open}
          onOpenChange={setOpen}
          isLoading={isLoading}
          suggestion={suggestion}
          onRefresh={getSuggestion}
          onStartTask={handleStartTask}
        />
      </>
    );
  }

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className={cn(
          "gap-2 bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20",
          "hover:from-primary/20 hover:to-accent/20",
          className,
        )}
      >
        <Brain className="w-4 h-4" />
        {t("whatNow.button")}
      </Button>

      <WhatNowDialog
        open={open}
        onOpenChange={setOpen}
        isLoading={isLoading}
        suggestion={suggestion}
        onRefresh={getSuggestion}
        onStartTask={handleStartTask}
      />
    </>
  );
}

interface WhatNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoading: boolean;
  suggestion: AISuggestion | null;
  onRefresh: () => void;
  onStartTask: (task: Task) => void;
}

function WhatNowDialog({
  open,
  onOpenChange,
  isLoading,
  suggestion,
  onRefresh,
  onStartTask,
}: WhatNowDialogProps) {
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {t("whatNow.title")}
          </DialogTitle>
          <DialogDescription>{t("whatNow.description")}</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t("whatNow.analyzing")}</p>
            </div>
          ) : suggestion?.suggestedBreak ? (
            <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <Coffee className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("whatNow.takeBreak")}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{suggestion.breakReason}</p>
                </div>
              </div>
            </Card>
          ) : suggestion?.task ? (
            <>
              {/* Main Suggestion */}
              <Card className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary font-medium uppercase tracking-wide">
                      {t("whatNow.doThisNow")}
                    </p>
                    <h3 className="font-semibold text-lg truncate">{suggestion.task.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{suggestion.reason}</p>

                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className={cn(
                          "text-xs px-2 py-1 rounded-full",
                          suggestion.task.priority === "high"
                            ? "bg-red-500/10 text-red-600"
                            : suggestion.task.priority === "medium"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-green-500/10 text-green-600",
                        )}
                      >
                        {t(`priority.${suggestion.task.priority}`)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button onClick={() => onStartTask(suggestion.task!)} className="w-full mt-4 gap-2">
                  <Play className="w-4 h-4" />
                  {t("whatNow.startNow")}
                </Button>
              </Card>

              {/* Tip */}
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <Brain className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{suggestion.tip}</p>
              </div>

              {/* Alternatives */}
              {suggestion.alternatives.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-muted-foreground">
                    {t("whatNow.orTryThese")}
                  </p>
                  <div className="space-y-2">
                    {suggestion.alternatives.map((alt) => (
                      <button
                        key={alt.task.id}
                        onClick={() => onStartTask(alt.task)}
                        className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <p className="font-medium truncate">{alt.task.title}</p>
                        <p className="text-xs text-muted-foreground">{alt.reason}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t("whatNow.noSuggestions")}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onRefresh} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t("whatNow.getNew")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
