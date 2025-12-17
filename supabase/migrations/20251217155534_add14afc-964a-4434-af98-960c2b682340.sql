-- Add category field to events table for family/business/personal event color-coding
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'personal';

-- Update existing events to have default category
UPDATE public.events SET category = 'personal' WHERE category IS NULL;