ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS birthday_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_reminder_days integer[] NOT NULL DEFAULT ARRAY[7,1]::integer[],
  ADD COLUMN IF NOT EXISTS prayer_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prayer_reminder_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS evening_dua_enabled boolean NOT NULL DEFAULT false;