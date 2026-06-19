import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_type: "morning" | "evening";
  checkin_date: string;

  // Morning fields
  sleep_hours?: number;
  sleep_quality?: number;
  energy_level?: "low" | "medium" | "high";
  mood?: string;
  physical_symptoms?: string[];
  main_focus?: string;

  // Evening fields
  day_rating?: number;
  focus_completed?: boolean;
  went_well?: string;
  challenges?: string;
  tomorrow_priority?: string;
  gratitude_note?: string;

  // Wellness tracking fields
  stress_level?: number;
  focus_quality?: number;
  social_interactions?: number;
  medication_taken?: boolean;
  exercise_minutes?: number;
  caffeine_intake?: number;
  alcohol_units?: number;
  screen_time_minutes?: number;
  water_glasses?: number;

  created_at: string;
  updated_at: string;
}

export function useDailyCheckins() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [todayMorning, setTodayMorning] = useState<DailyCheckin | null>(null);
  const [todayEvening, setTodayEvening] = useState<DailyCheckin | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchCheckins = useCallback(
    async (days = 30) => {
      if (!user?.id) return;

      setIsLoading(true);
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data, error } = await supabase
          .from("daily_checkins")
          .select("*")
          .eq("user_id", user.id)
          .gte("checkin_date", format(startDate, "yyyy-MM-dd"))
          .order("checkin_date", { ascending: false });

        if (error) throw error;

        const typedData = (data || []) as DailyCheckin[];
        setCheckins(typedData);

        // Find today's checkins
        const today = format(new Date(), "yyyy-MM-dd");
        setTodayMorning(
          typedData.find((c) => c.checkin_date === today && c.checkin_type === "morning") || null,
        );
        setTodayEvening(
          typedData.find((c) => c.checkin_date === today && c.checkin_type === "evening") || null,
        );
      } catch (error) {
        console.error("Error fetching checkins:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.id],
  );

  const saveCheckin = useCallback(
    async (type: "morning" | "evening", data: Partial<DailyCheckin>) => {
      if (!user?.id) return null;

      const today = format(new Date(), "yyyy-MM-dd");
      const existing = type === "morning" ? todayMorning : todayEvening;

      try {
        if (existing) {
          // Update existing
          const { data: updated, error } = await supabase
            .from("daily_checkins")
            .update({
              ...data,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (error) throw error;

          if (type === "morning") {
            setTodayMorning(updated as DailyCheckin);
          } else {
            setTodayEvening(updated as DailyCheckin);
          }

          return updated;
        } else {
          // Create new
          const { data: created, error } = await supabase
            .from("daily_checkins")
            .insert({
              user_id: user.id,
              checkin_type: type,
              checkin_date: today,
              ...data,
            })
            .select()
            .single();

          if (error) throw error;

          if (type === "morning") {
            setTodayMorning(created as DailyCheckin);
          } else {
            setTodayEvening(created as DailyCheckin);
          }

          return created;
        }
      } catch (error) {
        console.error("Error saving checkin:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to save check-in",
        });
        return null;
      }
    },
    [user?.id, todayMorning, todayEvening],
  );

  const needsMorningCheckin = useCallback(() => {
    if (!user?.id) return false;
    return !todayMorning;
  }, [user?.id, todayMorning]);

  const needsEveningCheckin = useCallback(() => {
    if (!user?.id) return false;
    const hour = new Date().getHours();
    return hour >= 18 && !todayEvening;
  }, [user?.id, todayEvening]);

  const getRecentMoods = useCallback(() => {
    return checkins
      .filter((c) => c.mood)
      .slice(0, 7)
      .map((c) => ({
        date: c.checkin_date,
        mood: c.mood!,
        energy: c.energy_level,
      }));
  }, [checkins]);

  const getAverageStats = useCallback(
    (days = 7) => {
      const recent = checkins.slice(0, days * 2); // morning + evening

      const sleepData = recent.filter((c) => c.sleep_hours).map((c) => c.sleep_hours!);
      const energyMap = { low: 1, medium: 2, high: 3 };
      const energyData = recent
        .filter((c) => c.energy_level)
        .map((c) => energyMap[c.energy_level!]);
      const ratingData = recent.filter((c) => c.day_rating).map((c) => c.day_rating!);
      const stressData = recent.filter((c) => c.stress_level).map((c) => c.stress_level!);
      const focusData = recent.filter((c) => c.focus_quality).map((c) => c.focus_quality!);
      const exerciseData = recent.filter((c) => c.exercise_minutes).map((c) => c.exercise_minutes!);
      const waterData = recent.filter((c) => c.water_glasses).map((c) => c.water_glasses!);

      return {
        avgSleep: sleepData.length ? sleepData.reduce((a, b) => a + b, 0) / sleepData.length : 0,
        avgEnergy: energyData.length
          ? energyData.reduce((a, b) => a + b, 0) / energyData.length
          : 0,
        avgDayRating: ratingData.length
          ? ratingData.reduce((a, b) => a + b, 0) / ratingData.length
          : 0,
        avgStress: stressData.length
          ? stressData.reduce((a, b) => a + b, 0) / stressData.length
          : 0,
        avgFocus: focusData.length ? focusData.reduce((a, b) => a + b, 0) / focusData.length : 0,
        avgExercise: exerciseData.length
          ? exerciseData.reduce((a, b) => a + b, 0) / exerciseData.length
          : 0,
        avgWater: waterData.length ? waterData.reduce((a, b) => a + b, 0) / waterData.length : 0,
        focusCompletionRate:
          recent.filter((c) => c.focus_completed).length /
          Math.max(recent.filter((c) => c.focus_completed !== undefined).length, 1),
      };
    },
    [checkins],
  );

  // Get wellness trends for the last N days
  const getWellnessTrends = useCallback(
    (days = 14) => {
      const recentCheckins = checkins.filter((c) => c.checkin_type === "evening").slice(0, days);

      return recentCheckins
        .map((c) => ({
          date: c.checkin_date,
          stress: c.stress_level,
          focus: c.focus_quality,
          exercise: c.exercise_minutes,
          water: c.water_glasses,
          social: c.social_interactions,
          dayRating: c.day_rating,
        }))
        .reverse();
    },
    [checkins],
  );

  useEffect(() => {
    fetchCheckins();
  }, [fetchCheckins]);

  return {
    checkins,
    todayMorning,
    todayEvening,
    isLoading,
    saveCheckin,
    fetchCheckins,
    needsMorningCheckin,
    needsEveningCheckin,
    getRecentMoods,
    getAverageStats,
    getWellnessTrends,
  };
}
