import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Task } from '@/types/flux';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGamification } from '@/hooks/useGamification';
import { toast } from 'sonner';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Users,
  Coffee,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  Timer,
  Brain,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BodyDoublingSessionProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskComplete?: () => void;
}

type SessionPhase = 'setup' | 'working' | 'checkin' | 'break' | 'complete';

const AI_CHECKIN_MESSAGES = [
  "How's it going? Take a deep breath and keep going! 💪",
  "You're doing great! Remember: progress, not perfection.",
  "Quick check: Are you still on track? Need to adjust anything?",
  "You've got this! The hardest part was starting.",
  "Halfway there! Your future self will thank you.",
  "Keep that momentum going! You're making progress.",
  "Remember why you started. You're closer than you think!",
];

const AMBIENT_SOUNDS = [
  { id: 'none', label: 'No Sound', icon: VolumeX },
  { id: 'rain', label: 'Rain', icon: Volume2 },
  { id: 'cafe', label: 'Café', icon: Coffee },
  { id: 'focus', label: 'Focus Beats', icon: Brain },
];

export function BodyDoublingSession({ 
  task, 
  isOpen, 
  onClose,
  onTaskComplete 
}: BodyDoublingSessionProps) {
  const { user } = useAuth();
  const { addXP } = useGamification();
  
  const [phase, setPhase] = useState<SessionPhase>('setup');
  const [duration, setDuration] = useState(25); // minutes
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [ambientSound, setAmbientSound] = useState('none');
  const [showCheckin, setShowCheckin] = useState(false);
  const [checkinCount, setCheckinCount] = useState(0);
  
  const sessionStartRef = useRef<Date | null>(null);
  const nextCheckinRef = useRef<number>(0);

  const totalTime = duration * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Timer logic with periodic check-ins
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft > 0 && phase === 'working') {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          
          // Check-in at configured intervals (every 10 minutes)
          const elapsed = totalTime - newTime;
          if (elapsed > 0 && elapsed % 600 === 0 && elapsed !== totalTime) {
            triggerCheckin();
          }
          
          return newTime;
        });
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      handleSessionComplete();
    }

    return () => clearInterval(interval);
  }, [isRunning, timeLeft, phase, totalTime]);

  const triggerCheckin = useCallback(() => {
    const message = AI_CHECKIN_MESSAGES[Math.floor(Math.random() * AI_CHECKIN_MESSAGES.length)];
    setCheckinMessage(message);
    setShowCheckin(true);
    setCheckinCount(prev => prev + 1);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setShowCheckin(false);
    }, 5000);
  }, []);

  const handleSessionComplete = useCallback(async () => {
    setIsRunning(false);
    setPhase('complete');
    
    // Award XP for completing body doubling session
    await addXP(30, 'Completed body doubling session');
    
    // Save session to focus_sessions
    if (user && sessionStartRef.current) {
      await supabase.from('focus_sessions').insert({
        user_id: user.id,
        task_id: task?.id,
        duration_minutes: duration,
        started_at: sessionStartRef.current.toISOString(),
        completed_at: new Date().toISOString(),
        is_completed: true,
      });
    }

    toast.success('Session complete!', {
      description: `Great work! You stayed focused for ${duration} minutes.`,
    });
  }, [user, task, duration, addXP]);

  const startSession = () => {
    setPhase('working');
    setTimeLeft(duration * 60);
    setIsRunning(true);
    sessionStartRef.current = new Date();
    setCheckinCount(0);
  };

  const togglePause = () => {
    setIsRunning(!isRunning);
  };

  const resetSession = () => {
    setIsRunning(false);
    setTimeLeft(duration * 60);
    setPhase('setup');
    sessionStartRef.current = null;
    setCheckinCount(0);
  };

  const markTaskComplete = () => {
    if (onTaskComplete) {
      onTaskComplete();
    }
    onClose();
  };

  const handleClose = () => {
    if (isRunning) {
      // Confirm before closing active session
      if (window.confirm('End your body doubling session?')) {
        resetSession();
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Body Doubling Session
          </DialogTitle>
        </DialogHeader>

        {/* AI Check-in Overlay */}
        {showCheckin && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-10 flex items-center justify-center p-6 rounded-lg animate-in fade-in duration-300">
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">{checkinMessage}</p>
              <Button onClick={() => setShowCheckin(false)}>
                Keep Going! 💪
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {phase === 'setup' && (
            <>
              {/* Task Display */}
              {task && (
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">{task.title}</p>
                    <Badge variant="outline" className="mt-2 capitalize">
                      {task.priority} priority
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {/* Duration Selector */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Session Duration</label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[duration]}
                    onValueChange={([val]) => setDuration(val)}
                    min={5}
                    max={90}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-lg font-bold w-16 text-right">
                    {duration}m
                  </span>
                </div>
                <div className="flex gap-2">
                  {[15, 25, 45, 60].map((mins) => (
                    <Button
                      key={mins}
                      variant={duration === mins ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDuration(mins)}
                    >
                      {mins}m
                    </Button>
                  ))}
                </div>
              </div>

              {/* Ambient Sound */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Ambient Sound</label>
                <div className="grid grid-cols-4 gap-2">
                  {AMBIENT_SOUNDS.map((sound) => (
                    <Button
                      key={sound.id}
                      variant={ambientSound === sound.id ? 'default' : 'outline'}
                      size="sm"
                      className="flex-col h-auto py-2"
                      onClick={() => setAmbientSound(sound.id)}
                    >
                      <sound.icon className="w-4 h-4 mb-1" />
                      <span className="text-xs">{sound.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Start Button */}
              <Button
                size="lg"
                className="w-full"
                onClick={startSession}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Session
              </Button>
            </>
          )}

          {phase === 'working' && (
            <>
              {/* Timer Display */}
              <div className="text-center">
                <div className="text-6xl font-mono font-bold text-primary">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {task?.title || 'Focus Time'}
                </p>
              </div>

              {/* Progress */}
              <Progress value={progress} className="h-2" />

              {/* Check-in Counter */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Brain className="w-4 h-4" />
                <span>{checkinCount} check-ins</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={resetSession}
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button
                  size="icon"
                  className={cn(
                    "h-16 w-16 rounded-full",
                    isRunning 
                      ? "bg-warning hover:bg-warning/90" 
                      : "bg-primary hover:bg-primary/90"
                  )}
                  onClick={togglePause}
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
                  onClick={handleClose}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </>
          )}

          {phase === 'complete' && (
            <div className="text-center space-y-4">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
                <CheckCircle className="w-12 h-12 text-primary" />
              </div>
              <h3 className="text-xl font-bold">Session Complete!</h3>
              <p className="text-muted-foreground">
                You stayed focused for {duration} minutes. Amazing work!
              </p>
              <div className="flex gap-2">
                {task && onTaskComplete && (
                  <Button 
                    className="flex-1"
                    onClick={markTaskComplete}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Task
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    resetSession();
                    startSession();
                  }}
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Another Round
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={onClose}>
                Done for now
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
