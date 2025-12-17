-- Drop the old simple contacts table and create an enhanced one
DROP TABLE IF EXISTS public.user_contacts;

-- Create enhanced contacts table with relationship management
CREATE TABLE public.user_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_user_id UUID, -- Optional: linked to a Flux user
  
  -- Basic info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  
  -- Categorization
  contact_type TEXT NOT NULL DEFAULT 'personal' CHECK (contact_type IN ('personal', 'business')),
  
  -- Personal relationship tier
  personal_tier TEXT CHECK (personal_tier IN ('family', 'close_friend', 'friend', 'acquaintance')),
  
  -- Business relationship level  
  business_level TEXT CHECK (business_level IN ('very_well', 'well', 'barely', 'not_contacted')),
  
  -- Contact frequency (in days)
  contact_frequency_days INTEGER DEFAULT 30,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  next_contact_due TIMESTAMP WITH TIME ZONE,
  
  -- Notes and tags for AI context
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own contacts"
  ON public.user_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create contacts"
  ON public.user_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contacts"
  ON public.user_contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contacts"
  ON public.user_contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_contacts_updated_at
  BEFORE UPDATE ON public.user_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for efficient queries
CREATE INDEX idx_user_contacts_user_id ON public.user_contacts(user_id);
CREATE INDEX idx_user_contacts_next_due ON public.user_contacts(next_contact_due);
CREATE INDEX idx_user_contacts_tags ON public.user_contacts USING GIN(tags);