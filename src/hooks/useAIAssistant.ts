import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { Task, CalendarEvent } from "@/types/flux";
import { toast } from "@/hooks/use-toast";

interface SubtaskSuggestion {
  title: string;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
}

interface RescheduleSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedDate: string;
  suggestedTime: string;
  reason: string;
}

interface DayPlanScheduleItem {
  time: string;
  taskId: string | null;
  title: string;
  duration: number;
  type: "task" | "break" | "focus";
}

interface DayPlan {
  schedule: DayPlanScheduleItem[];
  summary: string;
  tips: string[];
}

export function useAIAssistant() {
  const [isLoading, setIsLoading] = useState(false);
  const [breakdownResult, setBreakdownResult] = useState<SubtaskSuggestion[] | null>(null);
  const [rescheduleResult, setRescheduleResult] = useState<RescheduleSuggestion[] | null>(null);
  const [dayPlanResult, setDayPlanResult] = useState<DayPlan | null>(null);

  const breakdownTask = useCallback(async (task: Task): Promise<SubtaskSuggestion[]> => {
    setIsLoading(true);
    setBreakdownResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          type: "breakdown",
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            completed: task.completed,
          },
        },
      });

      if (error) throw error;

      // Handle array response directly or extract from object
      const subtasks = Array.isArray(data) ? data : data.subtasks || data;

      if (!Array.isArray(subtasks)) {
        throw new Error("Invalid response format");
      }

      setBreakdownResult(subtasks);
      return subtasks;
    } catch (error) {
      console.error("Task breakdown error:", error);
      toast({
        variant: "destructive",
        title: "AI Error",
        description: await describeEdgeError(error, "Failed to break down task"),
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const suggestReschedule = useCallback(
    async (tasks: Task[], events: CalendarEvent[]): Promise<RescheduleSuggestion[]> => {
      setIsLoading(true);
      setRescheduleResult(null);

      try {
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: {
            type: "reschedule",
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              category: t.category,
              priority: t.priority,
              completed: t.completed,
              dueDate: t.dueDate?.toISOString(),
            })),
            events: events.map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime.toISOString(),
              endTime: e.endTime.toISOString(),
            })),
          },
        });

        if (error) throw error;

        if (data.message) {
          toast({
            title: "No Overdue Tasks",
            description: data.message,
          });
          return [];
        }

        const suggestions = Array.isArray(data) ? data : data.suggestions || data;

        if (!Array.isArray(suggestions)) {
          throw new Error("Invalid response format");
        }

        setRescheduleResult(suggestions);
        return suggestions;
      } catch (error) {
        console.error("Reschedule suggestion error:", error);
        toast({
          variant: "destructive",
          title: "AI Error",
          description: await describeEdgeError(error, "Failed to suggest reschedule"),
        });
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const planMyDay = useCallback(
    async (tasks: Task[], events: CalendarEvent[]): Promise<DayPlan | null> => {
      setIsLoading(true);
      setDayPlanResult(null);

      try {
        const { data, error } = await supabase.functions.invoke("ai-assistant", {
          body: {
            type: "plan_day",
            tasks: tasks.map((t) => ({
              id: t.id,
              title: t.title,
              category: t.category,
              priority: t.priority,
              completed: t.completed,
              dueDate: t.dueDate?.toISOString(),
            })),
            events: events.map((e) => ({
              id: e.id,
              title: e.title,
              startTime: e.startTime.toISOString(),
              endTime: e.endTime.toISOString(),
            })),
          },
        });

        if (error) throw error;

        if (!data.schedule) {
          throw new Error("Invalid day plan response");
        }

        setDayPlanResult(data);
        return data;
      } catch (error) {
        console.error("Day planning error:", error);
        toast({
          variant: "destructive",
          title: "AI Error",
          description: await describeEdgeError(error, "Failed to plan your day"),
        });
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearResults = useCallback(() => {
    setBreakdownResult(null);
    setRescheduleResult(null);
    setDayPlanResult(null);
  }, []);

  return {
    isLoading,
    breakdownResult,
    rescheduleResult,
    dayPlanResult,
    breakdownTask,
    suggestReschedule,
    planMyDay,
    clearResults,
  };
}
