-- Create storage bucket for contract documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('contract-documents', 'contract-documents', false);

-- Create RLS policies for contract documents bucket
CREATE POLICY "Users can upload their own contract documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contract-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own contract documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contract-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own contract documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contract-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);