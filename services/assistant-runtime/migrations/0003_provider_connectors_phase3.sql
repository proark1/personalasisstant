-- Provider connector operational foundation.
-- OAuth tokens and provider execution state live here as operational state.
-- Durable provider facts, captured content, provenance, retention, and
-- audit-of-record remain in OneBrain.

CREATE TABLE IF NOT EXISTS assistant_provider_oauth_attempts (
  connection_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  state_hash text NOT NULL UNIQUE,
  requested_scope_tier text NOT NULL CHECK (
    requested_scope_tier IN ('read_only', 'draft_write', 'send', 'calendar_write')
  ),
  requested_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  redirect_uri text NOT NULL,
  status text NOT NULL CHECK (
    status IN ('pending', 'completed', 'cancelled', 'failed', 'expired')
  ),
  expires_at timestamptz NOT NULL,
  error_detail text,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_provider_oauth_attempts_status
  ON assistant_provider_oauth_attempts (provider, status, expires_at);

CREATE TABLE IF NOT EXISTS assistant_connected_provider_accounts (
  provider_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  provider_account_ref text NOT NULL,
  provider_subject text NOT NULL,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (
    status IN ('not_configured', 'connecting', 'connected', 'degraded', 'disconnected', 'revoked')
  ),
  sync_state text NOT NULL CHECK (
    sync_state IN ('idle', 'queued', 'syncing', 'healthy', 'degraded', 'failed')
  ),
  granted_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_tier text NOT NULL CHECK (
    scope_tier IN ('read_only', 'draft_write', 'send', 'calendar_write')
  ),
  mail_enabled boolean NOT NULL DEFAULT false,
  calendar_enabled boolean NOT NULL DEFAULT false,
  refresh_token_secret_ref text NOT NULL,
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_sync_error text,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject)
);

COMMENT ON TABLE assistant_connected_provider_accounts IS
  'Operational connected provider account cache for execution, recovery, sync health, reconnect, and disconnect. OneBrain is the durable connected-account database and owns provenance, scope grants, history, privacy, and audit facts; raw tokens live only behind SecretProvider.';

CREATE INDEX IF NOT EXISTS idx_assistant_connected_provider_accounts_scope
  ON assistant_connected_provider_accounts (account_id, user_id, space_id, provider, status);

ALTER TABLE assistant_sync_cursors
  ADD COLUMN IF NOT EXISTS provider_account_id uuid;

ALTER TABLE assistant_provider_subscriptions
  ADD COLUMN IF NOT EXISTS provider_account_id uuid,
  ADD COLUMN IF NOT EXISTS subscription_kind text,
  ADD COLUMN IF NOT EXISTS resource_ref text;

CREATE TABLE IF NOT EXISTS assistant_provider_webhook_events (
  provider text NOT NULL CHECK (provider IN ('google', 'microsoft')),
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, dedupe_key)
);

COMMENT ON TABLE assistant_provider_webhook_events IS
  'Provider webhook replay-dedupe keys. Webhooks enqueue reconciliation; they do not store raw provider content.';

COMMENT ON COLUMN assistant_connected_provider_accounts.email IS
  'Cached provider display label for operational UI/recovery only. OneBrain owns the durable connected-account fact.';

COMMENT ON COLUMN assistant_connected_provider_accounts.display_name IS
  'Cached provider display label for operational UI/recovery only. OneBrain owns the durable connected-account fact.';

COMMENT ON COLUMN assistant_connected_provider_accounts.granted_scopes IS
  'Cached granted scopes for execution gating. OneBrain owns durable scope-grant history and audit metadata.';
