import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { TaskCategory, TaskPriority } from "@/types/flux";

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  recurrenceRule?: string;
  reminderBefore?: number;
  createdAt: Date;
}

interface DbTaskTemplate {
  id: string;
  user_id: string;
  name: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  recurrence_rule: string | null;
  reminder_before: number | null;
  created_at: string;
}

export function useTaskTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTemplates(
        data.map((t: DbTaskTemplate) => ({
          id: t.id,
          name: t.name,
          title: t.title,
          description: t.description || undefined,
          category: t.category as TaskCategory,
          priority: t.priority as TaskPriority,
          recurrenceRule: t.recurrence_rule || undefined,
          reminderBefore: t.reminder_before || undefined,
          createdAt: new Date(t.created_at),
        })),
      );
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = useCallback(
    async (template: Omit<TaskTemplate, "id" | "createdAt">) => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("task_templates")
        .insert({
          user_id: user.id,
          name: template.name,
          title: template.title,
          description: template.description,
          category: template.category,
          priority: template.priority,
          recurrence_rule: template.recurrenceRule,
          reminder_before: template.reminderBefore,
        })
        .select()
        .single();

      if (!error && data) {
        const newTemplate: TaskTemplate = {
          id: data.id,
          name: data.name,
          title: data.title,
          description: data.description || undefined,
          category: data.category as TaskCategory,
          priority: data.priority as TaskPriority,
          recurrenceRule: data.recurrence_rule || undefined,
          reminderBefore: data.reminder_before || undefined,
          createdAt: new Date(data.created_at),
        };
        setTemplates((prev) => [newTemplate, ...prev]);
        return newTemplate;
      }
      return null;
    },
    [user],
  );

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from("task_templates").delete().eq("id", id);

    if (!error) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
    return { error: error?.message || null };
  }, []);

  return {
    templates,
    loading,
    createTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  };
}
