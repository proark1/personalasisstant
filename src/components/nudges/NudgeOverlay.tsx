import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Clock, Coffee, Droplets, AlertTriangle, Brain, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Nudge } from '@/hooks/useSmartNudges';

interface NudgeOverlayProps {
  nudge: Nudge | null;
  onDismiss: (nudgeId?: string) => void;
}

const NUDGE_ICONS = {
  time_blindness: Clock,
  break_reminder: Coffee,
  transition: AlertTriangle,
  hydration: Droplets,
  task_start: Play,
  stuck_detection: Brain,
};

const NUDGE_COLORS = {
  time_blindness: 'border-l-warning',
  break_reminder: 'border-l-accent',
  transition: 'border-l-destructive',
  hydration: 'border-l-primary',
  task_start: 'border-l-secondary',
  stuck_detection: 'border-l-muted-foreground',
};

export function NudgeOverlay({ nudge, onDismiss }: NudgeOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (nudge) {
      setIsVisible(true);
      setIsExiting(false);
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nudge]);

  // Auto-dismiss low priority nudges after 10 seconds
  useEffect(() => {
    if (nudge && nudge.priority === 'low') {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [nudge]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(nudge?.id);
    }, 300);
  };

  const handleAction = () => {
    if (nudge?.action?.onClick) {
      nudge.action.onClick();
    }
    handleDismiss();
  };

  if (!isVisible || !nudge) return null;

  const Icon = NUDGE_ICONS[nudge.type];
  const borderColor = NUDGE_COLORS[nudge.type];

  return (
    <div 
      className={cn(
        "fixed bottom-24 left-4 right-4 z-50 transition-all duration-300 md:left-auto md:right-4 md:max-w-sm",
        isExiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
      )}
    >
      <Card className={cn(
        "border-l-4 shadow-lg bg-card/95 backdrop-blur-sm",
        borderColor
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-full shrink-0",
              nudge.priority === 'high' 
                ? "bg-destructive/10 text-destructive" 
                : nudge.priority === 'medium'
                  ? "bg-warning/10 text-warning"
                  : "bg-muted text-muted-foreground"
            )}>
              <Icon className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm">{nudge.title}</h4>
                {nudge.dismissable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleDismiss}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {nudge.message}
              </p>
              
              {nudge.action && (
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={handleAction}
                >
                  {nudge.action.label}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
