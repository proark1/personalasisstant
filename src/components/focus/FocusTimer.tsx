import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Task } from '@/types/flux';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AmbientSoundsPanel } from './AmbientSoundsPanel';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Target,
  Coffee,
  Flame,
  X,
  Clock,
  Volume2,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FocusTimerProps {
  tasks: Task[];
  isOpen: boolean;
  onClose: () => void;
}

type TimerMode = 'focus' | 'short-break' | 'long-break';

const TIMER_PRESETS = {
  'focus': 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
};

export function FocusTimer({ tasks, isOpen, onClose }: FocusTimerProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<TimerMode>('focus');
  const [timeLeft, setTimeLeft] = useState(TIMER_PRESETS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [dailyFocusMinutes, setDailyFocusMinutes] = useState(0);
  const sessionStartRef = useRef<Date | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalTime = TIMER_PRESETS[mode];
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Load daily focus time on mount
  useEffect(() => {
    if (!user) return;

    const loadTodaysFocus = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('focus_sessions')
        .select('duration_minutes')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .gte('started_at', today.toISOString());

      if (data) {
        const totalMinutes = data.reduce((sum, s) => sum + s.duration_minutes, 0);
        setDailyFocusMinutes(totalMinutes);
      }
    };

    loadTodaysFocus();
  }, [user]);

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleTimerComplete();
    }

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, timeLeft]);

  const handleTimerComplete = useCallback(async () => {
    setIsRunning(false);
    
    // Play notification sound
    try {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleR8cXP///+WWQB8Yn/');
      audioRef.current.play().catch(() => {});
    } catch { /* ignore */ }

    if (mode === 'focus') {
      const focusDuration = TIMER_PRESETS.focus / 60;
      setSessionsCompleted(prev => prev + 1);
      setDailyFocusMinutes(prev => prev + focusDuration);

      // Save focus session to database
      if (user && sessionStartRef.current) {
        await supabase.from('focus_sessions').insert({
          user_id: user.id,
          task_id: selectedTaskId,
          duration_minutes: focusDuration,
          started_at: sessionStartRef.current.toISOString(),
          completed_at: new Date().toISOString(),
          is_completed: true,
        });
      }

      toast.success('Focus session complete!', {
        description: 'Great job! Take a break.',
      });

      // Auto-switch to break
      if (sessionsCompleted > 0 && (sessionsCompleted + 1) % 4 === 0) {
        setMode('long-break');
        setTimeLeft(TIMER_PRESETS['long-break']);
      } else {
        setMode('short-break');
        setTimeLeft(TIMER_PRESETS['short-break']);
      }
    } else {
      toast.success('Break complete!', {
        description: 'Ready to focus again?',
      });
      setMode('focus');
      setTimeLeft(TIMER_PRESETS.focus);
    }

    sessionStartRef.current = null;
  }, [mode, user, selectedTaskId, sessionsCompleted]);

  const toggleTimer = () => {
    if (!isRunning) {
      sessionStartRef.current = new Date();
    }
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(TIMER_PRESETS[mode]);
    sessionStartRef.current = null;
  };

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode);
    setTimeLeft(TIMER_PRESETS[newMode]);
    setIsRunning(false);
    sessionStartRef.current = null;
  };

  const incompleteTasks = tasks.filter(t => !t.completed);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Focus Mode
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Tabs */}
          <div className="flex gap-2">
            <Button
              variant={mode === 'focus' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => switchMode('focus')}
            >
              <Target className="w-4 h-4 mr-1" />
              Focus
            </Button>
            <Button
              variant={mode === 'short-break' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => switchMode('short-break')}
            >
              <Coffee className="w-4 h-4 mr-1" />
              Short
            </Button>
            <Button
              variant={mode === 'long-break' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => switchMode('long-break')}
            >
              <Coffee className="w-4 h-4 mr-1" />
              Long
            </Button>
          </div>

          {/* Task Selector */}
          <Select 
            value={selectedTaskId || '_none'} 
            onValueChange={(val) => setSelectedTaskId(val === '_none' ? null : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Link to a task (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No task</SelectItem>
              {incompleteTasks.map(task => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Timer Display */}
          <div className="relative">
            <div className="text-center">
              <div 
                className={cn(
                  "text-7xl font-mono font-bold tracking-tight transition-colors",
                  mode === 'focus' ? "text-primary" : "text-accent"
                )}
              >
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <p className="text-sm text-muted-foreground mt-2 capitalize">
                {mode.replace('-', ' ')}
              </p>
            </div>

            {/* Progress Ring */}
            <div className="mt-4">
              <Progress 
                value={progress} 
                className={cn(
                  "h-2",
                  mode === 'focus' ? "[&>div]:bg-primary" : "[&>div]:bg-accent"
                )}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={resetTimer}
              aria-label="Reset timer"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              size="icon"
              className={cn(
                "h-16 w-16 rounded-full",
                isRunning 
                  ? "bg-destructive hover:bg-destructive/90" 
                  : mode === 'focus' 
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-accent hover:bg-accent/90"
              )}
              onClick={toggleTimer}
              aria-label={isRunning ? "Pause timer" : "Start timer"}
              aria-pressed={isRunning}
            >
              {isRunning ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={onClose}
              aria-label="Close focus timer"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Ambient Sounds */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Ambient Sounds
                </span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <AmbientSoundsPanel />
            </CollapsibleContent>
          </Collapsible>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <Flame className="w-5 h-5 text-warning mx-auto mb-1" />
                <div className="text-2xl font-bold">{sessionsCompleted}</div>
                <p className="text-xs text-muted-foreground">Sessions Today</p>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
                <div className="text-2xl font-bold">{dailyFocusMinutes}</div>
                <p className="text-xs text-muted-foreground">Focus Minutes</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
