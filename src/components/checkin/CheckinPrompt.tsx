import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDailyCheckins } from '@/hooks/useDailyCheckins';
import { DailyCheckinDialog } from './DailyCheckinDialog';
import { Sun, Moon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckinPromptProps {
  className?: string;
}

export function CheckinPrompt({ className }: CheckinPromptProps) {
  const { needsMorningCheckin, needsEveningCheckin, todayMorning, todayEvening } = useDailyCheckins();
  const [showMorning, setShowMorning] = useState(false);
  const [showEvening, setShowEvening] = useState(false);
  const [dismissed, setDismissed] = useState<'morning' | 'evening' | null>(null);

  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isEvening = hour >= 18 && hour < 24;

  // Determine which prompt to show
  const showMorningPrompt = isMorning && needsMorningCheckin() && dismissed !== 'morning';
  const showEveningPrompt = isEvening && needsEveningCheckin() && dismissed !== 'evening';

  if (!showMorningPrompt && !showEveningPrompt) {
    return null;
  }

  return (
    <>
      {showMorningPrompt && (
        <Card className={cn(
          "p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20",
          "animate-in slide-in-from-top-2 duration-300",
          className
        )}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <Sun className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Start your day with a quick check-in to set your intentions
              </p>
              <Button 
                size="sm" 
                className="mt-3 bg-amber-500 hover:bg-amber-600"
                onClick={() => setShowMorning(true)}
              >
                Start Check-in
              </Button>
            </div>
            <button 
              onClick={() => setDismissed('morning')}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      {showEveningPrompt && (
        <Card className={cn(
          "p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20",
          "animate-in slide-in-from-top-2 duration-300",
          className
        )}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                Take a moment to reflect on your day and set up tomorrow
              </p>
              <Button 
                size="sm" 
                className="mt-3 bg-indigo-500 hover:bg-indigo-600"
                onClick={() => setShowEvening(true)}
              >
                Start Reflection
              </Button>
            </div>
            <button 
              onClick={() => setDismissed('evening')}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}

      <DailyCheckinDialog 
        open={showMorning} 
        onOpenChange={setShowMorning} 
        type="morning" 
      />
      
      <DailyCheckinDialog 
        open={showEvening} 
        onOpenChange={setShowEvening} 
        type="evening" 
      />
    </>
  );
}
