import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, ListTodo, Calendar, Mic, Brain, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHaptics } from "@/hooks/useHaptics";

interface FABAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  className?: string;
}

export function FloatingActionButton({ actions, className }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { vibrate } = useHaptics();

  const toggleOpen = () => {
    vibrate("light");
    setIsOpen(!isOpen);
  };

  const handleActionClick = (action: FABAction) => {
    vibrate("medium");
    action.onClick();
    setIsOpen(false);
  };

  return (
    <div className={cn("fixed z-50", className)}>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <AnimatePresence>
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col-reverse items-end gap-3 mb-2">
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: { delay: index * 0.05, type: "spring", stiffness: 400, damping: 25 },
                }}
                exit={{
                  opacity: 0,
                  y: 10,
                  scale: 0.8,
                  transition: { delay: (actions.length - index - 1) * 0.03 },
                }}
                onClick={() => handleActionClick(action)}
                className={cn(
                  "flex items-center gap-3 pr-4 pl-3 py-2.5 rounded-full shadow-lg",
                  "bg-card border border-border",
                  "active:scale-95 transition-transform touch-manipulation",
                  "hover:bg-muted",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    action.color || "bg-primary/10 text-primary",
                  )}
                >
                  {action.icon}
                </div>
                <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={toggleOpen}
        animate={{ rotate: isOpen ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "w-14 h-14 rounded-full shadow-xl flex items-center justify-center",
          "bg-primary text-primary-foreground",
          "active:scale-90 transition-all touch-manipulation",
          isOpen ? "bg-muted-foreground" : "bg-primary",
          "ring-4 ring-primary/20",
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}

// Pre-configured FAB for common quick actions
interface QuickActionsFABProps {
  onAddTask?: () => void;
  onAddEvent?: () => void;
  onVoiceCapture?: () => void;
  onBrainDump?: () => void;
  onAskDori?: () => void;
  className?: string;
}

export function QuickActionsFAB({
  onAddTask,
  onAddEvent,
  onVoiceCapture,
  onBrainDump,
  onAskDori,
  className,
}: QuickActionsFABProps) {
  const actions: FABAction[] = [];

  if (onAddTask) {
    actions.push({
      id: "task",
      icon: <ListTodo className="w-5 h-5" />,
      label: "Add Task",
      onClick: onAddTask,
      color: "bg-blue-500/10 text-blue-500",
    });
  }

  if (onAddEvent) {
    actions.push({
      id: "event",
      icon: <Calendar className="w-5 h-5" />,
      label: "Add Event",
      onClick: onAddEvent,
      color: "bg-green-500/10 text-green-500",
    });
  }

  if (onVoiceCapture) {
    actions.push({
      id: "voice",
      icon: <Mic className="w-5 h-5" />,
      label: "Voice Capture",
      onClick: onVoiceCapture,
      color: "bg-red-500/10 text-red-500",
    });
  }

  if (onBrainDump) {
    actions.push({
      id: "brain",
      icon: <Brain className="w-5 h-5" />,
      label: "Brain Dump",
      onClick: onBrainDump,
      color: "bg-purple-500/10 text-purple-500",
    });
  }

  if (onAskDori) {
    actions.push({
      id: "dori",
      icon: <Sparkles className="w-5 h-5" />,
      label: "Ask Dori",
      onClick: onAskDori,
      color: "bg-amber-500/10 text-amber-500",
    });
  }

  if (actions.length === 0) return null;

  return <FloatingActionButton actions={actions} className={cn("bottom-24 right-4", className)} />;
}
