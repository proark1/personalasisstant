
-- 1) profiles: restrict SELECT to own profile
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) message_read_receipts: restrict SELECT to own receipts
DROP POLICY IF EXISTS message_read_receipts_select ON public.message_read_receipts;
CREATE POLICY message_read_receipts_select
ON public.message_read_receipts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) chat-attachments: make bucket private and tighten read policy
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

DROP POLICY IF EXISTS "Chat attachments are publicly accessible" ON storage.objects;
CREATE POLICY "Users can read their own chat attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
