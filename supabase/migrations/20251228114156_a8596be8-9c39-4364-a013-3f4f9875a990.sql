-- Add mood_note column to store mood explanation for AI learning
ALTER TABLE public.daily_checkins 
ADD COLUMN IF NOT EXISTS mood_note TEXT;