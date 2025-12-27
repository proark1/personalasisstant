-- =====================================================
-- Enhanced Islamic Features Tables
-- =====================================================

-- Ramadan Tracker
CREATE TABLE public.ramadan_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  day_number INTEGER NOT NULL, -- 1-30
  fasting_completed BOOLEAN DEFAULT false,
  taraweeh_completed BOOLEAN DEFAULT false,
  suhoor_time TIMESTAMP WITH TIME ZONE,
  iftar_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, day_number)
);

-- Dhikr Counter
CREATE TABLE public.dhikr_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  dhikr_type TEXT NOT NULL, -- 'subhanallah', 'alhamdulillah', 'allahuakbar', etc.
  target_count INTEGER DEFAULT 33,
  completed_count INTEGER DEFAULT 0,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, dhikr_type, log_date)
);

-- Enable RLS on islamic tables
ALTER TABLE public.ramadan_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dhikr_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ramadan_tracker
CREATE POLICY "Users can view their own ramadan data" ON public.ramadan_tracker FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ramadan data" ON public.ramadan_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ramadan data" ON public.ramadan_tracker FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ramadan data" ON public.ramadan_tracker FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dhikr_logs
CREATE POLICY "Users can view their own dhikr data" ON public.dhikr_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own dhikr data" ON public.dhikr_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own dhikr data" ON public.dhikr_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dhikr data" ON public.dhikr_logs FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- Property Management Tables
-- =====================================================

CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL, -- 'house', 'apartment', 'land', 'commercial'
  address TEXT,
  city TEXT,
  country TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  current_value NUMERIC,
  size_sqm NUMERIC,
  notes TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT, -- 'deed', 'contract', 'utility', 'insurance', 'tax', 'other'
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.property_maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'repair', 'cleaning', 'inspection', 'upgrade', 'other'
  cost NUMERIC,
  scheduled_date DATE,
  completed_date DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.property_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL, -- 'Summer Opening', 'Winter Closing', etc.
  checklist_type TEXT, -- 'opening', 'closing', 'seasonal'
  items JSONB DEFAULT '[]'::jsonb, -- Array of {id, text, completed}
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on property tables
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_checklists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for properties
CREATE POLICY "Users can view their own properties" ON public.properties FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own properties" ON public.properties FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own properties" ON public.properties FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for property_documents
CREATE POLICY "Users can view their own property documents" ON public.property_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own property documents" ON public.property_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own property documents" ON public.property_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own property documents" ON public.property_documents FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for property_maintenance
CREATE POLICY "Users can view their own maintenance" ON public.property_maintenance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own maintenance" ON public.property_maintenance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own maintenance" ON public.property_maintenance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own maintenance" ON public.property_maintenance FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for property_checklists
CREATE POLICY "Users can view their own checklists" ON public.property_checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own checklists" ON public.property_checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own checklists" ON public.property_checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own checklists" ON public.property_checklists FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- Startup Workspace Manager Tables
-- =====================================================

CREATE TABLE public.startup_workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  workspace_type TEXT NOT NULL, -- 'gaming', 'ai', 'agency', 'custom'
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'briefcase',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.startup_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.startup_workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  metric_name TEXT NOT NULL, -- 'revenue', 'users', 'mrr', etc.
  metric_value NUMERIC,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on startup tables
ALTER TABLE public.startup_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for startup_workspaces
CREATE POLICY "Users can view their own workspaces" ON public.startup_workspaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own workspaces" ON public.startup_workspaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own workspaces" ON public.startup_workspaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own workspaces" ON public.startup_workspaces FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for startup_metrics
CREATE POLICY "Users can view their own metrics" ON public.startup_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own metrics" ON public.startup_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own metrics" ON public.startup_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own metrics" ON public.startup_metrics FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- AI/Tech News Tables
-- =====================================================

CREATE TABLE public.saved_articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL,
  source TEXT,
  category TEXT, -- 'ai', 'tech', 'startup', 'business'
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  is_bookmarked BOOLEAN DEFAULT true,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.news_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  topics TEXT[] DEFAULT ARRAY['AI', 'Technology', 'Startups'],
  sources TEXT[] DEFAULT ARRAY[]::TEXT[],
  update_frequency TEXT DEFAULT 'daily', -- 'realtime', 'hourly', 'daily'
  include_in_briefing BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on news tables
ALTER TABLE public.saved_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for saved_articles
CREATE POLICY "Users can view their own articles" ON public.saved_articles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own articles" ON public.saved_articles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own articles" ON public.saved_articles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own articles" ON public.saved_articles FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for news_preferences
CREATE POLICY "Users can view their own preferences" ON public.news_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own preferences" ON public.news_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.news_preferences FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- Storage bucket for property documents
-- =====================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('property-documents', 'property-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for property documents
CREATE POLICY "Users can view their own property docs" ON storage.objects FOR SELECT USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload their own property docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own property docs" ON storage.objects FOR UPDATE USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own property docs" ON storage.objects FOR DELETE USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);