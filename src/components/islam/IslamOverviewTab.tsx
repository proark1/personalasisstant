import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { staggerItem } from '@/components/ui/panel-shell';
import { Clock, BookOpen, Flame, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import { DhikrCounter } from './DhikrCounter';
import { useQuranReadingProgress } from '@/hooks/useQuranReadingProgress';
import type { IslamicEvent } from '@/hooks/useIslamicFeatures';

interface IslamOverviewTabProps {
  hijriToday: { day: number; month: number; year: number; monthName: string };
  islamicEvents: IslamicEvent[];
  dhikrTypes: { id: string; arabic: string; english: string; defaultTarget: number }[];
  dhikrLogs: { id: string; dhikr_type: string; target_count: number; completed_count: number; log_date: string }[];
  incrementDhikr: (type: string) => void;
  resetDhikr: (type: string) => void;
  nextPrayerName?: string;
  nextPrayerTime?: string;
  countdown?: string;
  onNavigate: (tab: string) => void;
}

export function IslamOverviewTab({
  hijriToday,
  islamicEvents,
  dhikrTypes,
  dhikrLogs,
  incrementDhikr,
  resetDhikr,
  nextPrayerName,
  nextPrayerTime,
  countdown,
  onNavigate,
}: IslamOverviewTabProps) {
  const { todayAyahsRead, goal, todayGoalProgress, currentStreak } = useQuranReadingProgress();

  const nextEvent = useMemo(() => {
    const now = new Date();
    return islamicEvents.find(e => e.date >= now);
  }, [islamicEvents]);

  const daysUntilEvent = nextEvent ? differenceInDays(nextEvent.date, new Date()) : null;

  return (
    <div className="p-3 md:p-4 space-y-4">
      {/* Hijri date hero */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="gradient" className="p-5 text-center">
          <p className="text-xs text-muted-foreground mb-1">Today</p>
          <p className="font-arabic text-2xl font-bold">
            {hijriToday.day} {hijriToday.monthName} {hijriToday.year} هـ
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </GlassCard>
      </motion.div>

      {/* Next prayer card */}
      {nextPrayerName && countdown && (
        <motion.div variants={staggerItem}>
          <GlassCard
            pressable
            haptic="light"
            onClick={() => onNavigate('prayer')}
            className="p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Prayer</p>
                  <p className="font-semibold text-lg">{nextPrayerName}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{countdown}</p>
                {nextPrayerTime && (
                  <p className="text-xs text-muted-foreground">{nextPrayerTime}</p>
                )}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Quran progress */}
      <motion.div variants={staggerItem}>
        <GlassCard
          pressable
          haptic="light"
          onClick={() => onNavigate('quran')}
          className="p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Quran Today</span>
            </div>
            <div className="flex items-center gap-2">
              {currentStreak > 0 && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {currentStreak}
                </Badge>
              )}
              <span className="text-sm font-bold">
                {todayAyahsRead}/{goal?.daily_ayahs_goal || 10}
              </span>
            </div>
          </div>
          <Progress
            value={Math.min(todayGoalProgress, 100)}
            className={cn("h-2", todayGoalProgress >= 100 && "[&>div]:bg-emerald-500")}
          />
        </GlassCard>
      </motion.div>

      {/* Dhikr compact */}
      <motion.div variants={staggerItem}>
        <GlassCard className="p-4">
          <DhikrCounter
            dhikrTypes={dhikrTypes}
            dhikrLogs={dhikrLogs}
            onIncrement={incrementDhikr}
            onReset={resetDhikr}
            compact
          />
        </GlassCard>
      </motion.div>

      {/* Next Islamic event */}
      {nextEvent && (
        <motion.div variants={staggerItem}>
          <GlassCard
            pressable
            haptic="light"
            onClick={() => onNavigate('more')}
            className="p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Next Event</p>
                  <p className="font-medium truncate">{nextEvent.name}</p>
                  <p className="text-xs text-muted-foreground">{nextEvent.hijriDate}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-amber-500">
                  {daysUntilEvent === 0 ? 'Today' : `${daysUntilEvent}d`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(nextEvent.date, 'MMM d')}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
