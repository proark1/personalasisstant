import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { staggerItem } from "@/components/ui/panel-shell";
import { Clock, BookOpen, Flame, Calendar, CheckCircle2, MessageSquareQuote } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { DhikrCounter } from "./DhikrCounter";
import { useQuranReadingProgress } from "@/hooks/useQuranReadingProgress";
import type { IslamicEvent } from "@/hooks/useIslamicFeatures";

// Small curated hadith list for daily display
const DAILY_HADITHS = [
  {
    text: "The best of you are those who learn the Quran and teach it.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "None of you truly believes until he loves for his brother what he loves for himself.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "The strong man is not one who is good at wrestling, but the strong man is one who controls himself in a fit of rage.",
    source: "Sahih al-Bukhari",
  },
  { text: "Every act of kindness is charity.", source: "Sahih al-Bukhari" },
  {
    text: "Make things easy and do not make them difficult. Give glad tidings and do not repel people.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "Whoever believes in Allah and the Last Day, let him speak good or remain silent.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "The most beloved of deeds to Allah are those that are most consistent, even if they are small.",
    source: "Sahih al-Bukhari",
  },
  {
    text: "He who is not grateful to the people is not grateful to Allah.",
    source: "Sunan Abu Dawud",
  },
  {
    text: "Take advantage of five before five: your youth before your old age, your health before your illness, your wealth before your poverty, your free time before your work, and your life before your death.",
    source: "Shu'ab al-Iman",
  },
  { text: "Verily, with hardship comes ease.", source: "Quran 94:6" },
];

interface IslamOverviewTabProps {
  hijriToday: { day: number; month: number; year: number; monthName: string };
  islamicEvents: IslamicEvent[];
  dhikrTypes: { id: string; arabic: string; english: string; defaultTarget: number }[];
  dhikrLogs: {
    id: string;
    dhikr_type: string;
    target_count: number;
    completed_count: number;
    log_date: string;
  }[];
  incrementDhikr: (type: string) => void;
  resetDhikr: (type: string) => void;
  nextPrayerName?: string;
  nextPrayerTime?: string;
  countdown?: string;
  onNavigate: (tab: string) => void;
}

function getPrayerCompletion(): { completed: number; total: number } {
  const key = `completed-prayers-${format(new Date(), "yyyy-MM-dd")}`;
  try {
    const data = localStorage.getItem(key);
    if (!data) return { completed: 0, total: 5 };
    const parsed = JSON.parse(data);
    const completed = Object.values(parsed).filter(Boolean).length;
    return { completed, total: 5 };
  } catch {
    return { completed: 0, total: 5 };
  }
}

function getDailyHadith() {
  // Deterministic daily selection based on day of year
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return DAILY_HADITHS[dayOfYear % DAILY_HADITHS.length];
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
  const [prayerCompletion, setPrayerCompletion] = useState(getPrayerCompletion());
  const dailyHadith = useMemo(() => getDailyHadith(), []);

  // Refresh prayer completion periodically
  useEffect(() => {
    const interval = setInterval(() => setPrayerCompletion(getPrayerCompletion()), 10000);
    return () => clearInterval(interval);
  }, []);

  const nextEvent = useMemo(() => {
    const now = new Date();
    return islamicEvents.find((e) => e.date >= now);
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
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </GlassCard>
      </motion.div>

      {/* Next prayer card with completion badge */}
      {nextPrayerName && countdown && (
        <motion.div variants={staggerItem}>
          <GlassCard pressable haptic="light" onClick={() => onNavigate("prayer")} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Next Prayer</p>
                    <Badge variant="secondary" className="text-xs gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {prayerCompletion.completed}/{prayerCompletion.total}
                    </Badge>
                  </div>
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

      {/* Daily Hadith */}
      <motion.div variants={staggerItem}>
        <GlassCard pressable haptic="light" onClick={() => onNavigate("more")} className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquareQuote className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground mb-1">Daily Hadith</p>
              <p className="text-sm font-medium leading-relaxed">"{dailyHadith.text}"</p>
              <p className="text-xs text-muted-foreground mt-1">— {dailyHadith.source}</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Quran progress */}
      <motion.div variants={staggerItem}>
        <GlassCard pressable haptic="light" onClick={() => onNavigate("quran")} className="p-4">
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
          <GlassCard pressable haptic="light" onClick={() => onNavigate("more")} className="p-4">
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
                  {daysUntilEvent === 0 ? "Today" : `${daysUntilEvent}d`}
                </p>
                <p className="text-xs text-muted-foreground">{format(nextEvent.date, "MMM d")}</p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  );
}
