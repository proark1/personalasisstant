import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { List, LayoutGrid, Layers, Clock } from 'lucide-react';

export type TaskView = 'list' | 'kanban' | 'priority' | 'timeline';

interface TaskViewSwitcherProps {
  activeView: TaskView;
  onViewChange: (view: TaskView) => void;
  className?: string;
}

const views: { id: TaskView; icon: React.ElementType; label: string }[] = [
  { id: 'list', icon: List, label: 'List' },
  { id: 'kanban', icon: LayoutGrid, label: 'Board' },
  { id: 'priority', icon: Layers, label: 'Priority' },
  { id: 'timeline', icon: Clock, label: 'Timeline' },
];

export function TaskViewSwitcher({ activeView, onViewChange, className }: TaskViewSwitcherProps) {
  const isMobile = useIsMobile();

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center gap-0.5 bg-muted/50 p-0.5 rounded-lg", className)}>
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          
          const button = (
            <Button
              key={view.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                "h-7 px-2 gap-1",
                isActive && "bg-background shadow-sm"
              )}
              onClick={() => onViewChange(view.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {!isMobile && <span className="text-xs">{view.label}</span>}
            </Button>
          );

          if (isMobile) {
            return (
              <Tooltip key={view.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {view.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </div>
    </TooltipProvider>
  );
}
