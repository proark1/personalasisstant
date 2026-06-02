import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicHoliday {
  id: string;
  name: string;
  local_name: string | null;
  date: string;
  country_code: string;
  country_name: string;
  is_fixed: boolean;
}

export function usePublicHolidays(countryCodes?: string[]) {
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable key for the dep array — avoids a complex expression inside the array
  const countryCodesKey = countryCodes?.join(',') ?? '';

  useEffect(() => {
    const fetchHolidays = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('public_holidays')
          .select('*')
          .order('date', { ascending: true });

        if (countryCodes && countryCodes.length > 0) {
          query = query.in('country_code', countryCodes);
        }

        const { data, error } = await query;

        if (error) throw error;
        setHolidays(data || []);
      } catch (error) {
        console.error('Error fetching public holidays:', error);
        setHolidays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHolidays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCodesKey]); // countryCodes array ref changes each render; countryCodesKey captures the actual content

  return { holidays, loading };
}
