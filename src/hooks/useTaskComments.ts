import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string | null;
  body: string;
  source: string;
  created_at: string;
  // Resolved client-side from the profiles table (not a real PostgREST
  // join — task_comments.author_id FKs to auth.users, not profiles).
  authorName?: string | null;
}

// Live comments on a single task. Plain CRUD over the task_comments
// table — RLS handles access, and the realtime subscription below
// folds in changes from teammates and Telegram /comment without a
// hard refresh.
export function useTaskComments(taskId: string | null) {
  const { user } = useAuth();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `silent` skips the loading-skeleton flicker so realtime echoes don't
  // erase the rendered list every time a comment lands. Only the initial
  // fetch (and explicit user-driven refresh) flips the loading flag.
  const refresh = useCallback(
    async (silent = false) => {
      if (!taskId) {
        setComments([]);
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("task_comments")
          .select("id, task_id, author_id, body, source, created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        const rows = (data as TaskComment[]) || [];

        // Resolve author names in a second query. We can't use PostgREST's
        // embed syntax because the FK on author_id is to auth.users, not
        // public.profiles, so PostgREST can't infer the relationship.
        const ids = Array.from(new Set(rows.map((r) => r.author_id).filter(Boolean) as string[]));
        let nameById = new Map<string, string | null>();
        if (ids.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", ids);
          nameById = new Map(
            (profs || []).map((p: { user_id: string; display_name: string | null }) => [
              p.user_id,
              p.display_name,
            ]),
          );
        }
        setComments(
          rows.map((r) => ({
            ...r,
            authorName: r.author_id ? (nameById.get(r.author_id) ?? null) : null,
          })),
        );
      } catch (e) {
        console.error("useTaskComments fetch failed", e);
        setError((e as Error).message || "Failed to load comments");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [taskId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates so a teammate's /comment in Telegram surfaces here
  // without a refresh. We refresh silently so the existing list stays
  // visible while we re-fetch — no skeleton flicker on every echo.
  useEffect(() => {
    if (!taskId) return;
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => refresh(true),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, refresh]);

  const post = useCallback(
    async (body: string) => {
      if (!user?.id || !taskId) return null;
      const trimmed = body.trim();
      if (!trimmed) return null;
      const { data, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, author_id: user.id, body: trimmed, source: "web" })
        .select("id, task_id, author_id, body, source, created_at")
        .single();
      if (error) throw error;
      return data as TaskComment;
    },
    [user?.id, taskId],
  );

  const remove = useCallback(async (commentId: string) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", commentId);
    if (error) throw error;
  }, []);

  return { comments, loading, error, refresh, post, remove };
}
