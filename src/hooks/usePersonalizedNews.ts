import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  headline: string;
  summary: string;
  category: string;
  url?: string;
}

interface LocationData {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
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
  const locationRef = useRef<LocationData | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchNews = useCallback(async (location?: LocationData | null) => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    try {
      setLoading(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('morning-briefing', {
        body: {
          interests: options.interests || [],
          skills: options.skills || [],
          businesses: options.businesses || [],
          location: location || undefined,
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

  // Get location and then fetch news
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const getLocationAndFetch = async () => {
      // Try to get location
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          
          const { latitude, longitude } = position.coords;
          
          // Try to reverse geocode
          try {
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1`
            );
            
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData.results?.[0]) {
                locationRef.current = {
                  latitude,
                  longitude,
                  city: geoData.results[0].name,
                  country: geoData.results[0].country,
                };
              }
            }
          } catch {
            locationRef.current = { latitude, longitude };
          }
        } catch {
          // Geolocation failed, proceed without location
        }
      }
      
      // Fetch news with whatever location we have
      fetchNews(locationRef.current);
    };

    // Small delay to let component mount properly
    timeoutId = setTimeout(getLocationAndFetch, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [fetchNews]);

  const refetch = useCallback(() => {
    hasFetchedRef.current = false;
    fetchNews(locationRef.current);
  }, [fetchNews]);

  return { news, loading, error, refetch };
}
