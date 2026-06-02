import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface FamilyChore {
  id: string;
  user_id: string;
  family_member_id: string | null;
  title: string;
  description: string | null;
  frequency: string;
  day_of_week: number | null;
  points: number;
  is_active: boolean;
  last_completed_at: string | null;
  next_due_date: string | null;
  rotation_members: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyAllowance {
  id: string;
  family_member_id: string;
  amount: number;
  entry_type: string;
  reason: string | null;
  entry_date: string;
}

export interface FamilyMealPreference {
  id: string;
  family_member_id: string;
  loves: string[] | null;
  dislikes: string[] | null;
  dietary_restrictions: string[] | null;
  favorite_meals: string[] | null;
  notes: string | null;
}

export interface FamilySleepSchedule {
  id: string;
  family_member_id: string;
  bedtime: string | null;
  wake_time: string | null;
  nap_time: string | null;
  nap_duration_minutes: number | null;
  screen_time_limit_minutes: number | null;
  notes: string | null;
}

export function useFamilyDailyLife() {
  const { user } = useAuth();
  const [chores, setChores] = useState<FamilyChore[]>([]);
  const [allowance, setAllowance] = useState<FamilyAllowance[]>([]);
  const [mealPrefs, setMealPrefs] = useState<FamilyMealPreference[]>([]);
  const [sleepSchedules, setSleepSchedules] = useState<FamilySleepSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [c, a, m, s] = await Promise.all([
      supabase.from('family_chores').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('family_allowance').select('*').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(100),
      supabase.from('family_meal_preferences').select('*').eq('user_id', user.id),
      supabase.from('family_sleep_schedule').select('*').eq('user_id', user.id),
    ]);
    setChores((c.data as unknown as FamilyChore[]) || []);
    setAllowance((a.data as unknown as FamilyAllowance[]) || []);
    setMealPrefs((m.data as unknown as FamilyMealPreference[]) || []);
    setSleepSchedules((s.data as unknown as FamilySleepSchedule[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addChore = async (data: Partial<FamilyChore>) => {
    if (!user) return null;
    const { data: row, error } = await supabase
      .from('family_chores')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ ...data, user_id: user.id, title: data.title!, frequency: data.frequency || 'weekly' } as any)
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success('Chore added');
    await fetchAll();
    return row;
  };

  const completeChore = async (chore: FamilyChore) => {
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completionPayload = { user_id: user.id, chore_id: chore.id, family_member_id: chore.family_member_id, points_awarded: chore.points } as any;
    const { error } = await supabase.from('family_chore_completions').insert(completionPayload);
    if (error) { toast.error(error.message); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('family_chores').update({ last_completed_at: new Date().toISOString() } as any).eq('id', chore.id);
    toast.success(`+${chore.points} points`);
    fetchAll();
  };

  const addAllowance = async (data: Partial<FamilyAllowance>): Promise<null | void> => {
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allowancePayload = { ...data, user_id: user.id, family_member_id: data.family_member_id!, amount: data.amount!, entry_type: data.entry_type || 'allowance' } as any;
    const { error } = await supabase.from('family_allowance').insert(allowancePayload);
    if (error) { toast.error(error.message); return null; }
    toast.success('Logged');
    fetchAll();
  };

  const upsertMealPref = async (data: Partial<FamilyMealPreference>) => {
    if (!user || !data.family_member_id) return;
    const existing = mealPrefs.find(m => m.family_member_id === data.family_member_id);
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('family_meal_preferences').update(data as any).eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('family_meal_preferences').insert({ ...data, user_id: user.id } as any);
      if (error) { toast.error(error.message); return; }
    }
    toast.success('Saved');
    fetchAll();
  };

  const upsertSleep = async (data: Partial<FamilySleepSchedule>) => {
    if (!user || !data.family_member_id) return;
    const existing = sleepSchedules.find(s => s.family_member_id === data.family_member_id);
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('family_sleep_schedule').update(data as any).eq('id', existing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from('family_sleep_schedule').insert({ ...data, user_id: user.id } as any);
      if (error) { toast.error(error.message); return; }
    }
    toast.success('Saved');
    fetchAll();
  };

  return {
    chores,
    allowance,
    mealPrefs,
    sleepSchedules,
    loading,
    addChore,
    completeChore,
    addAllowance,
    upsertMealPref,
    upsertSleep,
    refresh: fetchAll,
  };
}
