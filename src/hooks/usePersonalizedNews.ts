import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';

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
    let isCancelled = false;
    let fallbackTimeoutId: NodeJS.Timeout;
    
    const getLocationAndFetch = async () => {
      let locationResolved = false;
      
      // Set a hard fallback timeout - if location takes too long, proceed without it
      // This is especially important on iOS native where geolocation can hang
      fallbackTimeoutId = setTimeout(() => {
        if (!locationResolved && !isCancelled) {
          console.log('Location timeout - proceeding without location');
          locationResolved = true;
          fetchNews(null);
        }
      }, 3000); // 3 second max wait for location
      
      // Skip geolocation entirely on native platforms - it often hangs in WKWebView
      if (Capacitor.isNativePlatform()) {
        console.log('Native platform detected - skipping browser geolocation');
        if (!locationResolved && !isCancelled) {
          locationResolved = true;
          clearTimeout(fallbackTimeoutId);
          fetchNews(null);
        }
        return;
      }
      
      // Try to get location (web only)
      if ('geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              timeout: 2000, // Short timeout
              maximumAge: 300000, // Accept cached position up to 5 min old
              enableHighAccuracy: false // Faster, less accurate
            });
          });
          
          if (isCancelled || locationResolved) return;
          
          const { latitude, longitude } = position.coords;
          
          // Try to reverse geocode (with quick timeout)
          try {
            const controller = new AbortController();
            const geoTimeoutId = setTimeout(() => controller.abort(), 1500);
            
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1`,
              { signal: controller.signal }
            );
            
            clearTimeout(geoTimeoutId);
            
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
        } catch (err) {
          console.log('Geolocation failed:', err);
          // Geolocation failed, proceed without location
        }
      }
      
      // Fetch news with whatever location we have
      if (!locationResolved && !isCancelled) {
        locationResolved = true;
        clearTimeout(fallbackTimeoutId);
        fetchNews(locationRef.current);
      }
    };

    // Small delay to let component mount properly
    const locationTimeoutId = setTimeout(getLocationAndFetch, 100);

    return () => {
      isCancelled = true;
      clearTimeout(locationTimeoutId);
      clearTimeout(fallbackTimeoutId);
    };
  }, [fetchNews]);

  const refetch = useCallback(() => {
    hasFetchedRef.current = false;
    fetchNews(locationRef.current);
  }, [fetchNews]);

  return { news, loading, error, refetch };
}
