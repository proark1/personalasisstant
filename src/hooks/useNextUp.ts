import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface NextUpItem {
  id: string;
  type: "event" | "task";
  title: string;
  startTime: string;
  location?: string | null;
  minutesUntil: number;
}

/** Returns the next 1-2 upcoming events/tasks within the next 24h, refreshing every 30s. */
export function useNextUp(limit = 2) {
  const { user } = useAuth();
  const [items, setItems] = useState<NextUpItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    const fetchNext = async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const [{ data: events }, { data: tasks }] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, start_time, location")
          .eq("user_id", user.id)
          .gte("start_time", now.toISOString())
          .lte("start_time", horizon.toISOString())
          .order("start_time", { ascending: true })
          .limit(limit),
        supabase
          .from("tasks")
          .select("id, title, due_date")
          .eq("user_id", user.id)
          .eq("completed", false)
          .not("due_date", "is", null)
          .gte("due_date", now.toISOString())
          .lte("due_date", horizon.toISOString())
          .order("due_date", { ascending: true })
          .limit(limit),
      ]);

      const merged: NextUpItem[] = [
        ...(events || []).map((e) => ({
          id: e.id,
          type: "event" as const,
          title: e.title,
          startTime: e.start_time,
          location: e.location,
          minutesUntil: Math.round((new Date(e.start_time).getTime() - Date.now()) / 60000),
        })),
        ...(tasks || []).map((t) => ({
          id: t.id,
          type: "task" as const,
          title: t.title,
          startTime: t.due_date as string,
          minutesUntil: Math.round((new Date(t.due_date as string).getTime() - Date.now()) / 60000),
        })),
      ]
        .sort((a, b) => a.minutesUntil - b.minutesUntil)
        .slice(0, limit);

      setItems(merged);
      setLoading(false);
    };

    fetchNext();
    const interval = setInterval(fetchNext, 30_000);
    return () => clearInterval(interval);
  }, [user?.id, limit]);

  return { items, loading };
}
