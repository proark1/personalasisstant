-- Analytics Events table - tracks all user actions
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_category text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  page_path text,
  session_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- AI Usage table - tracks AI token consumption
CREATE TABLE public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  model text,
  prompt_tokens integer DEFAULT 0,
  completion_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  cost_estimate numeric(10, 6) DEFAULT 0,
  request_data jsonb DEFAULT '{}'::jsonb,
  response_status text DEFAULT 'success',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Admin users table
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- Create indexes for performance
CREATE INDEX idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_category ON public.analytics_events(event_category);

CREATE INDEX idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX idx_ai_usage_function_name ON public.ai_usage(function_name);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage(created_at DESC);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Analytics events policies - users can insert their own events, admins can view all
CREATE POLICY "Users can insert their own analytics events"
ON public.analytics_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all analytics events"
ON public.analytics_events FOR SELECT
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

-- AI usage policies - service role inserts, admins can view
CREATE POLICY "Service role can insert ai usage"
ON public.ai_usage FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all ai usage"
ON public.ai_usage FOR SELECT
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own ai usage"
ON public.ai_usage FOR SELECT
USING (auth.uid() = user_id);

-- Admin users policies
CREATE POLICY "Admins can view admin users"
ON public.admin_users FOR SELECT
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage admin users"
ON public.admin_users FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'superadmin'));

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = check_user_id
  )
$$;