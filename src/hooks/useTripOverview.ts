import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TripOverviewRow {
  trip_id: string;
  title: string;
  destination: string;
  destination_country: string | null;
  destination_lat: number | null;
  destination_lon: number | null;
  timezone: string | null;
  start_date: string;
  end_date: string;
  purpose: string | null;
  status: string | null;
  weather_summary: string | null;
  weather_refreshed_at: string | null;
  days_until_departure: number;
  trip_length_days: number;
  segment_count: number;
  booking_count: number;
  packing_list_count: number;
  packing_total_items: number;
  packing_packed_items: number;
  packing_pct: number | null;
}

export interface TripSegment {
  id: string;
  trip_id: string;
  idx: number;
  segment_type: string;
  title: string;
  origin: string | null;
  destination: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  provider: string | null;
  reference: string | null;
  cost: number | null;
  currency: string | null;
  notes: string | null;
}

export interface PackingItem {
  name: string;
  category?: string;
  qty?: number;
  note?: string | null;
  packed?: boolean;
}

export interface PackingList {
  id: string;
  trip_id: string;
  name: string;
  source: 'manual' | 'ai_generated' | 'imported' | string;
  generated_at: string | null;
  items: PackingItem[];
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface TripBookingRow {
  id: string;
  trip_id: string | null;
  booking_type: string;
  provider: string | null;
  confirmation_number: string | null;
  start_time: string | null;
  end_time: string | null;
  origin: string | null;
  destination: string | null;
  cost: number | null;
  currency: string | null;
}

export interface TripOverviewResponse {
  trips: TripOverviewRow[];
  segments: Record<string, TripSegment[]>;
  bookings: Record<string, TripBookingRow[]>;
  packing_lists: Record<string, PackingList[]>;
  country_essentials: any[];
  generated_at: string;
}

// One-call hook: fetches the trip overview rollup, supports refresh,
// drives Plaid-style "ask the assistant" actions on a per-trip basis.
export function useTripOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<TripOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyTripId, setBusyTripId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: payload, error } = await supabase.functions.invoke('trip-overview', { body: {} });
      if (error) throw error;
      setData(payload as TripOverviewResponse);
    } catch (e) {
      console.warn('[useTripOverview] refresh failed', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any change to trips/segments/packing repaints the page.
  // One channel with N listeners is cheaper than N channels — saves
  // WebSocket connections on both sides.
  useEffect(() => {
    if (!user?.id) return;
    const tables = ['trips', 'trip_segments', 'packing_lists', 'trip_bookings'];
    const channel = (supabase as any).channel(`trip-updates-${user.id}`);
    for (const table of tables) {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${user.id}`,
      }, () => { refresh(); });
    }
    channel.subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user?.id, refresh]);

  // Fetch the weather forecast for a trip and persist a one-line
  // summary back onto the trip row so the dashboard renders it
  // without re-fetching.
  const refreshWeather = useCallback(async (trip: TripOverviewRow) => {
    if (!trip.destination_lat || !trip.destination_lon) {
      toast.info('No coordinates set for this trip');
      return null;
    }
    setBusyTripId(trip.trip_id);
    try {
      const { data: w, error } = await supabase.functions.invoke('weather-forecast', {
        body: {
          lat: trip.destination_lat,
          lon: trip.destination_lon,
          start_date: trip.start_date,
          end_date: trip.end_date,
        },
      });
      if (error) throw error;
      const summary = (w as any)?.summary as string | undefined;
      if (summary) {
        await (supabase as any)
          .from('trips')
          .update({
            weather_summary: summary,
            weather_refreshed_at: new Date().toISOString(),
          })
          .eq('id', trip.trip_id);
      }
      await refresh();
      toast.success('Weather updated');
      return w;
    } catch (e) {
      toast.error(`Weather failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusyTripId(null);
    }
  }, [refresh]);

  const prepTrip = useCallback(async (tripId: string, force = false) => {
    setBusyTripId(tripId);
    try {
      const { data, error } = await supabase.functions.invoke('trip-prep', {
        body: { trip_id: tripId, force },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const skipped = (data as any)?.skipped;
      if (skipped) {
        toast.info('Already prepped — pass force to re-run');
      } else {
        const kicked = (data as any)?.packing_kicked_off;
        toast.success(`🎒 Pack task added${kicked ? ' + packing list generating' : ''}`);
      }
      await refresh();
      return data;
    } catch (e) {
      toast.error(`Prep failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusyTripId(null);
    }
  }, [refresh]);

  const generatePacking = useCallback(async (
    tripId: string,
    opts?: { replace?: boolean; extraContext?: string },
  ) => {
    setBusyTripId(tripId);
    try {
      const { data: r, error } = await supabase.functions.invoke('generate-packing-list', {
        body: {
          trip_id: tripId,
          replace: opts?.replace === true,
          extra_context: opts?.extraContext ?? '',
        },
      });
      if (error) throw error;
      if ((r as any)?.error) throw new Error((r as any).error);
      toast.success(`Packing list generated (${(r as any)?.items_count} items)`);
      await refresh();
      return r;
    } catch (e) {
      toast.error(`Packing failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusyTripId(null);
    }
  }, [refresh]);

  const togglePackedItem = useCallback(async (
    list: PackingList,
    itemIndex: number,
  ) => {
    const items = [...(list.items ?? [])];
    if (!items[itemIndex]) return;
    items[itemIndex] = { ...items[itemIndex], packed: !items[itemIndex].packed };
    const { error } = await (supabase as any)
      .from('packing_lists')
      .update({ items })
      .eq('id', list.id);
    if (error) {
      toast.error(`Failed: ${error.message}`);
    } else {
      // Optimistic local update — the realtime subscription will
      // backfill the new packing_pct from the view.
      await refresh();
    }
  }, [refresh]);

  return {
    data,
    loading,
    busyTripId,
    refresh,
    refreshWeather,
    generatePacking,
    togglePackedItem,
    prepTrip,
  };
}
