import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useContextualActions, QuickAction } from '@/hooks/useContextualActions';
import { 
  Sun, Calendar, ListTodo, Timer, Zap, Check, CalendarPlus, 
  BarChart, Users, Trophy, Brain, Sparkles, Mail, FileText, LucideIcon, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  Sun,
  Calendar,
  ListTodo,
  Timer,
  Zap,
  Check,
  CalendarPlus,
  BarChart,
  Users,
  Trophy,
  Brain,
  Sparkles,
  Mail,
  FileText,
};

interface QuickActionsBarProps {
  onNavigate?: (panel: string) => void;
  maxActions?: number;
}

export function QuickActionsBar({ onNavigate, maxActions = 6 }: QuickActionsBarProps) {
  const { getTopActions, loading } = useContextualActions(onNavigate);

  const topActions = getTopActions(maxActions);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 bg-muted animate-pulse rounded-full shrink-0" />
        ))}
      </div>
    );
  }

  const getCategoryColor = (category: QuickAction['category']) => {
    switch (category) {
      case 'morning':
        return 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20';
      case 'afternoon':
        return 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20';
      case 'evening':
        return 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border-indigo-500/20';
      case 'priority':
        return 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20';
      case 'contextual':
      default:
        return 'bg-primary/10 text-primary hover:bg-primary/20 border-primary/20';
    }
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-2 pb-2">
        {topActions.map((action) => {
          const Icon = iconMap[action.icon] || Sparkles;
          return (
            <Button
              key={action.id}
              variant="outline"
              size="sm"
              onClick={action.action}
              className={cn(
                "shrink-0 rounded-full gap-1.5 border transition-all",
                getCategoryColor(action.category)
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">{action.label}</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Button>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" className="h-1.5" />
    </ScrollArea>
  );
}
