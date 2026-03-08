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
  dailyGoal?: number;
  weeklyGoal?: number;
}

function MiniProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full h-1 rounded-full bg-muted/50 mt-1 overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
}

export function StatPills({
  streak, completedToday, completedThisWeek, lifeScore, onNavigate,
  dailyGoal = 5, weeklyGoal = 25,
}: StatPillsProps) {
  const pills = [
    { icon: Flame, label: 'Streak', value: streak, color: 'text-orange-500', barColor: 'bg-orange-500', show: streak > 0, nav: 'habits', max: 7, zeroLabel: null },
    { icon: CheckCircle2, label: 'Today', value: completedToday, color: 'text-primary', barColor: 'bg-primary', show: true, nav: 'tasks', max: dailyGoal, zeroLabel: 'Start first task!' },
    { icon: TrendingUp, label: 'Week', value: completedThisWeek, color: 'text-primary', barColor: 'bg-primary', show: completedThisWeek > 0, nav: 'tasks', max: weeklyGoal, zeroLabel: null },
    { icon: Star, label: 'Life', value: lifeScore || 0, color: 'text-accent', barColor: 'bg-accent', show: (lifeScore || 0) > 0, nav: 'health', max: 100, zeroLabel: null },
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
            "flex flex-col items-center px-3 py-2 rounded-full shrink-0 min-w-[72px]",
            "bg-card border border-border/50",
            "shadow-soft",
            "transition-all duration-200 hover:border-primary/30 hover:shadow-md",
            "active:scale-95 cursor-pointer"
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i }}
        >
          <div className="flex items-center gap-1.5">
            <pill.icon className={cn("w-3.5 h-3.5", pill.color)} />
            {pill.value === 0 && pill.zeroLabel ? (
              <span className="text-[10px] font-medium text-muted-foreground">{pill.zeroLabel}</span>
            ) : (
              <AnimatedCounter value={pill.value} className="text-sm font-bold" />
            )}
          </div>
          {!(pill.value === 0 && pill.zeroLabel) && (
            <span className="text-[10px] text-muted-foreground">{pill.label}</span>
          )}
          <MiniProgress value={pill.value} max={pill.max} color={pill.barColor} />
        </motion.button>
      ))}
    </motion.div>
  );
}
