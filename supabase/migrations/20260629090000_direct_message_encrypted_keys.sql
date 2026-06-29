-- Store one encrypted message key per participant so both sender and recipient
-- can decrypt newly sent direct messages after a refetch.
ALTER TABLE public.direct_messages
ADD COLUMN IF NOT EXISTS encrypted_keys jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.direct_messages.encrypted_keys IS
  'Map of user_id -> RSA-wrapped AES message key for direct-message encryption v2.';
