import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Trip { id: string; user_id: string; title: string; destination: string; destination_country: string | null; start_date: string; end_date: string; purpose: string | null; status: string | null; notes: string | null; companions: any; }
export interface TripBooking { id: string; user_id: string; trip_id: string | null; booking_type: string; provider: string | null; confirmation_number: string | null; start_time: string | null; end_time: string | null; origin: string | null; destination: string | null; cost: number | null; currency: string | null; notes: string | null; }
export interface LoyaltyProgram { id: string; user_id: string; program_name: string; program_type: string | null; membership_number: string | null; tier: string | null; points_balance: number | null; expires_at: string | null; notes: string | null; }
export interface CountryEssential { id: string; user_id: string; country: string; plug_type: string | null; currency: string | null; emergency_number: string | null; embassy_phone: string | null; embassy_address: string | null; language: string | null; notes: string | null; }

export function useTravel() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyProgram[]>([]);
  const [essentials, setEssentials] = useState<CountryEssential[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return; setIsLoading(true);
    try {
      const [t, b, l, e] = await Promise.all([
        supabase.from('trips').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
        supabase.from('trip_bookings').select('*').eq('user_id', user.id).order('start_time', { ascending: false }),
        supabase.from('loyalty_programs').select('*').eq('user_id', user.id).order('program_name'),
        supabase.from('country_essentials').select('*').eq('user_id', user.id).order('country'),
      ]);
      setTrips((t.data as any) || []); setBookings((b.data as any) || []); setLoyalty((l.data as any) || []); setEssentials((e.data as any) || []);
    } finally { setIsLoading(false); }
  };
  useEffect(() => { if (user) refresh(); }, [user]);

  const addTrip = async (p: Partial<Trip>) => { if (!user) return; const { error } = await supabase.from('trips').insert({ ...p, user_id: user.id, title: p.title!, destination: p.destination!, start_date: p.start_date!, end_date: p.end_date! }); if (error) return toast.error(error.message); toast.success('Trip added'); refresh(); };
  const addBooking = async (p: Partial<TripBooking>) => { if (!user) return; const { error } = await supabase.from('trip_bookings').insert({ ...p, user_id: user.id, booking_type: p.booking_type! }); if (error) return toast.error(error.message); toast.success('Booking added'); refresh(); };
  const addLoyalty = async (p: Partial<LoyaltyProgram>) => { if (!user) return; const { error } = await supabase.from('loyalty_programs').insert({ ...p, user_id: user.id, program_name: p.program_name! }); if (error) return toast.error(error.message); toast.success('Program added'); refresh(); };
  const addEssential = async (p: Partial<CountryEssential>) => { if (!user) return; const { error } = await supabase.from('country_essentials').upsert({ ...p, user_id: user.id, country: p.country! }, { onConflict: 'user_id,country' }); if (error) return toast.error(error.message); toast.success('Saved'); refresh(); };
  const remove = async (table: 'trips'|'trip_bookings'|'loyalty_programs'|'country_essentials', id: string) => { const { error } = await supabase.from(table).delete().eq('id', id); if (error) return toast.error(error.message); toast.success('Deleted'); refresh(); };

  return { trips, bookings, loyalty, essentials, isLoading, addTrip, addBooking, addLoyalty, addEssential, remove, refresh };
}
