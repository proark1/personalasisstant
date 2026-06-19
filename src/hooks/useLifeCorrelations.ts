import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface LifeCorrelation {
  id: string;
  correlationType: string;
  domainA: string;
  domainB: string;
  patternDescription: string;
  correlationStrength: number;
  confidenceScore: number;
  dataPoints: number;
  insightText: string | null;
  isDismissed: boolean;
  lastUpdatedAt: string;
  createdAt: string;
}

export function useLifeCorrelations() {
  const { user } = useAuth();
  const [correlations, setCorrelations] = useState<LifeCorrelation[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const fetchCorrelations = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("life_correlations")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_dismissed", false)
        .order("confidence_score", { ascending: false });

      if (error) throw error;

      setCorrelations(
        (data || []).map((c) => ({
          id: c.id,
          correlationType: c.correlation_type,
          domainA: c.domain_a,
          domainB: c.domain_b,
          patternDescription: c.pattern_description,
          correlationStrength: c.correlation_strength,
          confidenceScore: c.confidence_score,
          dataPoints: c.data_points,
          insightText: c.insight_text,
          isDismissed: c.is_dismissed,
          lastUpdatedAt: c.last_updated_at,
          createdAt: c.created_at,
        })),
      );
    } catch (err) {
      console.error("Error fetching correlations:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const analyzeCorrelations = useCallback(async () => {
    if (!user?.id) return;

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("life-correlator", {
        body: { userId: user.id },
      });

      if (error) throw error;

      // Refresh correlations after analysis
      await fetchCorrelations();

      return data;
    } catch (err) {
      console.error("Error analyzing correlations:", err);
      throw err;
    } finally {
      setAnalyzing(false);
    }
  }, [user?.id, fetchCorrelations]);

  const dismissCorrelation = useCallback(
    async (correlationId: string) => {
      if (!user?.id) return;

      try {
        const { error } = await supabase
          .from("life_correlations")
          .update({ is_dismissed: true })
          .eq("id", correlationId)
          .eq("user_id", user.id);

        if (error) throw error;

        setCorrelations((prev) => prev.filter((c) => c.id !== correlationId));
      } catch (err) {
        console.error("Error dismissing correlation:", err);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    fetchCorrelations();
  }, [fetchCorrelations]);

  return {
    correlations,
    loading,
    analyzing,
    fetchCorrelations,
    analyzeCorrelations,
    dismissCorrelation,
  };
}
