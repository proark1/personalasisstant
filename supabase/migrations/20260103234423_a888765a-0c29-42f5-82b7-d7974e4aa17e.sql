-- Add column to snooze contract reminders
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS reminder_snoozed_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;