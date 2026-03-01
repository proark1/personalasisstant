import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { ChevronLeft, ChevronRight, Lightbulb, Brain, Heart, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: string;
  color: string;
}

interface SmartInsightCardProps {
  tasks?: any[];
}

export function SmartInsightCard({ tasks = [] }: SmartInsightCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const incompleteTasks = tasks.filter((t: any) => !t.completed && !t.trashed);
    const highPriority = incompleteTasks.filter((t: any) => t.priority === 'high');

    if (highPriority.length > 0) {
      result.push({
        id: 'priority',
        icon: <TrendingUp className="w-5 h-5" />,
        title: 'Priority Focus',
        content: `You have ${highPriority.length} high-priority task${highPriority.length > 1 ? 's' : ''} waiting. Tackling "${highPriority[0].title}" first could set a productive tone.`,
        color: 'from-destructive/10 to-warning/10',
      });
    }

    const hour = new Date().getHours();
    if (hour >= 14 && hour <= 16) {
      result.push({
        id: 'energy',
        icon: <Brain className="w-5 h-5" />,
        title: 'Energy Tip',
        content: 'Afternoon slump? Try a quick 5-min walk or switch to a lighter task. Your focus will bounce back.',
        color: 'from-primary/10 to-accent/10',
      });
    }

    result.push({
      id: 'motivate',
      icon: <Lightbulb className="w-5 h-5" />,
      title: 'Daily Insight',
      content: incompleteTasks.length === 0
        ? "All tasks done! Use this momentum to plan ahead or invest in a personal project."
        : `${incompleteTasks.length} task${incompleteTasks.length > 1 ? 's' : ''} remaining. Break the biggest one into smaller steps to get moving.`,
      color: 'from-accent/10 to-primary/10',
    });

    return result;
  }, [tasks]);

  // Auto-advance every 8 seconds
  useEffect(() => {
    if (insights.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % insights.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [insights.length]);

  if (insights.length === 0) return null;

  const current = insights[activeIndex % insights.length];

  return (
    <GlassCard className="overflow-hidden">
      <GlassCardContent className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={cn("rounded-lg p-3 bg-gradient-to-r", current.color)}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0 text-primary">
                {current.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  {current.title}
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {current.content}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots indicator */}
        {insights.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {insights.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  i === activeIndex % insights.length
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
