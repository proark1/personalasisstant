import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import confetti from "canvas-confetti";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface UserXP {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  badges: Badge[];
  weekly_xp: number;
  weekly_tasks_completed: number;
  weekly_focus_minutes: number;
  weekly_habits_logged: number;
  week_start_date: string | null;
}

// XP values for different actions
export const XP_VALUES = {
  TASK_COMPLETE: 10,
  HIGH_PRIORITY_TASK: 20,
  HABIT_LOG: 5,
  FOCUS_SESSION: 25,
  DAILY_CHECKIN: 15,
  STREAK_BONUS: 5, // per day of streak
  WEEKLY_GOAL: 50,
};

// Level thresholds
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000, 25000,
];

// Badge definitions
export const BADGES = {
  FIRST_TASK: {
    id: "first_task",
    name: "First Step",
    description: "Complete your first task",
    icon: "🎯",
  },
  STREAK_3: { id: "streak_3", name: "On Fire", description: "3-day streak", icon: "🔥" },
  STREAK_7: { id: "streak_7", name: "Week Warrior", description: "7-day streak", icon: "⚡" },
  STREAK_30: {
    id: "streak_30",
    name: "Consistency King",
    description: "30-day streak",
    icon: "👑",
  },
  FOCUS_MASTER: {
    id: "focus_master",
    name: "Focus Master",
    description: "Complete 10 focus sessions",
    icon: "🧘",
  },
  HABIT_HERO: { id: "habit_hero", name: "Habit Hero", description: "Log 50 habits", icon: "💪" },
  EARLY_BIRD: {
    id: "early_bird",
    name: "Early Bird",
    description: "Complete morning check-in 7 days in a row",
    icon: "🌅",
  },
  NIGHT_OWL: {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete evening reflection 7 days in a row",
    icon: "🦉",
  },
  LEVEL_5: { id: "level_5", name: "Rising Star", description: "Reach level 5", icon: "⭐" },
  LEVEL_10: { id: "level_10", name: "Superstar", description: "Reach level 10", icon: "🌟" },
};

export function useGamification() {
  const { user } = useAuth();
  const [userXP, setUserXP] = useState<UserXP | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUserXP = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_xp")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserXP({
          ...data,
          badges: Array.isArray(data.badges) ? (data.badges as unknown as Badge[]) : [],
        });
      } else {
        // Create initial XP record
        const { data: newData, error: createError } = await supabase
          .from("user_xp")
          .insert({
            user_id: user.id,
            total_xp: 0,
            current_level: 1,
            current_streak: 0,
            longest_streak: 0,
            badges: [],
            weekly_xp: 0,
            weekly_tasks_completed: 0,
            weekly_focus_minutes: 0,
            weekly_habits_logged: 0,
            week_start_date: format(new Date(), "yyyy-MM-dd"),
          })
          .select()
          .single();

        if (createError) throw createError;

        setUserXP({
          ...newData,
          badges: [],
        });
      }
    } catch (error) {
      console.error("Error fetching XP:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const calculateLevel = (xp: number): number => {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
  };

  const getXPToNextLevel = (
    xp: number,
  ): { current: number; needed: number; percentage: number } => {
    const level = calculateLevel(xp);
    const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];

    const current = xp - currentThreshold;
    const needed = nextThreshold - currentThreshold;

    return {
      current,
      needed,
      percentage: Math.min((current / needed) * 100, 100),
    };
  };

  const triggerCelebration = (type: "xp" | "level" | "badge" | "streak") => {
    if (type === "level") {
      // Big celebration for level up
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else if (type === "badge") {
      // Medium celebration for badge
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.5 },
      });
    } else {
      // Small celebration for XP/streak
      confetti({
        particleCount: 20,
        spread: 45,
        origin: { y: 0.7 },
      });
    }
  };

  const addXP = useCallback(
    async (
      amount: number,
      reason: string,
      options?: { silent?: boolean },
    ): Promise<{ newXP: number; levelUp: boolean; newBadges: Badge[] }> => {
      if (!user?.id || !userXP) {
        return { newXP: 0, levelUp: false, newBadges: [] };
      }

      const today = format(new Date(), "yyyy-MM-dd");
      const oldLevel = userXP.current_level;
      const newTotalXP = userXP.total_xp + amount;
      const newLevel = calculateLevel(newTotalXP);
      const levelUp = newLevel > oldLevel;

      // Update streak
      let newStreak = userXP.current_streak;
      let longestStreak = userXP.longest_streak;

      if (userXP.last_activity_date !== today) {
        const lastDate = userXP.last_activity_date ? new Date(userXP.last_activity_date) : null;
        const todayDate = new Date(today);

        if (lastDate) {
          const diffDays = Math.floor(
            (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          if (diffDays === 1) {
            newStreak += 1;
          } else if (diffDays > 1) {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }

        longestStreak = Math.max(longestStreak, newStreak);
      }

      // Check for new badges
      const newBadges: Badge[] = [];
      const existingBadgeIds = userXP.badges.map((b) => b.id);

      // Streak badges
      if (newStreak >= 3 && !existingBadgeIds.includes("streak_3")) {
        newBadges.push({ ...BADGES.STREAK_3, earnedAt: new Date().toISOString() });
      }
      if (newStreak >= 7 && !existingBadgeIds.includes("streak_7")) {
        newBadges.push({ ...BADGES.STREAK_7, earnedAt: new Date().toISOString() });
      }
      if (newStreak >= 30 && !existingBadgeIds.includes("streak_30")) {
        newBadges.push({ ...BADGES.STREAK_30, earnedAt: new Date().toISOString() });
      }

      // Level badges
      if (newLevel >= 5 && !existingBadgeIds.includes("level_5")) {
        newBadges.push({ ...BADGES.LEVEL_5, earnedAt: new Date().toISOString() });
      }
      if (newLevel >= 10 && !existingBadgeIds.includes("level_10")) {
        newBadges.push({ ...BADGES.LEVEL_10, earnedAt: new Date().toISOString() });
      }

      try {
        const allBadges = [...userXP.badges, ...newBadges];
        const { error } = await supabase
          .from("user_xp")
          .update({
            total_xp: newTotalXP,
            current_level: newLevel,
            current_streak: newStreak,
            longest_streak: longestStreak,
            last_activity_date: today,
            badges: JSON.parse(JSON.stringify(allBadges)),
            weekly_xp: userXP.weekly_xp + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userXP.id);

        if (error) throw error;

        // Update local state
        setUserXP((prev) =>
          prev
            ? {
                ...prev,
                total_xp: newTotalXP,
                current_level: newLevel,
                current_streak: newStreak,
                longest_streak: longestStreak,
                last_activity_date: today,
                badges: [...prev.badges, ...newBadges],
                weekly_xp: prev.weekly_xp + amount,
              }
            : null,
        );

        // Celebrations
        if (!options?.silent) {
          if (levelUp) {
            triggerCelebration("level");
            toast({
              title: `🎉 Level Up!`,
              description: `You've reached level ${newLevel}!`,
            });
          } else if (newBadges.length > 0) {
            triggerCelebration("badge");
            newBadges.forEach((badge) => {
              toast({
                title: `${badge.icon} New Badge!`,
                description: badge.name,
              });
            });
          } else {
            triggerCelebration("xp");
          }
        }

        return { newXP: newTotalXP, levelUp, newBadges };
      } catch (error) {
        console.error("Error adding XP:", error);
        return { newXP: userXP.total_xp, levelUp: false, newBadges: [] };
      }
    },
    [user?.id, userXP],
  );

  const incrementWeeklyStat = useCallback(
    async (stat: "tasks" | "focus_minutes" | "habits", amount = 1) => {
      if (!user?.id || !userXP) return;

      const field =
        stat === "tasks"
          ? "weekly_tasks_completed"
          : stat === "focus_minutes"
            ? "weekly_focus_minutes"
            : "weekly_habits_logged";

      try {
        const { error } = await supabase
          .from("user_xp")
          .update({
            [field]: ((userXP[field as keyof UserXP] as number) || 0) + amount,
          } as TablesUpdate<"user_xp">)
          .eq("id", userXP.id);

        if (error) throw error;

        setUserXP((prev) =>
          prev
            ? {
                ...prev,
                [field]: ((prev[field as keyof UserXP] as number) || 0) + amount,
              }
            : null,
        );
      } catch (error) {
        console.error("Error updating weekly stat:", error);
      }
    },
    [user?.id, userXP],
  );

  useEffect(() => {
    fetchUserXP();
  }, [fetchUserXP]);

  return {
    userXP,
    isLoading,
    addXP,
    incrementWeeklyStat,
    calculateLevel,
    getXPToNextLevel,
    XP_VALUES,
    BADGES,
    fetchUserXP,
  };
}
