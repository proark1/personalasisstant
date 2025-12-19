-- Create family_documents table (stores metadata, actual files go in storage bucket)
CREATE TABLE public.family_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other',
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  expiry_date DATE,
  is_sensitive BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for documents
CREATE POLICY "Users can create own documents" ON public.family_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own documents" ON public.family_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.family_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.family_documents FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_family_documents_user_id ON public.family_documents(user_id);
CREATE INDEX idx_family_documents_member_id ON public.family_documents(family_member_id);
CREATE INDEX idx_family_documents_category ON public.family_documents(category);

-- Create storage bucket for family documents
INSERT INTO storage.buckets (id, name, public) VALUES ('family-documents', 'family-documents', false);

-- Storage policies for family-documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'family-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'family-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'family-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'family-documents' AND auth.uid()::text = (storage.foldername(name))[1]);