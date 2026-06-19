import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { fetchWithRetry, TimeoutError } from "@/lib/fetchWithTimeout";

export interface HouseholdTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  assigned_to: string | null;
  due_date: string | null;
  recurrence_rule: string | null;
  is_completed: boolean;
  completed_at: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export type HouseholdTaskInsert = Omit<HouseholdTask, "id" | "created_at" | "updated_at">;
export type HouseholdTaskUpdate = Partial<HouseholdTaskInsert>;

export function useHouseholdTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HouseholdTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTasks = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setFetchError(null);

    try {
      const { data, error } = await fetchWithRetry(
        async () =>
          supabase
            .from("household_tasks")
            .select("*")
            .order("due_date", { ascending: true, nullsFirst: false }),
        { maxRetries: 2, timeoutMs: 12000 },
      );

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error(
        "Error fetching household tasks:",
        error instanceof Error ? error.message : String(error),
      );
      if (error instanceof TimeoutError) {
        setFetchError("Loading took too long. Tap to retry.");
      } else {
        setFetchError("Failed to load household tasks.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    // fetchTasks is defined locally; user is the intended trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addTask = async (task: Omit<HouseholdTaskInsert, "user_id">) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("household_tasks")
        .insert({
          ...task,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setTasks((prev) => [...prev, data]);
      toast.success("Household task added");
      return data;
    } catch (error) {
      console.error(
        "Error adding household task:",
        error instanceof Error ? error.message : String(error),
      );
      toast.error("Failed to add household task");
      return null;
    }
  };

  const updateTask = async (id: string, updates: HouseholdTaskUpdate) => {
    try {
      const { data, error } = await supabase
        .from("household_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
      toast.success("Task updated");
      return data;
    } catch (error) {
      console.error(
        "Error updating household task:",
        error instanceof Error ? error.message : String(error),
      );
      toast.error("Failed to update task");
      return null;
    }
  };

  const toggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;

    return updateTask(id, {
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? new Date().toISOString() : null,
    });
  };

  const deleteTask = async (id: string) => {
    try {
      const { error } = await supabase.from("household_tasks").delete().eq("id", id);

      if (error) throw error;

      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task deleted");
      return true;
    } catch (error) {
      console.error(
        "Error deleting household task:",
        error instanceof Error ? error.message : String(error),
      );
      toast.error("Failed to delete task");
      return false;
    }
  };

  // Filter helpers
  const getPendingTasks = () => tasks.filter((t) => !t.is_completed);
  const getCompletedTasks = () => tasks.filter((t) => t.is_completed);
  const getTasksByCategory = (category: string) => tasks.filter((t) => t.category === category);
  const getTasksByAssignee = (memberId: string) => tasks.filter((t) => t.assigned_to === memberId);
  const getOverdueTasks = () => {
    const now = new Date();
    return tasks.filter((t) => !t.is_completed && t.due_date && new Date(t.due_date) < now);
  };

  return {
    tasks,
    isLoading,
    fetchError,
    addTask,
    updateTask,
    toggleComplete,
    deleteTask,
    getPendingTasks,
    getCompletedTasks,
    getTasksByCategory,
    getTasksByAssignee,
    getOverdueTasks,
    refetch: fetchTasks,
  };
}
