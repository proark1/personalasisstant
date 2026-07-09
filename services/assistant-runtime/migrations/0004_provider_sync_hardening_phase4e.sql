ALTER TABLE assistant_connected_provider_accounts
  ADD COLUMN IF NOT EXISTS last_sync_status text NOT NULL DEFAULT 'healthy'
    CHECK (
      last_sync_status IN (
        'healthy',
        'degraded',
        'throttled',
        'auth_required',
        'stale',
        'paused'
      )
    ),
  ADD COLUMN IF NOT EXISTS last_sync_error_class text
    CHECK (
      last_sync_error_class IS NULL OR last_sync_error_class IN (
        'throttled',
        'transient',
        'provider_unavailable',
        'auth',
        'cursor_expired',
        'permanent'
      )
    ),
  ADD COLUMN IF NOT EXISTS retry_after timestamptz,
  ADD COLUMN IF NOT EXISTS stale_since timestamptz,
  ADD COLUMN IF NOT EXISTS last_status_detail text;

COMMENT ON COLUMN assistant_connected_provider_accounts.last_sync_status IS
  'Operational provider sync status for retries/stale/auth states. OneBrain remains the durable assistant database.';

COMMENT ON COLUMN assistant_connected_provider_accounts.retry_after IS
  'Operational provider retry timing from Retry-After or assistant backoff policy.';

CREATE INDEX IF NOT EXISTS idx_assistant_connected_provider_accounts_retry_after
  ON assistant_connected_provider_accounts (retry_after)
  WHERE retry_after IS NOT NULL;
