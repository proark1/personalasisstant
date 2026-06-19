import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { describeFunctionError, type ContentIdea, type IdeaStatus } from "@/lib/content";

const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };

const WINDOW_DAYS = 30;

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function useContentIdeas() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchIdeas = useCallback(async () => {
    if (!user?.id) return;
    const since = localDateKey(new Date(Date.now() - WINDOW_DAYS * 86_400_000));
    try {
      const { data, error } = await db
        .from("content_ideas")
        .select("*")
        .eq("user_id", user.id)
        .gte("generated_on", since)
        .order("generated_on", { ascending: false })
        .order("rank", { ascending: true })
        .limit(400);
      if (error) {
        console.error("Error fetching content ideas:", error);
      } else {
        setIdeas((data || []) as ContentIdea[]);
      }
    } catch (err) {
      console.error("Failed to fetch content ideas:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  // The most recent day for which we have a batch, and that day's ideas.
  const latestDay = useMemo(() => ideas[0]?.generated_on ?? null, [ideas]);
  const latestBatch = useMemo(
    () => (latestDay ? ideas.filter((i) => i.generated_on === latestDay) : []),
    [ideas, latestDay],
  );
  const liked = useMemo(
    () => ideas.filter((i) => i.status === "liked" || i.status === "scheduled"),
    [ideas],
  );
  const scheduled = useMemo(() => ideas.filter((i) => i.status === "scheduled"), [ideas]);

  const generateNow = useCallback(
    async (overrides?: { count?: number; trending_ratio?: number; idea_source?: string }) => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("content-ideas", {
          body: { language, ...(overrides ?? {}) },
        });
        if (error) throw error;
        const dataObj = data as Record<string, unknown> | null;
        if (dataObj?.error) throw new Error(String(dataObj.error));
        await fetchIdeas();
        const count = (dataObj?.count as number) ?? 0;
        toast.success(
          `${count} ${count === 1 ? t("content.toast.generatedSuffix.one") : t("content.toast.generatedSuffix.other")}`,
        );
        return true;
      } catch (err) {
        console.error("Failed to generate ideas:", err);
        toast.error(await describeFunctionError(err, t("content.toast.generateFailed")));
        return false;
      } finally {
        setGenerating(false);
      }
    },
    [fetchIdeas, language, t],
  );

  const setStatus = useCallback(
    async (id: string, status: IdeaStatus) => {
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
      try {
        const { error } = await db
          .from("content_ideas")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to update idea:", err);
        toast.error(t("content.toast.updateFailed"));
        fetchIdeas();
      }
    },
    [fetchIdeas, t],
  );

  // Drop a real calendar event so the idea shows up in the main Calendar (and
  // syncs to Google/Apple like any other event), then mark the idea scheduled.
  const scheduleIdea = useCallback(
    async (idea: ContentIdea, whenISO: string, durationMin = 30) => {
      if (!user?.id) return false;
      try {
        const start = new Date(whenISO);
        if (Number.isNaN(start.getTime())) throw new Error("Invalid date/time");
        const end = new Date(start.getTime() + durationMin * 60_000);
        const description = [idea.summary, idea.source_url ? `Source: ${idea.source_url}` : ""]
          .filter(Boolean)
          .join("\n\n");

        const { data: ev, error: evErr } = await supabase
          .from("events")
          .insert({
            user_id: user.id,
            title: `🎬 ${idea.headline}`.slice(0, 200),
            description,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            // events.category is constrained to ('business','personal'); content
            // events are business. created_via marks them as Content Studio events.
            category: "business",
            created_via: "content-studio",
          })
          .select("id")
          .single();
        if (evErr) throw evErr;

        const { error: upErr } = await db
          .from("content_ideas")
          .update({
            status: "scheduled",
            scheduled_for: start.toISOString(),
            scheduled_event_id: ev?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", idea.id);
        if (upErr) throw upErr;

        await fetchIdeas();
        toast.success(t("content.toast.addedCalendar"));
        return true;
      } catch (err) {
        console.error("Failed to schedule idea:", err);
        toast.error(t("content.toast.addCalendarFailed"));
        return false;
      }
    },
    [user?.id, fetchIdeas, t],
  );

  const unschedule = useCallback(
    async (idea: ContentIdea) => {
      try {
        if (idea.scheduled_event_id) {
          await supabase.from("events").delete().eq("id", idea.scheduled_event_id);
        }
        const { error } = await db
          .from("content_ideas")
          .update({
            status: "liked",
            scheduled_for: null,
            scheduled_event_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", idea.id);
        if (error) throw error;
        await fetchIdeas();
        toast.success(t("content.toast.removedCalendar"));
        return true;
      } catch (err) {
        console.error("Failed to unschedule idea:", err);
        toast.error(t("content.toast.removeCalendarFailed"));
        return false;
      }
    },
    [fetchIdeas, t],
  );

  return {
    ideas,
    latestBatch,
    latestDay,
    liked,
    scheduled,
    loading,
    generating,
    generateNow,
    setStatus,
    scheduleIdea,
    unschedule,
    refetch: fetchIdeas,
  };
}
