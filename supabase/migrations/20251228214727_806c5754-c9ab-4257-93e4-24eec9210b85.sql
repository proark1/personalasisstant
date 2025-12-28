-- Add favorite field to user_contacts
ALTER TABLE public.user_contacts 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS interaction_count integer DEFAULT 0;

-- Create contact_interactions table for tracking interaction history
CREATE TABLE IF NOT EXISTS public.contact_interactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES public.user_contacts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL DEFAULT 'contact', -- 'call', 'email', 'meeting', 'message', 'contact'
  interaction_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  duration_minutes integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_interactions
CREATE POLICY "Users can view own interactions" 
ON public.contact_interactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own interactions" 
ON public.contact_interactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interactions" 
ON public.contact_interactions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interactions" 
ON public.contact_interactions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id ON public.contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_id ON public.contact_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_is_favorite ON public.user_contacts(is_favorite) WHERE is_favorite = true;