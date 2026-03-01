import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { CheckCircle2, Flame, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatPillsProps {
  streak: number;
  completedToday: number;
  completedThisWeek: number;
  lifeScore?: number;
}

export function StatPills({ streak, completedToday, completedThisWeek, lifeScore }: StatPillsProps) {
  const pills = [
    { icon: Flame, label: 'Streak', value: streak, color: 'text-orange-500', show: streak > 0 },
    { icon: CheckCircle2, label: 'Today', value: completedToday, color: 'text-primary', show: true },
    { icon: TrendingUp, label: 'This Week', value: completedThisWeek, color: 'text-primary', show: completedThisWeek > 0 },
    { icon: Star, label: 'Life Score', value: lifeScore || 0, color: 'text-accent', show: (lifeScore || 0) > 0 },
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
        <motion.div
          key={pill.label}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-full shrink-0",
            "bg-card border border-border/50",
            "shadow-soft"
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i }}
        >
          <pill.icon className={cn("w-4 h-4", pill.color)} />
          <AnimatedCounter value={pill.value} className="text-sm font-bold" />
          <span className="text-xs text-muted-foreground">{pill.label}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}
