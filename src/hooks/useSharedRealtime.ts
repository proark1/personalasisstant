/**
 * useSharedRealtime — opt into the multiplexed RealtimeCoordinator
 * instead of spinning up your own supabase.channel().
 *
 * Drop-in replacement for ad-hoc useEffect realtime subscriptions.
 * Multiple hooks calling this for the same (table, userId) share one channel.
 */
import { useEffect, useRef } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { subscribeToTable } from "@/lib/realtimeCoordinator";

export function useSharedRealtime(
  table: string,
  userId: string | undefined,
  handler: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  filter?: string,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!userId) return;
    return subscribeToTable(table, userId, (payload) => handlerRef.current(payload), filter);
  }, [table, userId, filter]);
}
