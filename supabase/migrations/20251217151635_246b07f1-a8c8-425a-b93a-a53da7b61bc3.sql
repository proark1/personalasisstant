-- Add social links to user_contacts
ALTER TABLE public.user_contacts 
ADD COLUMN linkedin_url TEXT,
ADD COLUMN twitter_url TEXT,
ADD COLUMN website_url TEXT;