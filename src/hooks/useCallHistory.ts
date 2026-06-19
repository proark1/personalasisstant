import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CallHistoryItem {
  id: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  calleeName: string;
  callType: "video" | "audio";
  status: "answered" | "missed" | "declined" | "ended";
  direction: "incoming" | "outgoing";
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  duration: number | null; // in seconds
}

export function useCallHistory(userId: string | undefined) {
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Fetch call sessions where user is caller or callee
      const { data: sessions, error } = await supabase
        .from("call_sessions")
        .select("*")
        .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch profile names for all unique user IDs
      const userIds = new Set<string>();
      sessions?.forEach((s) => {
        userIds.add(s.caller_id);
        userIds.add(s.callee_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map<string, string>();
      profiles?.forEach((p) => {
        profileMap.set(p.user_id, p.display_name || p.email || "Unknown");
      });

      const historyItems: CallHistoryItem[] = (sessions || []).map((s) => {
        const isOutgoing = s.caller_id === userId;

        let status: CallHistoryItem["status"] = "ended";
        if (s.status === "declined") {
          status = "declined";
        } else if (s.status === "ringing" || (s.status === "ended" && !s.started_at)) {
          status = "missed";
        } else if (s.started_at) {
          status = "answered";
        }

        let duration: number | null = null;
        if (s.started_at && s.ended_at) {
          duration = Math.floor(
            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000,
          );
        }

        return {
          id: s.id,
          callerId: s.caller_id,
          calleeId: s.callee_id,
          callerName: profileMap.get(s.caller_id) || "Unknown",
          calleeName: profileMap.get(s.callee_id) || "Unknown",
          callType: s.call_type as "video" | "audio",
          status,
          direction: isOutgoing ? "outgoing" : "incoming",
          startedAt: s.started_at ? new Date(s.started_at) : null,
          endedAt: s.ended_at ? new Date(s.ended_at) : null,
          createdAt: new Date(s.created_at),
          duration,
        };
      });

      setHistory(historyItems);
    } catch (error) {
      console.error("Error fetching call history:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("call-history-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `caller_id=eq.${userId}`,
        },
        () => fetchHistory(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `callee_id=eq.${userId}`,
        },
        () => fetchHistory(),
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchHistory]);

  return { history, loading, refetch: fetchHistory };
}
