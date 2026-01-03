import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RamadanDay {
  id: string;
  year: number;
  day_number: number;
  fasting_completed: boolean;
  taraweeh_completed: boolean;
  suhoor_time: string | null;
  iftar_time: string | null;
  notes: string | null;
}

interface DhikrLog {
  id: string;
  dhikr_type: string;
  target_count: number;
  completed_count: number;
  log_date: string;
}

export interface IslamicEvent {
  name: string;
  date: Date;
  hijriDate: string;
  description?: string;
  type?: 'major' | 'fasting' | 'sunnah' | 'remembrance' | 'historical';
}

const DHIKR_TYPES = [
  { id: 'subhanallah', arabic: 'سبحان الله', english: 'SubhanAllah', defaultTarget: 33 },
  { id: 'alhamdulillah', arabic: 'الحمد لله', english: 'Alhamdulillah', defaultTarget: 33 },
  { id: 'allahuakbar', arabic: 'الله أكبر', english: 'Allahu Akbar', defaultTarget: 34 },
  { id: 'lailahaillallah', arabic: 'لا إله إلا الله', english: 'La ilaha illallah', defaultTarget: 100 },
  { id: 'astaghfirullah', arabic: 'أستغفر الله', english: 'Astaghfirullah', defaultTarget: 100 },
];

// Calculate Hijri date (approximate - for display purposes)
function getHijriDate(date: Date): { year: number; month: number; day: number; monthName: string } {
  const HIJRI_EPOCH = 1948439.5;
  const jd = Math.floor((date.getTime() / 86400000) + 2440587.5);
  
  const l = jd - Math.floor(HIJRI_EPOCH) + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 * l2) / 17719) + Math.floor(l2 / 5670) * Math.floor((43 * l2) / 15238);
  const l3 = l2 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l3) / 709);
  const day = l3 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  const monthNames = ['Muharram', 'Safar', 'Rabi\' al-Awwal', 'Rabi\' al-Thani', 'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Sha\'ban', 'Ramadan', 'Shawwal', 'Dhu al-Qi\'dah', 'Dhu al-Hijjah'];
  
  return { year, month, day, monthName: monthNames[month - 1] || '' };
}

// Get Islamic events for a given year (approximate dates)
function getIslamicEvents(year: number): IslamicEvent[] {
  // These are approximate - real dates depend on moon sighting
  const events: IslamicEvent[] = [
    // Major Events
    { name: 'Isra and Mi\'raj', date: new Date(year, 1, 7), hijriDate: '27 Rajab', description: 'The Night Journey and Ascension of Prophet Muhammad ﷺ', type: 'major' },
    { name: 'Shab-e-Barat', date: new Date(year, 1, 24), hijriDate: '15 Sha\'ban', description: 'Night of Forgiveness - seek repentance and pray', type: 'remembrance' },
    { name: 'Ramadan Begins', date: new Date(year, 2, 10), hijriDate: '1 Ramadan', description: 'Start of the blessed month of fasting', type: 'major' },
    { name: 'Last 10 Nights Begin', date: new Date(year, 2, 30), hijriDate: '21 Ramadan', description: 'Seek Laylat al-Qadr in the odd nights', type: 'major' },
    { name: 'Laylat al-Qadr (21st)', date: new Date(year, 2, 31), hijriDate: '21 Ramadan', description: 'Possible Night of Power - pray and seek forgiveness', type: 'major' },
    { name: 'Laylat al-Qadr (23rd)', date: new Date(year, 3, 2), hijriDate: '23 Ramadan', description: 'Possible Night of Power - pray and seek forgiveness', type: 'major' },
    { name: 'Laylat al-Qadr (25th)', date: new Date(year, 3, 4), hijriDate: '25 Ramadan', description: 'Possible Night of Power - pray and seek forgiveness', type: 'major' },
    { name: 'Laylat al-Qadr (27th)', date: new Date(year, 3, 6), hijriDate: '27 Ramadan', description: 'Most likely Night of Power - better than 1000 months', type: 'major' },
    { name: 'Laylat al-Qadr (29th)', date: new Date(year, 3, 8), hijriDate: '29 Ramadan', description: 'Possible Night of Power - pray and seek forgiveness', type: 'major' },
    { name: 'Eid al-Fitr', date: new Date(year, 3, 9), hijriDate: '1 Shawwal', description: 'Festival of Breaking the Fast', type: 'major' },
    { name: '6 Days of Shawwal', date: new Date(year, 3, 10), hijriDate: '2-7 Shawwal', description: 'Fasting 6 days in Shawwal equals fasting a whole year', type: 'fasting' },
    { name: 'First 10 Days of Dhul Hijjah', date: new Date(year, 5, 6), hijriDate: '1-10 Dhu al-Hijjah', description: 'Most virtuous days - increase worship and good deeds', type: 'remembrance' },
    { name: 'Day of Arafah', date: new Date(year, 5, 15), hijriDate: '9 Dhu al-Hijjah', description: 'Best day for fasting outside Ramadan - expiates sins of 2 years', type: 'fasting' },
    { name: 'Eid al-Adha', date: new Date(year, 5, 16), hijriDate: '10 Dhu al-Hijjah', description: 'Festival of Sacrifice', type: 'major' },
    { name: 'Days of Tashreeq', date: new Date(year, 5, 17), hijriDate: '11-13 Dhu al-Hijjah', description: 'Days of eating, drinking, and remembering Allah (fasting prohibited)', type: 'remembrance' },
    { name: 'Islamic New Year', date: new Date(year, 6, 7), hijriDate: '1 Muharram', description: 'Start of the new Hijri year', type: 'major' },
    { name: 'First 10 Days of Muharram', date: new Date(year, 6, 8), hijriDate: '1-10 Muharram', description: 'Sacred month - increase fasting and good deeds', type: 'remembrance' },
    { name: 'Fasting 9th Muharram', date: new Date(year, 6, 15), hijriDate: '9 Muharram', description: 'Recommended to fast with Ashura', type: 'fasting' },
    { name: 'Day of Ashura', date: new Date(year, 6, 16), hijriDate: '10 Muharram', description: 'Fasting expiates sins of previous year', type: 'fasting' },
    { name: 'Fasting 11th Muharram', date: new Date(year, 6, 17), hijriDate: '11 Muharram', description: 'Can fast with Ashura as alternative to 9th', type: 'fasting' },
    { name: 'Mawlid al-Nabi', date: new Date(year, 8, 15), hijriDate: '12 Rabi\' al-Awwal', description: 'Birth of Prophet Muhammad ﷺ', type: 'major' },
    
    // Historical Events
    { name: 'Battle of Badr', date: new Date(year, 2, 27), hijriDate: '17 Ramadan', description: 'First major battle in Islam - decisive victory', type: 'historical' },
    { name: 'Conquest of Makkah', date: new Date(year, 3, 1), hijriDate: '20 Ramadan', description: 'The Prophet ﷺ entered Makkah peacefully in 8 AH', type: 'historical' },
    { name: 'Treaty of Hudaybiyyah', date: new Date(year, 4, 1), hijriDate: 'Dhu al-Qi\'dah', description: 'Historic peace treaty between Muslims and Quraysh', type: 'historical' },
    { name: 'Hijra Anniversary', date: new Date(year, 8, 1), hijriDate: '1 Rabi\' al-Awwal', description: 'The Prophet\'s migration from Makkah to Madinah', type: 'historical' },
    
    // Sunnah Fasting Days
    { name: 'White Days (Ayyam al-Beed)', date: new Date(year, 0, 15), hijriDate: '13-15 Monthly', description: 'Sunnah: Fast the 13th, 14th, 15th of each lunar month', type: 'sunnah' },
    { name: 'Monday & Thursday Fasting', date: new Date(year, 0, 1), hijriDate: 'Every Week', description: 'Sunnah: Prophet ﷺ used to fast Mondays and Thursdays', type: 'sunnah' },
    { name: 'Fasting in Sha\'ban', date: new Date(year, 1, 15), hijriDate: 'Sha\'ban', description: 'Prophet ﷺ fasted most of Sha\'ban in preparation for Ramadan', type: 'sunnah' },
    { name: 'Fasting in Muharram', date: new Date(year, 6, 10), hijriDate: 'Muharram', description: 'Best month for voluntary fasting after Ramadan', type: 'sunnah' },
    { name: 'Fasting in Rajab', date: new Date(year, 0, 20), hijriDate: 'Rajab', description: 'One of the sacred months - voluntary fasting recommended', type: 'sunnah' },
    { name: 'Day of Jumu\'ah', date: new Date(year, 0, 3), hijriDate: 'Every Friday', description: 'Best day of the week - attend Jumu\'ah prayer and make dua', type: 'remembrance' },
    
    // Sacred Months Reminders
    { name: 'Rajab Begins', date: new Date(year, 0, 15), hijriDate: '1 Rajab', description: 'One of the four sacred months - increase worship', type: 'remembrance' },
    { name: 'Dhul Qa\'dah Begins', date: new Date(year, 4, 15), hijriDate: '1 Dhu al-Qi\'dah', description: 'Sacred month - avoid fighting and disputes', type: 'remembrance' },
  ];
  
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// Get upcoming Islamic events for the next 365 days
function getUpcomingIslamicEvents(): IslamicEvent[] {
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  
  const currentYear = today.getFullYear();
  const nextYearValue = currentYear + 1;
  
  // Get events from current year and next year
  const allEvents = [
    ...getIslamicEvents(currentYear),
    ...getIslamicEvents(nextYearValue),
  ];
  
  // Filter to only show events within the next 365 days
  return allEvents
    .filter(event => event.date >= today && event.date <= nextYear)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function useIslamicFeatures() {
  const { user } = useAuth();
  const [ramadanDays, setRamadanDays] = useState<RamadanDay[]>([]);
  const [dhikrLogs, setDhikrLogs] = useState<DhikrLog[]>([]);
  const [loading, setLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];
  const hijriToday = getHijriDate(new Date());
  const islamicEvents = getUpcomingIslamicEvents();

  // Fetch Ramadan data
  const fetchRamadanData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('ramadan_tracker')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .order('day_number', { ascending: true });

      if (error) throw error;
      setRamadanDays((data || []) as RamadanDay[]);
    } catch (error) {
      console.error('Error fetching Ramadan data:', error);
    }
  }, [user?.id, currentYear]);

  // Fetch Dhikr logs for today
  const fetchDhikrLogs = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('dhikr_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', today);

      if (error) throw error;
      setDhikrLogs((data || []) as DhikrLog[]);
    } catch (error) {
      console.error('Error fetching dhikr logs:', error);
    }
  }, [user?.id, today]);

  // Toggle fasting for a Ramadan day
  const toggleFasting = async (dayNumber: number) => {
    if (!user?.id) return;
    
    const existing = ramadanDays.find(d => d.day_number === dayNumber);
    
    try {
      if (existing) {
        const { error } = await supabase
          .from('ramadan_tracker')
          .update({ fasting_completed: !existing.fasting_completed })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ramadan_tracker')
          .insert({
            user_id: user.id,
            year: currentYear,
            day_number: dayNumber,
            fasting_completed: true,
          });
        if (error) throw error;
      }
      await fetchRamadanData();
    } catch (error) {
      console.error('Error toggling fasting:', error);
      toast.error('Failed to update fasting status');
    }
  };

  // Toggle Taraweeh for a Ramadan day
  const toggleTaraweeh = async (dayNumber: number) => {
    if (!user?.id) return;
    
    const existing = ramadanDays.find(d => d.day_number === dayNumber);
    
    try {
      if (existing) {
        const { error } = await supabase
          .from('ramadan_tracker')
          .update({ taraweeh_completed: !existing.taraweeh_completed })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ramadan_tracker')
          .insert({
            user_id: user.id,
            year: currentYear,
            day_number: dayNumber,
            taraweeh_completed: true,
          });
        if (error) throw error;
      }
      await fetchRamadanData();
    } catch (error) {
      console.error('Error toggling Taraweeh:', error);
      toast.error('Failed to update Taraweeh status');
    }
  };

  // Increment dhikr count
  const incrementDhikr = async (dhikrType: string) => {
    if (!user?.id) return;
    
    const existing = dhikrLogs.find(d => d.dhikr_type === dhikrType);
    const dhikrConfig = DHIKR_TYPES.find(d => d.id === dhikrType);
    
    try {
      if (existing) {
        const newCount = existing.completed_count + 1;
        const { error } = await supabase
          .from('dhikr_logs')
          .update({ completed_count: newCount })
          .eq('id', existing.id);
        if (error) throw error;
        
        if (newCount === existing.target_count) {
          toast.success(`${dhikrConfig?.english || dhikrType} completed! 🤲`);
        }
      } else {
        const { error } = await supabase
          .from('dhikr_logs')
          .insert({
            user_id: user.id,
            dhikr_type: dhikrType,
            target_count: dhikrConfig?.defaultTarget || 33,
            completed_count: 1,
            log_date: today,
          });
        if (error) throw error;
      }
      await fetchDhikrLogs();
    } catch (error) {
      console.error('Error incrementing dhikr:', error);
      toast.error('Failed to update dhikr count');
    }
  };

  // Reset dhikr count
  const resetDhikr = async (dhikrType: string) => {
    if (!user?.id) return;
    
    const existing = dhikrLogs.find(d => d.dhikr_type === dhikrType);
    
    try {
      if (existing) {
        const { error } = await supabase
          .from('dhikr_logs')
          .update({ completed_count: 0 })
          .eq('id', existing.id);
        if (error) throw error;
        await fetchDhikrLogs();
      }
    } catch (error) {
      console.error('Error resetting dhikr:', error);
      toast.error('Failed to reset dhikr count');
    }
  };

  useEffect(() => {
    if (user?.id) {
      setLoading(true);
      Promise.all([fetchRamadanData(), fetchDhikrLogs()]).finally(() => setLoading(false));
    }
  }, [user?.id, fetchRamadanData, fetchDhikrLogs]);

  return {
    // Ramadan
    ramadanDays,
    toggleFasting,
    toggleTaraweeh,
    
    // Dhikr
    dhikrLogs,
    dhikrTypes: DHIKR_TYPES,
    incrementDhikr,
    resetDhikr,
    
    // Islamic Calendar
    hijriToday,
    islamicEvents,
    getHijriDate,
    
    // General
    loading,
    refetch: () => Promise.all([fetchRamadanData(), fetchDhikrLogs()]),
  };
}
