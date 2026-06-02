import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface BriefingNewsItem {
  headline: string;
  summary: string;
  category: string;
  url: string;
}

export interface BriefingDelivery {
  id: string;
  briefing_id: string | null;
  briefing_name: string | null;
  generated_at: string;
  content: BriefingNewsItem[];
  channels_sent: string[];
  status: string;
}

// `briefing_deliveries` is a newly added table not yet in the generated
// Supabase types, so we access it through an untyped client handle.
const db = supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };

export function useBriefingDeliveries(limit = 10) {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<BriefingDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeliveries = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await db
        .from('briefing_deliveries')
        .select('id, briefing_id, generated_at, content, channels_sent, status, briefings(name)')
        .eq('user_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('Error fetching briefing deliveries:', error);
      } else {
        interface DeliveryRow {
          id: string;
          briefing_id: string | null;
          generated_at: string;
          content: BriefingNewsItem[] | null;
          channels_sent: string[] | null;
          status: string;
          briefings?: { name: string } | null;
        }
        setDeliveries(
          (data || []).map((row: DeliveryRow) => ({
            id: row.id,
            briefing_id: row.briefing_id,
            briefing_name: row.briefings?.name ?? null,
            generated_at: row.generated_at,
            content: Array.isArray(row.content) ? row.content : [],
            channels_sent: row.channels_sent || [],
            status: row.status,
          })),
        );
      }
    } catch (err) {
      console.error('Failed to fetch briefing deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  return { deliveries, loading, refetch: fetchDeliveries };
}
