import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { Contact } from "./useContacts";

export interface ConversationStarters {
  starters: string[];
}

export interface RelationshipInsights {
  strengthScore: number;
  insights: string[];
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
  suggestedActions: string[];
}

export function useContactAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getConversationStarters = useCallback(async (contact: Contact): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("contact-insights", {
        body: { contact, type: "conversation_starters" },
      });

      if (fnError) throw fnError;
      return data?.result || [];
    } catch (err) {
      console.error("Error getting conversation starters:", err);
      setError(await describeEdgeError(err, "Failed to get conversation starters"));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getRelationshipInsights = useCallback(
    async (contact: Contact): Promise<RelationshipInsights | null> => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("contact-insights", {
          body: { contact, type: "relationship_insights" },
        });

        if (fnError) throw fnError;
        return data?.result || null;
      } catch (err) {
        console.error("Error getting relationship insights:", err);
        setError(await describeEdgeError(err, "Failed to get insights"));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    loading,
    error,
    getConversationStarters,
    getRelationshipInsights,
  };
}
