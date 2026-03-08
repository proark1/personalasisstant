import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { XPDisplay } from '@/components/gamification/XPDisplay';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Task } from '@/types/flux';
import { SmartSuggestion, TaskSuggestion } from '@/hooks/useSmartTaskSuggestions';
import { cn } from '@/lib/utils';
import {
  Sparkles, Play, RefreshCw, Clock, Zap, Lightbulb,
  ChevronDown, Target, Settings,
} from 'lucide-react';

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
  low: { label: 'Low energy', className: 'bg-accent text-accent-foreground' },
  medium: { label: 'Medium energy', className: 'bg-secondary text-secondary-foreground' },
  high: { label: 'High energy', className: 'bg-primary/15 text-primary' },
};

export function DashboardHero({
  userName, tasks, suggestion, sugLoading, onRefreshSuggestion, onStartTask, onNavigate,
}: DashboardHeroProps) {
  const [altOpen, setAltOpen] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = userName || '';
    if (hour < 12) return `Good morning${name ? `, ${name}` : ''}`;
    if (hour < 17) return `Good afternoon${name ? `, ${name}` : ''}`;
    return `Good evening${name ? `, ${name}` : ''}`;
  }, [userName]);

  const summary = useMemo(() => {
    const todayTasks = tasks.filter(t => !t.completed && !t.trashed);
    const overdue = todayTasks.filter(t => t.dueDate && t.dueDate < new Date());
    const count = todayTasks.length;
    if (overdue.length > 0)
      return `${overdue.length} overdue · ${count} total to do`;
    if (count === 0) return "You're all caught up! 🎉";
    return `${count} task${count > 1 ? 's' : ''} to focus on today`;
  }, [tasks]);

  const rec = suggestion?.recommendation;
  const energy = rec ? energyConfig[rec.energy] : null;

  return (
    <GlassCard variant="gradient" glow className="overflow-hidden">
      <GlassCardContent className="p-4 md:p-5">
        {/* Top: greeting + XP */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 min-w-0"
          >
            <h1 className="text-xl md:text-2xl font-bold text-gradient truncate">
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{summary}</p>
          </motion.div>
          <div className="flex items-center gap-2 shrink-0">
            <XPDisplay variant="compact" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => onNavigate?.('settings')}
            >
              <Settings className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
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
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
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
              <p className="text-sm font-semibold text-foreground leading-snug">
                🎯 {rec.title}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{rec.reason}</p>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Clock className="w-2.5 h-2.5" />~{rec.estimatedMinutes}m
                </Badge>
                {energy && (
                  <Badge className={cn("gap-1 text-[10px] border-0", energy.className)}>
                    <Zap className="w-2.5 h-2.5" />{energy.label}
                  </Badge>
                )}
              </div>

              {rec.startTip && (
                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-accent/50 border border-border/30">
                  <Lightbulb className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{rec.startTip}</p>
                </div>
              )}

              <Button size="sm" className="gap-1.5 h-8" onClick={() => onStartTask(rec.taskId, rec.title)}>
                <Play className="w-3 h-3" /> Start Now
              </Button>

              {suggestion!.alternatives.length > 0 && (
                <Collapsible open={altOpen} onOpenChange={setAltOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className={cn("w-3 h-3 transition-transform", altOpen && "rotate-180")} />
                    Something else?
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-1.5">
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
                  </CollapsibleContent>
                </Collapsible>
              )}

              {suggestion!.encouragement && (
                <p className="text-[10px] text-muted-foreground">💪 {suggestion!.encouragement}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}
