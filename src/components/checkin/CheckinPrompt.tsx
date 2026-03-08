import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDailyCheckins } from '@/hooks/useDailyCheckins';
import { useLanguage } from '@/contexts/LanguageContext';
import { DailyCheckinDialog } from './DailyCheckinDialog';
import { Sun, Moon, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckinPromptProps {
  className?: string;
}

export function CheckinPrompt({ className }: CheckinPromptProps) {
  const { t } = useLanguage();
  const { needsMorningCheckin, needsEveningCheckin } = useDailyCheckins();
  const [showMorning, setShowMorning] = useState(false);
  const [showEvening, setShowEvening] = useState(false);
  const [dismissed, setDismissed] = useState<'morning' | 'evening' | null>(null);

  const hour = new Date().getHours();
  const isMorning = hour >= 5 && hour < 12;
  const isEvening = hour >= 18 && hour < 24;

  const showMorningPrompt = isMorning && needsMorningCheckin() && dismissed !== 'morning';
  const showEveningPrompt = isEvening && needsEveningCheckin() && dismissed !== 'evening';

  if (!showMorningPrompt && !showEveningPrompt) return null;

  const isMorningActive = showMorningPrompt;
  const Icon = isMorningActive ? Sun : Moon;
  const gradientClass = isMorningActive
    ? 'from-amber-500/15 to-orange-500/10 border-amber-500/20'
    : 'from-indigo-500/15 to-purple-500/10 border-indigo-500/20';
  const iconColor = isMorningActive ? 'text-amber-500' : 'text-indigo-400';
  const label = isMorningActive ? 'How are you feeling this morning?' : 'Time to reflect on your day';
  const cta = isMorningActive ? t('checkin.startCheckin') || 'Check in' : t('checkin.startReflection') || 'Reflect';

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border bg-gradient-to-r",
          "animate-in slide-in-from-top-2 duration-300",
          gradientClass,
          className
        )}
      >
        <Icon className={cn("w-4 h-4 shrink-0", iconColor)} />
        <span className="text-xs text-foreground flex-1 truncate">{label}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs gap-1 shrink-0"
          onClick={() => isMorningActive ? setShowMorning(true) : setShowEvening(true)}
        >
          {cta}
          <ChevronRight className="w-3 h-3" />
        </Button>
        <button
          onClick={() => setDismissed(isMorningActive ? 'morning' : 'evening')}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <DailyCheckinDialog open={showMorning} onOpenChange={setShowMorning} type="morning" />
      <DailyCheckinDialog open={showEvening} onOpenChange={setShowEvening} type="evening" />
    </>
  );
}
