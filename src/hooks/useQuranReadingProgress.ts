import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

interface ReadingProgress {
  id: string;
  surah_number: number;
  ayah_number: number;
  read_at: string;
}

interface ReadingGoal {
  id: string;
  daily_ayahs_goal: number;
  daily_pages_goal: number | null;
  daily_surahs_goal: number | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
}

interface DailyStats {
  date: string;
  ayahsRead: number;
}

const DEFAULT_GOAL: Omit<ReadingGoal, "id"> = {
  daily_ayahs_goal: 10,
  daily_pages_goal: null,
  daily_surahs_goal: null,
  reminder_enabled: false,
  reminder_time: null,
};

export function useQuranReadingProgress() {
  const { user } = useAuth();
  const [todayProgress, setTodayProgress] = useState<ReadingProgress[]>([]);
  const [allProgress, setAllProgress] = useState<ReadingProgress[]>([]);
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAyahsRead, setTotalAyahsRead] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);

  const fetchProgress = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Fetch today's progress
      const { data: todayData } = await supabase
        .from("quran_reading_progress")
        .select("*")
        .eq("user_id", user.id)
        .gte("read_at", todayStart)
        .lte("read_at", todayEnd);

      setTodayProgress(todayData || []);

      // Fetch all progress for stats
      const { data: allData } = await supabase
        .from("quran_reading_progress")
        .select("*")
        .eq("user_id", user.id)
        .order("read_at", { ascending: false });

      setAllProgress(allData || []);
      setTotalAyahsRead(allData?.length || 0);

      // Calculate weekly stats
      const weekStats: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const day = subDays(today, i);
        const dayStart = startOfDay(day).toISOString();
        const dayEnd = endOfDay(day).toISOString();
        const dayData = allData?.filter((p) => p.read_at >= dayStart && p.read_at <= dayEnd) || [];
        weekStats.push({
          date: format(day, "EEE"),
          ayahsRead: dayData.length,
        });
      }
      setWeeklyStats(weekStats);

      // Calculate streak
      let streak = 0;
      let checkDate = today;
      while (true) {
        const dayStart = startOfDay(checkDate).toISOString();
        const dayEnd = endOfDay(checkDate).toISOString();
        const dayData = allData?.filter((p) => p.read_at >= dayStart && p.read_at <= dayEnd) || [];
        if (dayData.length > 0) {
          streak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
      setCurrentStreak(streak);
    } catch (error) {
      console.error("Error fetching reading progress:", error);
    }
  }, [user]);

  const fetchGoal = useCallback(async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("quran_reading_goals")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setGoal(data);
      } else {
        // Create default goal
        const { data: newGoal } = await supabase
          .from("quran_reading_goals")
          .insert({ user_id: user.id, ...DEFAULT_GOAL })
          .select()
          .single();
        setGoal(newGoal);
      }
    } catch (error) {
      console.error("Error fetching reading goal:", error);
    }
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProgress(), fetchGoal()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProgress, fetchGoal]);

  const markAyahAsRead = useCallback(
    async (surahNumber: number, ayahNumber: number) => {
      if (!user) return;

      try {
        await supabase.from("quran_reading_progress").upsert(
          {
            user_id: user.id,
            surah_number: surahNumber,
            ayah_number: ayahNumber,
            read_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,surah_number,ayah_number",
          },
        );

        await fetchProgress();
      } catch (error) {
        console.error("Error marking ayah as read:", error);
      }
    },
    [user, fetchProgress],
  );

  const markSurahAsRead = useCallback(
    async (surahNumber: number, totalAyahs: number) => {
      if (!user) return;

      try {
        const records = Array.from({ length: totalAyahs }, (_, i) => ({
          user_id: user.id,
          surah_number: surahNumber,
          ayah_number: i + 1,
          read_at: new Date().toISOString(),
        }));

        // Batch insert in chunks
        const chunkSize = 50;
        for (let i = 0; i < records.length; i += chunkSize) {
          const chunk = records.slice(i, i + chunkSize);
          await supabase.from("quran_reading_progress").upsert(chunk, {
            onConflict: "user_id,surah_number,ayah_number",
          });
        }

        await fetchProgress();
      } catch (error) {
        console.error("Error marking surah as read:", error);
      }
    },
    [user, fetchProgress],
  );

  const updateGoal = useCallback(
    async (updates: Partial<Omit<ReadingGoal, "id">>) => {
      if (!user || !goal) return;

      try {
        const { data } = await supabase
          .from("quran_reading_goals")
          .update(updates)
          .eq("user_id", user.id)
          .select()
          .single();

        if (data) {
          setGoal(data);
        }
      } catch (error) {
        console.error("Error updating goal:", error);
      }
    },
    [user, goal],
  );

  const isAyahRead = useCallback(
    (surahNumber: number, ayahNumber: number) => {
      return allProgress.some(
        (p) => p.surah_number === surahNumber && p.ayah_number === ayahNumber,
      );
    },
    [allProgress],
  );

  const getSurahProgress = useCallback(
    (surahNumber: number, totalAyahs: number) => {
      const readAyahs = allProgress.filter((p) => p.surah_number === surahNumber).length;
      return {
        read: readAyahs,
        total: totalAyahs,
        percentage: totalAyahs > 0 ? (readAyahs / totalAyahs) * 100 : 0,
      };
    },
    [allProgress],
  );

  const todayAyahsRead = todayProgress.length;
  const todayGoalProgress = goal ? (todayAyahsRead / goal.daily_ayahs_goal) * 100 : 0;

  return {
    loading,
    todayProgress,
    todayAyahsRead,
    todayGoalProgress,
    goal,
    weeklyStats,
    totalAyahsRead,
    currentStreak,
    markAyahAsRead,
    markSurahAsRead,
    updateGoal,
    isAyahRead,
    getSurahProgress,
    refetch: fetchProgress,
  };
}
