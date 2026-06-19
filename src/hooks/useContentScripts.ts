import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import {
  describeFunctionError,
  type ContentScript,
  type ScriptFormat,
  type ScriptVariation,
} from "@/lib/content";

const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };

export function useContentScripts(ideaId: string | null) {
  const { language, t } = useLanguage();
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchScripts = useCallback(async () => {
    if (!ideaId) {
      setScripts([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await db
        .from("content_scripts")
        .select("*")
        .eq("idea_id", ideaId)
        .order("format", { ascending: true });
      if (error) throw error;
      setScripts((data || []) as ContentScript[]);
    } catch (err) {
      console.error("Failed to fetch scripts:", err);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const generate = useCallback(
    async (formats: ScriptFormat[] = ["short", "long"], variation?: ScriptVariation) => {
      if (!ideaId) return false;
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke("content-script", {
          body: { idea_id: ideaId, formats, language, variation },
        });
        if (error) throw error;
        const dataObj = data as Record<string, unknown> | null;
        if (dataObj?.error) throw new Error(String(dataObj.error));
        const next = (dataObj?.scripts || []) as ContentScript[];
        if (next.length) setScripts(next);
        else await fetchScripts();
        toast.success(t("content.toast.scriptsReady"));
        return true;
      } catch (err) {
        console.error("Failed to generate scripts:", err);
        toast.error(await describeFunctionError(err, t("content.toast.scriptsFailed")));
        return false;
      } finally {
        setGenerating(false);
      }
    },
    [ideaId, fetchScripts, language, t],
  );

  // Inline edits to a generated script (the user tweaks the text before
  // recording). Optimistic, with revert on failure.
  const updateScript = useCallback(
    async (id: string, updates: Partial<ContentScript>) => {
      setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      try {
        const { error } = await db
          .from("content_scripts")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      } catch (err) {
        console.error("Failed to save script edit:", err);
        toast.error(t("content.toast.editSaveFailed"));
        fetchScripts();
      }
    },
    [fetchScripts, t],
  );

  return { scripts, loading, generating, generate, updateScript, refetch: fetchScripts };
}
