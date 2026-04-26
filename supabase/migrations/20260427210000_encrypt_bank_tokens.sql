-- Encrypt Plaid access tokens at rest.
--
-- Drops the plaintext bank_connections.access_token column and
-- replaces it with access_token_ciphertext (text, base64 of AES-GCM
-- output). Encryption happens app-side in the plaid-exchange edge
-- function using BANK_TOKEN_SECRET (32-byte hex key, injected as a
-- Deno env var). Decryption happens in plaid-sync the same way.
--
-- Why app-side AES-GCM rather than pgsodium / pgcrypto?
--   - No need to add an extension; just one Deno secret.
--   - The DB never sees the key, so a leaked DB dump doesn't yield
--     usable tokens.
--   - Rotation: re-key by adding a new BANK_TOKEN_SECRET version,
--     leaving old ciphertext readable until next sync re-writes it.
--
-- Safe to drop the plaintext column because Plaid wasn't shipped to
-- production yet — there are no existing users to migrate. When
-- production users land later, run a re-link flow rather than try
-- to decrypt unknown plaintext.

ALTER TABLE public.bank_connections
  DROP COLUMN IF EXISTS access_token;

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS access_token_ciphertext TEXT;

COMMENT ON COLUMN public.bank_connections.access_token_ciphertext IS
  'AES-GCM ciphertext of the Plaid access_token, base64-encoded. Encryption key is the BANK_TOKEN_SECRET edge-function secret. Format: base64(iv (12B) || ciphertext || tag (16B)). Plaintext never reaches the database.';
