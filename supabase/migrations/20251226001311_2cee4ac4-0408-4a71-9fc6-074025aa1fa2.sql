-- Create proactive_reminders table for scheduled assistant outreach
CREATE TABLE public.proactive_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_type TEXT NOT NULL, -- 'forgotten_task', 'contract_renewal', 'contact_checkin', 'event_prep', 'habit_streak', 'weekly_planning', 'daily_review'
  trigger_entity_type TEXT, -- 'task', 'contract', 'contact', 'event', 'habit', 'checkin'
  trigger_entity_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  action_taken BOOLEAN DEFAULT false,
  action_type TEXT, -- 'dismissed', 'snoozed', 'completed', 'opened'
  snooze_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reminder_delivery_log for tracking what was sent
CREATE TABLE public.reminder_delivery_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reminder_id UUID REFERENCES public.proactive_reminders(id) ON DELETE CASCADE,
  delivery_channel TEXT NOT NULL, -- 'push', 'in_app', 'voice', 'email'
  delivery_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'clicked'
  expo_push_ticket TEXT,
  expo_push_receipt TEXT,
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create proactive_settings for user preferences
CREATE TABLE public.proactive_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  -- Enable/disable features
  enabled BOOLEAN DEFAULT true,
  forgotten_tasks_enabled BOOLEAN DEFAULT true,
  contract_renewals_enabled BOOLEAN DEFAULT true,
  contact_checkins_enabled BOOLEAN DEFAULT true,
  event_prep_enabled BOOLEAN DEFAULT true,
  habit_streaks_enabled BOOLEAN DEFAULT true,
  weekly_planning_enabled BOOLEAN DEFAULT true,
  daily_review_enabled BOOLEAN DEFAULT true,
  voice_proactive_enabled BOOLEAN DEFAULT false,
  -- Timing preferences
  morning_briefing_time TIME DEFAULT '08:00',
  evening_review_time TIME DEFAULT '20:00',
  weekly_planning_day INTEGER DEFAULT 0, -- 0 = Sunday
  -- Thresholds
  forgotten_task_days INTEGER DEFAULT 3,
  contact_checkin_days INTEGER DEFAULT 14,
  contract_reminder_days INTEGER[] DEFAULT '{30, 14, 7, 3, 1}',
  habit_streak_warning_hours INTEGER DEFAULT 4,
  -- Quiet hours
  quiet_hours_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  -- Channels
  push_notifications_enabled BOOLEAN DEFAULT true,
  in_app_notifications_enabled BOOLEAN DEFAULT true,
  voice_alerts_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add last_reminded_at to relevant tables
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.user_contacts ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP WITH TIME ZONE;

-- Add expo_push_token to push_tokens table
ALTER TABLE public.push_tokens ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Enable RLS
ALTER TABLE public.proactive_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proactive_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proactive_reminders
CREATE POLICY "Users can view own reminders" ON public.proactive_reminders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reminders" ON public.proactive_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON public.proactive_reminders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON public.proactive_reminders
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all reminders" ON public.proactive_reminders
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for reminder_delivery_log
CREATE POLICY "Users can view own delivery logs" ON public.reminder_delivery_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage delivery logs" ON public.reminder_delivery_log
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for proactive_settings
CREATE POLICY "Users can view own settings" ON public.proactive_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settings" ON public.proactive_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.proactive_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_proactive_reminders_user_scheduled ON public.proactive_reminders(user_id, scheduled_for) WHERE is_active = true;
CREATE INDEX idx_proactive_reminders_type ON public.proactive_reminders(reminder_type);
CREATE INDEX idx_reminder_delivery_log_user ON public.reminder_delivery_log(user_id);
CREATE INDEX idx_reminder_delivery_log_reminder ON public.reminder_delivery_log(reminder_id);

-- Enable realtime for proactive_reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.proactive_reminders;