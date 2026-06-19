import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Task } from "@/types/flux";
import { useAIAssistant } from "@/hooks/useAIAssistant";
import { Sparkles, Loader2, Plus, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskBreakdownDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSubtasks: (subtasks: { title: string; priority: "high" | "medium" | "low" }[]) => void;
}

export function TaskBreakdownDialog({
  task,
  open,
  onOpenChange,
  onAddSubtasks,
}: TaskBreakdownDialogProps) {
  const { isLoading, breakdownResult, breakdownTask, clearResults } = useAIAssistant();
  const [selectedSubtasks, setSelectedSubtasks] = useState<Set<number>>(new Set());

  const handleOpen = async (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && task && !breakdownResult) {
      await breakdownTask(task);
      // Select all by default
      if (breakdownResult) {
        setSelectedSubtasks(new Set(breakdownResult.map((_, i) => i)));
      }
    }
    if (!isOpen) {
      clearResults();
      setSelectedSubtasks(new Set());
    }
  };

  const toggleSubtask = (index: number) => {
    setSelectedSubtasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!breakdownResult) return;

    const selected = breakdownResult
      .filter((_, i) => selectedSubtasks.has(i))
      .map((s) => ({ title: s.title, priority: s.priority }));

    onAddSubtasks(selected);
    onOpenChange(false);
    clearResults();
    setSelectedSubtasks(new Set());
  };

  // Select all when results come in
  if (breakdownResult && selectedSubtasks.size === 0) {
    setSelectedSubtasks(new Set(breakdownResult.map((_, i) => i)));
  }

  const priorityColors = {
    high: "text-destructive bg-destructive/10",
    medium: "text-warning bg-warning/10",
    low: "text-muted-foreground bg-muted",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Task Breakdown
          </DialogTitle>
          <DialogDescription>
            {task ? `Breaking down: "${task.title}"` : "Select a task to break down"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Breaking down your task...</p>
          </div>
        ) : breakdownResult && breakdownResult.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {breakdownResult.map((subtask, i) => (
                <button
                  key={i}
                  onClick={() => toggleSubtask(i)}
                  className={cn(
                    "w-full p-3 rounded-lg border text-left transition-all",
                    selectedSubtasks.has(i)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/50",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                        selectedSubtasks.has(i)
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {selectedSubtasks.has(i) && (
                        <svg
                          className="w-3 h-3 text-primary-foreground"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{subtask.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                            priorityColors[subtask.priority],
                          )}
                        >
                          {subtask.priority}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {subtask.estimatedMinutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {selectedSubtasks.size} of {breakdownResult.length} selected
              </p>
              <Button
                onClick={handleAddSelected}
                disabled={selectedSubtasks.size === 0}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add as Subtasks
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to break down task. Try again.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
