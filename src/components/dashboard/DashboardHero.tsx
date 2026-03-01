import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { XPDisplay } from '@/components/gamification/XPDisplay';
import { useLanguage } from '@/contexts/LanguageContext';
import { Task } from '@/types/flux';

interface DashboardHeroProps {
  userName?: string | null;
  tasks: Task[];
}

export function DashboardHero({ userName, tasks }: DashboardHeroProps) {
  const { t } = useLanguage();

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

    if (overdue.length > 0) {
      return `You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} and ${count} total to do.`;
    }
    if (count === 0) return "You're all caught up! 🎉";
    return `You have ${count} task${count > 1 ? 's' : ''} to focus on today.`;
  }, [tasks]);

  return (
    <GlassCard variant="gradient" glow className="overflow-hidden">
      <GlassCardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex-1 min-w-0"
          >
            <h1 className="text-xl md:text-2xl font-bold text-gradient truncate">
              {greeting}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {summary}
            </p>
          </motion.div>
          <div className="flex items-center gap-2 shrink-0">
            <XPDisplay variant="compact" />
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
