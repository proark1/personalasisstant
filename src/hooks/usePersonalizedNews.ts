import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  headline: string;
  summary: string;
  category: string;
  url?: string;
}

interface UsePersonalizedNewsOptions {
  interests?: string[];
  skills?: string[];
  businesses?: string[];
}

export function usePersonalizedNews(options: UsePersonalizedNewsOptions = {}) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('morning-briefing', {
        body: {
          interests: options.interests || [],
          skills: options.skills || [],
          businesses: options.businesses || [],
        },
      });

      if (fnError) throw fnError;

      setNews(data?.news || []);
      setError(null);
    } catch (err) {
      console.error('News fetch error:', err);
      setError('Could not fetch news');
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [options.interests, options.skills, options.businesses]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { news, loading, error, refetch: fetchNews };
}
