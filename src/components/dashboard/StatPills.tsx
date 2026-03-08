import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { CheckCircle2, Flame, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatPillsProps {
  streak: number;
  completedToday: number;
  completedThisWeek: number;
  lifeScore?: number;
  onNavigate?: (panel: string) => void;
}

export function StatPills({ streak, completedToday, completedThisWeek, lifeScore, onNavigate }: StatPillsProps) {
  const pills = [
    { icon: Flame, label: 'Streak', value: streak, color: 'text-orange-500', show: streak > 0, nav: 'habits' },
    { icon: CheckCircle2, label: 'Today', value: completedToday, color: 'text-primary', show: true, nav: 'tasks' },
    { icon: TrendingUp, label: 'This Week', value: completedThisWeek, color: 'text-primary', show: completedThisWeek > 0, nav: 'tasks' },
    { icon: Star, label: 'Life Score', value: lifeScore || 0, color: 'text-accent', show: (lifeScore || 0) > 0, nav: 'health' },
  ].filter(p => p.show);

  if (pills.length === 0) return null;

  return (
    <motion.div
      className="flex gap-2 overflow-x-auto no-scrollbar pb-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      {pills.map((pill, i) => (
        <motion.button
          key={pill.label}
          onClick={() => onNavigate?.(pill.nav)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-full shrink-0",
            "bg-card border border-border/50",
            "shadow-soft",
            "transition-all duration-200 hover:border-primary/30 hover:shadow-md",
            "active:scale-95 cursor-pointer"
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i }}
        >
          <pill.icon className={cn("w-4 h-4", pill.color)} />
          <AnimatedCounter value={pill.value} className="text-sm font-bold" />
          <span className="text-xs text-muted-foreground">{pill.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
}
