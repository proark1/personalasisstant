-- Add birth_date column to user_contacts for birthday reminders
ALTER TABLE public.user_contacts 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS birthday_reminder BOOLEAN DEFAULT false;