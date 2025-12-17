-- Add country and city columns to user_contacts table
ALTER TABLE public.user_contacts ADD COLUMN country TEXT;
ALTER TABLE public.user_contacts ADD COLUMN city TEXT;