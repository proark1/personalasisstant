import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { XPDisplay } from "@/components/gamification/XPDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Task } from "@/types/flux";
import { SmartSuggestion } from "@/hooks/useSmartTaskSuggestions";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Play,
  RefreshCw,
  Clock,
  Zap,
  Lightbulb,
  ChevronDown,
  Settings,
} from "lucide-react";

interface DashboardHeroProps {
  userName?: string | null;
  tasks: Task[];
  suggestion: SmartSuggestion | null;
  sugLoading: boolean;
  onRefreshSuggestion: () => void;
  onStartTask: (taskId: string | null, title: string) => void;
  onNavigate?: (panel: string) => void;
}

const energyConfig = {
  low: { label: "Low energy", className: "bg-accent text-accent-foreground" },
  medium: { label: "Medium energy", className: "bg-secondary text-secondary-foreground" },
  high: { label: "High energy", className: "bg-primary/15 text-primary" },
};

export function DashboardHero({
  userName,
  tasks,
  suggestion,
  sugLoading,
  onRefreshSuggestion,
  onStartTask,
  onNavigate,
}: DashboardHeroProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    // Skip names that are just initials (2 chars or less like "G.")
    const name = userName && userName.length > 2 ? userName : "";
    if (hour < 12) return `Good morning${name ? `, ${name}` : ""}`;
    if (hour < 17) return `Good afternoon${name ? `, ${name}` : ""}`;
    return `Good evening${name ? `, ${name}` : ""}`;
  }, [userName]);

  const isEvening = new Date().getHours() >= 18;

  const summary = useMemo(() => {
    const todayTasks = tasks.filter((t) => !t.completed && !t.trashed);
    const overdue = todayTasks.filter((t) => t.dueDate && t.dueDate < new Date());
    const count = todayTasks.length;
    // Evening: lead with a wrap-up of what got done today.
    if (isEvening) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const doneToday = tasks.filter(
        (t) => t.completed && t.createdAt && t.createdAt >= today,
      ).length;
      if (doneToday > 0)
        return `${doneToday} done today${count > 0 ? ` · ${count} left for tomorrow` : " · all clear 🎉"}`;
    }
    if (overdue.length > 0) return `${overdue.length} overdue · ${count} total to do`;
    if (count === 0) return "You're all caught up! 🎉";
    return `${count} task${count > 1 ? "s" : ""} to focus on today`;
  }, [tasks, isEvening]);

  // Time-aware prompts that hand the conversation to Dori (event-bus).
  const doriPrompts = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return ["Plan my day", "What's my top priority?"];
    if (hour < 18) return ["What should I focus on now?", "Any deadlines today?"];
    return ["Wrap up my day", "Prep me for tomorrow"];
  }, []);

  const askDori = (text: string) =>
    window.dispatchEvent(new CustomEvent("dori:ask", { detail: { text } }));

  const rec = suggestion?.recommendation;
  const energy = rec ? energyConfig[rec.energy] : null;

  return (
    <GlassCard variant="gradient" glow className="overflow-hidden">
      <GlassCardContent className="p-5 md:p-6">
        {/* Top: greeting + settings */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 min-w-0"
          >
            <h1 className="text-xl md:text-2xl font-bold text-gradient truncate">{greeting}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 whitespace-nowrap">{summary}</p>
          </motion.div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={() => onNavigate?.("settings")}
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Ask-Dori quick prompts — time-aware entry into the daily flow */}
        <div className="flex flex-wrap gap-1.5 mt-2.5 mb-3">
          {doriPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => askDori(prompt)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              {prompt}
            </button>
          ))}
        </div>

        {/* XP row */}
        <div className="mb-3">
          <XPDisplay variant="compact" />
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50 mb-3" />

        {/* WhatNow inline */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Next up</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefreshSuggestion}
            disabled={sugLoading}
          >
            <RefreshCw className={cn("w-3 h-3", sugLoading && "animate-spin")} />
          </Button>
        </div>

        {sugLoading && !rec && (
          <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>
        )}

        {!sugLoading && !rec && (
          <p className="text-sm text-muted-foreground">Nothing pending — enjoy the moment ✨</p>
        )}

        <AnimatePresence mode="wait">
          {rec && (
            <motion.div
              key={rec.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <p className="text-sm font-semibold text-foreground leading-snug">🎯 {rec.title}</p>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5 h-8"
                  onClick={() => onStartTask(rec.taskId, rec.title)}
                >
                  <Play className="w-3 h-3" /> Start Now
                </Button>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Clock className="w-2.5 h-2.5" />~{rec.estimatedMinutes}m
                </Badge>
                {energy && (
                  <Badge className={cn("gap-1 text-[10px] border-0", energy.className)}>
                    <Zap className="w-2.5 h-2.5" />
                    {energy.label}
                  </Badge>
                )}
              </div>

              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown
                    className={cn("w-3 h-3 transition-transform", detailsOpen && "rotate-180")}
                  />
                  {detailsOpen ? "Hide details" : "Why this?"}
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>

                    {rec.startTip && (
                      <div className="flex items-start gap-1.5 p-2 rounded-lg bg-accent/50 border border-border/30">
                        <Lightbulb className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          {rec.startTip}
                        </p>
                      </div>
                    )}

                    {suggestion!.alternatives.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Or try:
                        </span>
                        {suggestion!.alternatives.map((alt, i) => (
                          <button
                            key={i}
                            onClick={() => onStartTask(alt.taskId, alt.title)}
                            className="w-full text-left p-2 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                          >
                            <p className="text-xs font-medium">{alt.title}</p>
                            <p className="text-[10px] text-muted-foreground">{alt.reason}</p>
                          </button>
                        ))}
                      </div>
                    )}

                    {suggestion!.encouragement && (
                      <p className="text-[10px] text-muted-foreground">
                        💪 {suggestion!.encouragement}
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}
