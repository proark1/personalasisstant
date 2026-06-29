import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

export interface BrainDump {
  id: string;
  content: string;
  voice_url?: string;
  is_processed: boolean;
  suggested_type?: string;
  suggested_category?: string;
  suggested_priority?: string;
  ai_summary?: string;
  created_at: string;
  converted_to_type?: string;
  converted_to_id?: string;
}

export function useBrainDump() {
  const { user } = useAuth();
  const [dumps, setDumps] = useState<BrainDump[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchDumps = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("brain_dumps")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_processed", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDumps(data || []);
    } catch (error) {
      console.error("Failed to fetch brain dumps:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const processWithAI = useCallback(
    async (dumpId: string, content: string) => {
      if (!user) return;

      setIsProcessing(true);
      try {
        const { data: result, error } = await supabase.functions.invoke("ai-assistant", {
          body: {
            type: "categorize_dump",
            content,
            userId: user.id,
          },
        });

        if (error) throw error;

        // Update the dump with AI suggestions
        if (result) {
          const { error: updateError } = await supabase
            .from("brain_dumps")
            .update({
              suggested_type: result.suggested_type,
              suggested_category: result.suggested_category,
              suggested_priority: result.suggested_priority,
              ai_summary: result.ai_summary,
            })
            .eq("id", dumpId);

          if (!updateError) {
            setDumps((prev) => prev.map((d) => (d.id === dumpId ? { ...d, ...result } : d)));
          }
        }
      } catch (error) {
        console.error("AI processing failed:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [user],
  );

  const addDump = useCallback(
    async (content: string, voiceUrl?: string) => {
      if (!user || !content.trim()) return null;

      try {
        const { data, error } = await supabase
          .from("brain_dumps")
          .insert({
            user_id: user.id,
            content: content.trim(),
            voice_url: voiceUrl,
            is_processed: false,
          })
          .select()
          .single();

        if (error) throw error;

        setDumps((prev) => [data, ...prev]);
        toast.success("Captured!", { description: "Added to your inbox" });

        // Trigger AI processing
        processWithAI(data.id, content);

        return data;
      } catch (error) {
        console.error("Failed to add brain dump:", error);
        toast.error(await describeEdgeError(error, "Failed to capture"));
        return null;
      }
    },
    [processWithAI, user],
  );

  const convertDump = useCallback(
    async (
      dumpId: string,
      targetType: "task" | "note" | "event",
      data: Record<string, unknown>,
    ) => {
      if (!user) return false;

      try {
        let targetId: string | null = null;

        if (targetType === "task") {
          const { data: task, error } = await supabase
            .from("tasks")
            .insert({
              user_id: user.id,
              title: data.title as string,
              description: data.description as string,
              priority: (data.priority as string) || "medium",
              category: (data.category as string) || "personal",
              status: "todo",
              completed: false,
            })
            .select()
            .single();

          if (error) throw error;
          targetId = task.id;
        } else if (targetType === "note") {
          const { data: note, error } = await supabase
            .from("notes")
            .insert({
              user_id: user.id,
              title: data.title as string,
              content: data.content as string,
            })
            .select()
            .single();

          if (error) throw error;
          targetId = note.id;
        } else if (targetType === "event") {
          const { data: event, error } = await supabase
            .from("events")
            .insert({
              user_id: user.id,
              title: data.title as string,
              start_time: data.start_time as string,
              end_time: data.end_time as string,
              description: data.description as string,
            })
            .select()
            .single();

          if (error) throw error;
          targetId = event.id;
        }

        // Mark dump as processed
        await supabase
          .from("brain_dumps")
          .update({
            is_processed: true,
            processed_at: new Date().toISOString(),
            converted_to_type: targetType,
            converted_to_id: targetId,
          })
          .eq("id", dumpId);

        setDumps((prev) => prev.filter((d) => d.id !== dumpId));
        toast.success(`Created ${targetType}!`);
        return true;
      } catch (error) {
        console.error("Failed to convert dump:", error);
        toast.error(await describeEdgeError(error, "Failed to convert"));
        return false;
      }
    },
    [user],
  );

  const deleteDump = useCallback(
    async (dumpId: string) => {
      try {
        const { error } = await supabase
          .from("brain_dumps")
          .delete()
          .eq("id", dumpId)
          .eq("user_id", user?.id);

        if (error) throw error;
        setDumps((prev) => prev.filter((d) => d.id !== dumpId));
        toast.success("Deleted");
      } catch (error) {
        console.error("Failed to delete dump:", error);
        toast.error("Failed to delete");
      }
    },
    [user?.id],
  );

  return {
    dumps,
    isLoading,
    isProcessing,
    fetchDumps,
    addDump,
    convertDump,
    deleteDump,
    unprocessedCount: dumps.length,
  };
}
