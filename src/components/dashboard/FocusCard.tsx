import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Task } from "@/types/flux";
import { CheckCircle2, Calendar, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isPast } from "date-fns";

interface FocusCardProps {
  tasks: Task[];
  onCompleteTask?: (taskId: string) => void;
}

export function FocusCard({ tasks, onCompleteTask }: FocusCardProps) {
  const [completing, setCompleting] = useState<string | null>(null);

  const focusItem = useMemo(() => {
    const incomplete = tasks.filter((t) => !t.completed && !t.trashed);
    const overdue = incomplete
      .filter((t) => t.dueDate && isPast(t.dueDate))
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
    if (overdue.length > 0) return overdue[0];
    const todayHigh = incomplete.filter(
      (t) => t.dueDate && isToday(t.dueDate) && t.priority === "high",
    );
    if (todayHigh.length > 0) return todayHigh[0];
    const todayTasks = incomplete.filter((t) => t.dueDate && isToday(t.dueDate));
    if (todayTasks.length > 0) return todayTasks[0];
    const highPriority = incomplete.filter((t) => t.priority === "high");
    if (highPriority.length > 0) return highPriority[0];
    return incomplete[0] || null;
  }, [tasks]);

  const handleComplete = (id: string) => {
    setCompleting(id);
    // Delay actual completion to show animation
    setTimeout(() => {
      onCompleteTask?.(id);
      setCompleting(null);
    }, 600);
  };

  if (!focusItem) {
    return (
      <GlassCard variant="elevated" className="overflow-hidden">
        <GlassCardContent className="p-6 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary opacity-60" />
            <p className="text-lg font-semibold">You're all caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nothing urgent right now. Enjoy the moment.
            </p>
          </motion.div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  const isOverdue = focusItem.dueDate && isPast(focusItem.dueDate);
  const isCompletingThis = completing === focusItem.id;

  return (
    <GlassCard variant="elevated" pressable haptic="light" className="overflow-hidden">
      <GlassCardContent className="p-4 md:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={focusItem.id}
            initial={{ opacity: 0, y: 12 }}
            animate={
              isCompletingThis ? { opacity: 0, scale: 0.9, y: -20 } : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.4, delay: isCompletingThis ? 0 : 0.1 }}
          >
            {/* Completion overlay */}
            {isCompletingThis && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center z-10"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
              </motion.div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-primary">
                {isOverdue ? "⚠️ Overdue" : "Focus Now"}
              </span>
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  focusItem.priority === "high"
                    ? "bg-destructive"
                    : focusItem.priority === "medium"
                      ? "bg-warning"
                      : "bg-muted-foreground",
                )}
              />
            </div>

            <h2 className="text-lg md:text-xl font-bold leading-tight">{focusItem.title}</h2>

            {focusItem.dueDate && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span className={cn(isOverdue && "text-destructive")}>
                  {format(focusItem.dueDate, "MMM d, h:mm a")}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Button
                size="sm"
                className="gap-2"
                onClick={() => handleComplete(focusItem.id)}
                disabled={!!completing}
              >
                <CheckCircle2 className="w-4 h-4" /> Mark Done
              </Button>
              <span
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full capitalize",
                  "bg-muted text-muted-foreground",
                )}
              >
                {focusItem.category}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}
