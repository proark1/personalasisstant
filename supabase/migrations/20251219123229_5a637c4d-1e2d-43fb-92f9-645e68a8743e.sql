-- Add family_relationship column to user_contacts
ALTER TABLE public.user_contacts 
ADD COLUMN family_relationship TEXT;