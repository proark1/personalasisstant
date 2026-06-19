import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export interface Goal {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  targetDate: Date | null;
  linkedHabits: string[];
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function useGoals(userId: string | undefined) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .order("is_completed", { ascending: true })
        .order("target_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      setGoals(
        (data || []).map((g) => ({
          id: g.id,
          userId: g.user_id,
          name: g.name,
          description: g.description,
          icon: g.icon,
          color: g.color,
          targetValue: Number(g.target_value),
          currentValue: Number(g.current_value),
          unit: g.unit,
          targetDate: g.target_date ? new Date(g.target_date) : null,
          linkedHabits: g.linked_habits || [],
          isCompleted: g.is_completed,
          completedAt: g.completed_at ? new Date(g.completed_at) : null,
          createdAt: new Date(g.created_at),
          updatedAt: new Date(g.updated_at),
        })),
      );
    } catch (error) {
      console.error("[goals] Fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createGoal = useCallback(
    async (
      goal: Omit<Goal, "id" | "userId" | "createdAt" | "updatedAt" | "isCompleted" | "completedAt">,
    ) => {
      if (!userId) return null;

      try {
        const { data, error } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            name: goal.name,
            description: goal.description,
            icon: goal.icon,
            color: goal.color,
            target_value: goal.targetValue,
            current_value: goal.currentValue,
            unit: goal.unit,
            target_date: goal.targetDate?.toISOString().split("T")[0],
            linked_habits: goal.linkedHabits,
          })
          .select()
          .single();

        if (error) throw error;

        const newGoal: Goal = {
          id: data.id,
          userId: data.user_id,
          name: data.name,
          description: data.description,
          icon: data.icon,
          color: data.color,
          targetValue: Number(data.target_value),
          currentValue: Number(data.current_value),
          unit: data.unit,
          targetDate: data.target_date ? new Date(data.target_date) : null,
          linkedHabits: data.linked_habits || [],
          isCompleted: data.is_completed,
          completedAt: data.completed_at ? new Date(data.completed_at) : null,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        };

        setGoals((prev) => [...prev, newGoal]);
        toast({
          title: t("goals.created"),
          description: t("goals.createdDesc").replace("{name}", () => goal.name),
        });
        return newGoal;
      } catch (error) {
        console.error("[goals] Create error:", error);
        toast({
          title: t("toast.error"),
          description: t("goals.errorCreate"),
          variant: "destructive",
        });
        return null;
      }
    },
    [userId, toast, t],
  );

  const updateGoalProgress = useCallback(
    async (goalId: string, newValue: number) => {
      try {
        const goal = goals.find((g) => g.id === goalId);
        if (!goal) return;

        const isCompleted = newValue >= goal.targetValue;

        const { error } = await supabase
          .from("goals")
          .update({
            current_value: newValue,
            is_completed: isCompleted,
            completed_at: isCompleted ? new Date().toISOString() : null,
          })
          .eq("id", goalId);

        if (error) throw error;

        setGoals((prev) =>
          prev.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  currentValue: newValue,
                  isCompleted,
                  completedAt: isCompleted ? new Date() : null,
                  updatedAt: new Date(),
                }
              : g,
          ),
        );

        if (isCompleted) {
          toast({
            title: t("goals.achieved"),
            description: t("goals.achievedDesc").replace("{name}", () => goal.name),
          });
        }
      } catch (error) {
        console.error("[goals] Update error:", error);
        toast({
          title: t("toast.error"),
          description: t("goals.errorUpdate"),
          variant: "destructive",
        });
      }
    },
    [goals, toast, t],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      try {
        const { error } = await supabase.from("goals").delete().eq("id", goalId);

        if (error) throw error;

        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        toast({ title: t("goals.removed"), description: t("goals.removedDesc") });
      } catch (error) {
        console.error("[goals] Delete error:", error);
        toast({
          title: t("toast.error"),
          description: t("goals.errorDelete"),
          variant: "destructive",
        });
      }
    },
    [toast, t],
  );

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    loading,
    refetch: fetchGoals,
    createGoal,
    updateGoalProgress,
    deleteGoal,
  };
}
