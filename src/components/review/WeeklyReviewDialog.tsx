import { useState, useEffect } from "react";
import { WeeklyReview, Task } from "@/types/flux";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek } from "date-fns";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Trophy,
  Target,
  Sparkles,
  PartyPopper,
} from "lucide-react";

interface WeeklyReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentReview: WeeklyReview | null;
  tasks: Task[];
  onSaveReview: (
    updates: Partial<Omit<WeeklyReview, "id" | "createdAt" | "updatedAt" | "weekStart">>,
  ) => Promise<WeeklyReview | null>;
  weeklyStats: {
    totalCreated: number;
    completedThisWeek: number;
    incompleteTotal: number;
    byPriority: { high: number; medium: number; low: number };
  };
}

type ReviewStep = "overview" | "incomplete" | "intentions" | "celebrate";

export function WeeklyReviewDialog({
  open,
  onOpenChange,
  currentReview,
  tasks,
  onSaveReview,
  weeklyStats,
}: WeeklyReviewDialogProps) {
  const [step, setStep] = useState<ReviewStep>("overview");
  const [reviewedTasks, setReviewedTasks] = useState<Set<string>>(
    new Set(currentReview?.incompleteTasksReviewed || []),
  );
  const [intentions, setIntentions] = useState(currentReview?.intentions || "");
  const [celebrations, setCelebrations] = useState(currentReview?.celebrations || "");

  useEffect(() => {
    if (currentReview) {
      setReviewedTasks(new Set(currentReview.incompleteTasksReviewed || []));
      setIntentions(currentReview.intentions || "");
      setCelebrations(currentReview.celebrations || "");
    }
  }, [currentReview]);

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const steps: ReviewStep[] = ["overview", "incomplete", "intentions", "celebrate"];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = async () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      // Save progress
      await onSaveReview({
        completedTasksCount: completedTasks.length,
        incompleteTasksReviewed: Array.from(reviewedTasks),
        intentions,
        celebrations,
      });
      setStep(steps[nextIndex]);
    } else {
      // Finish review
      await onSaveReview({
        completedTasksCount: completedTasks.length,
        incompleteTasksReviewed: Array.from(reviewedTasks),
        intentions,
        celebrations,
      });
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const toggleTaskReviewed = (taskId: string) => {
    setReviewedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Weekly Review
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </p>
        </DialogHeader>

        <Progress value={progress} className="h-1" />

        <div className="min-h-[300px]">
          {step === "overview" && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto text-warning mb-2" />
                <h3 className="text-lg font-semibold">Week Overview</h3>
                <p className="text-muted-foreground text-sm">Let's see how you did this week!</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 text-center">
                  <span className="text-3xl font-bold text-primary">
                    {weeklyStats.completedThisWeek}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">Tasks Completed</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <span className="text-3xl font-bold">{weeklyStats.incompleteTotal}</span>
                  <p className="text-xs text-muted-foreground mt-1">Still To Do</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Incomplete by Priority</h4>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded bg-destructive/10 text-center">
                    <span className="font-semibold text-destructive">
                      {weeklyStats.byPriority.high}
                    </span>
                    <p className="text-xs text-muted-foreground">High</p>
                  </div>
                  <div className="flex-1 p-2 rounded bg-warning/10 text-center">
                    <span className="font-semibold text-warning">
                      {weeklyStats.byPriority.medium}
                    </span>
                    <p className="text-xs text-muted-foreground">Medium</p>
                  </div>
                  <div className="flex-1 p-2 rounded bg-muted text-center">
                    <span className="font-semibold">{weeklyStats.byPriority.low}</span>
                    <p className="text-xs text-muted-foreground">Low</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "incomplete" && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <Target className="w-10 h-10 mx-auto text-primary mb-2" />
                <h3 className="text-lg font-semibold">Review Incomplete Tasks</h3>
                <p className="text-muted-foreground text-sm">
                  Check tasks you've reviewed and have a plan for
                </p>
              </div>

              <div className="max-h-[250px] overflow-y-auto space-y-2">
                {incompleteTasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer transition-colors",
                      reviewedTasks.has(task.id) && "bg-primary/5 border-primary/30",
                    )}
                    onClick={() => toggleTaskReviewed(task.id)}
                  >
                    <Checkbox checked={reviewedTasks.has(task.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <span
                        className={cn(
                          "text-xs",
                          task.priority === "high"
                            ? "text-destructive"
                            : task.priority === "medium"
                              ? "text-warning"
                              : "text-muted-foreground",
                        )}
                      >
                        {task.priority} priority
                      </span>
                    </div>
                  </div>
                ))}
                {incompleteTasks.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 mx-auto text-primary mb-2" />
                    <p className="text-muted-foreground">All caught up! 🎉</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "intentions" && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <Target className="w-10 h-10 mx-auto text-primary mb-2" />
                <h3 className="text-lg font-semibold">Set Intentions</h3>
                <p className="text-muted-foreground text-sm">
                  What do you want to accomplish next week?
                </p>
              </div>

              <Textarea
                value={intentions}
                onChange={(e) => setIntentions(e.target.value)}
                placeholder="• Complete the project proposal&#10;• Schedule team meetings&#10;• Review quarterly goals..."
                rows={6}
                className="resize-none"
              />
            </div>
          )}

          {step === "celebrate" && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-4">
                <PartyPopper className="w-10 h-10 mx-auto text-warning mb-2" />
                <h3 className="text-lg font-semibold">Celebrate Wins!</h3>
                <p className="text-muted-foreground text-sm">
                  What went well this week? Celebrate your accomplishments!
                </p>
              </div>

              <Textarea
                value={celebrations}
                onChange={(e) => setCelebrations(e.target.value)}
                placeholder="• Finished the client presentation on time&#10;• Helped a colleague with their project&#10;• Maintained my morning routine..."
                rows={6}
                className="resize-none"
              />

              {completedTasks.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    🎉 You completed {completedTasks.length} task
                    {completedTasks.length !== 1 ? "s" : ""} this week!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4 border-t border-border">
          <Button variant="ghost" onClick={handleBack} disabled={currentStepIndex === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <Button onClick={handleNext}>
            {currentStepIndex === steps.length - 1 ? "Finish Review" : "Next"}
            {currentStepIndex < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
