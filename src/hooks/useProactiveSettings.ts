import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ProactiveSettings {
  id?: string;
  user_id: string;
  enabled: boolean;
  forgotten_tasks_enabled: boolean;
  contract_renewals_enabled: boolean;
  contact_checkins_enabled: boolean;
  event_prep_enabled: boolean;
  habit_streaks_enabled: boolean;
  weekly_planning_enabled: boolean;
  daily_review_enabled: boolean;
  voice_proactive_enabled: boolean;
  calendar_overload_enabled: boolean;
  calendar_overload_threshold: number;
  morning_briefing_time: string;
  evening_review_time: string;
  weekly_planning_day: number;
  forgotten_task_days: number;
  contact_checkin_days: number;
  contract_reminder_days: number[];
  habit_streak_warning_hours: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  push_notifications_enabled: boolean;
  in_app_notifications_enabled: boolean;
  voice_alerts_enabled: boolean;
  meeting_briefing_enabled?: boolean;
  meeting_briefing_minutes?: number[];
  meeting_followup_enabled?: boolean;
  meeting_prep_enabled?: boolean;
  telegram_proactive_enabled?: boolean;
  telegram_group_enabled?: boolean;
  birthday_reminders_enabled?: boolean;
  birthday_reminder_days?: number[];
  prayer_reminders_enabled?: boolean;
  prayer_reminder_minutes?: number;
  evening_dua_enabled?: boolean;
  email_action_alerts_enabled?: boolean;
}

const DEFAULT_SETTINGS: Omit<ProactiveSettings, 'user_id'> = {
  enabled: true,
  forgotten_tasks_enabled: true,
  contract_renewals_enabled: true,
  contact_checkins_enabled: true,
  event_prep_enabled: true,
  habit_streaks_enabled: true,
  weekly_planning_enabled: true,
  daily_review_enabled: true,
  voice_proactive_enabled: false,
  calendar_overload_enabled: true,
  calendar_overload_threshold: 6,
  morning_briefing_time: '08:00',
  evening_review_time: '20:00',
  weekly_planning_day: 0,
  forgotten_task_days: 3,
  contact_checkin_days: 14,
  contract_reminder_days: [30, 14, 7, 3, 1],
  habit_streak_warning_hours: 4,
  quiet_hours_enabled: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  push_notifications_enabled: true,
  in_app_notifications_enabled: true,
  voice_alerts_enabled: false,
  meeting_briefing_enabled: true,
  meeting_briefing_minutes: [15, 5, 1],
  meeting_followup_enabled: true,
  meeting_prep_enabled: true,
  telegram_proactive_enabled: true,
  telegram_group_enabled: true,
  birthday_reminders_enabled: true,
  birthday_reminder_days: [7, 1],
  prayer_reminders_enabled: false,
  prayer_reminder_minutes: 10,
  evening_dua_enabled: false,
  email_action_alerts_enabled: true,
};

export function useProactiveSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ProactiveSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('proactive_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching proactive settings:', error);
      }

      if (data) {
        setSettings(data as ProactiveSettings);
      } else {
        // Use defaults if no settings exist
        setSettings({ ...DEFAULT_SETTINGS, user_id: user.id });
      }
    } catch (err) {
      console.error('Failed to fetch proactive settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<ProactiveSettings>) => {
    if (!user?.id) return;

    const newSettings = { ...settings, ...updates, user_id: user.id };
    setSettings(newSettings as ProactiveSettings);

    try {
      const { error } = await supabase
        .from('proactive_settings')
        .upsert(newSettings, { onConflict: 'user_id' });

      if (error) {
        console.error('Error updating proactive settings:', error);
        toast.error('Failed to save settings');
        fetchSettings(); // Revert to server state
      } else {
        toast.success('Settings saved');
      }
    } catch (err) {
      console.error('Failed to update proactive settings:', err);
      toast.error('Failed to save settings');
    }
  };

  const triggerProactiveCheck = async (triggerType?: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.functions.invoke('proactive-assistant', {
        body: { user_id: user.id, trigger_type: triggerType }
      });

      if (error) {
        console.error('Error triggering proactive check:', error);
      }
    } catch (err) {
      console.error('Failed to trigger proactive check:', err);
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    triggerProactiveCheck,
    refetch: fetchSettings,
  };
}
