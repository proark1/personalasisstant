
-- Create user_emails table
CREATE TABLE public.user_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  snippet TEXT,
  body_preview TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  gmail_labels TEXT[] DEFAULT '{}',
  matched_contact_id UUID REFERENCES public.user_contacts(id) ON DELETE SET NULL,
  priority_score INTEGER DEFAULT 3 CHECK (priority_score >= 1 AND priority_score <= 5),
  category TEXT DEFAULT 'other',
  user_archived BOOLEAN DEFAULT false,
  user_snoozed_until TIMESTAMP WITH TIME ZONE,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

-- Create email_sender_rules table
CREATE TABLE public.email_sender_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sender_pattern TEXT NOT NULL,
  default_category TEXT,
  default_priority INTEGER,
  auto_archive BOOLEAN DEFAULT false,
  learned_from_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sender_pattern)
);

-- Enable RLS
ALTER TABLE public.user_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sender_rules ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_emails
CREATE POLICY "Users can view their own emails"
  ON public.user_emails FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own emails"
  ON public.user_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails"
  ON public.user_emails FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails"
  ON public.user_emails FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for email_sender_rules
CREATE POLICY "Users can view their own email rules"
  ON public.email_sender_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email rules"
  ON public.email_sender_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email rules"
  ON public.email_sender_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email rules"
  ON public.email_sender_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_user_emails_user_received ON public.user_emails(user_id, received_at DESC);
CREATE INDEX idx_user_emails_priority ON public.user_emails(user_id, priority_score);
CREATE INDEX idx_user_emails_category ON public.user_emails(user_id, category);
CREATE INDEX idx_user_emails_contact ON public.user_emails(matched_contact_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_emails_updated_at
  BEFORE UPDATE ON public.user_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_sender_rules_updated_at
  BEFORE UPDATE ON public.email_sender_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service role policy for gmail-sync edge function to insert emails
CREATE POLICY "Service role can manage all emails"
  ON public.user_emails FOR ALL
  USING (true)
  WITH CHECK (true);
