-- Telegram operational delivery foundation.
-- Stores binding and delivery execution state only. OneBrain remains the
-- durable business-data, provenance, permission, and audit-of-record layer.

CREATE TABLE IF NOT EXISTS assistant_telegram_bindings (
  binding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  status text NOT NULL CHECK (
    status IN ('pending', 'verified', 'paused', 'revoked', 'expired')
  ),
  bot_secret_ref text NOT NULL,
  binding_code_hash text NOT NULL UNIQUE,
  binding_code_expires_at timestamptz NOT NULL,
  telegram_chat_id_hash text UNIQUE,
  telegram_user_id_hash text,
  telegram_chat_secret_ref text,
  verified_at timestamptz,
  revoked_at timestamptz,
  last_update_id text,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_telegram_bindings IS
  'Operational Telegram chat binding state. Raw bot tokens and raw chat IDs are stored only through assistant_secret_references or an external SecretProvider.';

CREATE INDEX IF NOT EXISTS idx_assistant_telegram_bindings_scope_status
  ON assistant_telegram_bindings (account_id, user_id, space_id, status);

CREATE TABLE IF NOT EXISTS assistant_telegram_processed_updates (
  update_id text PRIMARY KEY,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_telegram_processed_updates IS
  'Telegram update idempotency records for webhook replay safety.';

CREATE TABLE IF NOT EXISTS assistant_telegram_deliveries (
  delivery_ref text PRIMARY KEY,
  binding_id uuid NOT NULL REFERENCES assistant_telegram_bindings(binding_id) ON DELETE CASCADE,
  message text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  state text NOT NULL CHECK (
    state IN ('pending', 'leased', 'delivered', 'retry_wait', 'failed', 'dead_lettered', 'cancelled')
  ),
  provider_response_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_telegram_deliveries IS
  'Operational Telegram delivery snapshots for outbox replay. Business memory and durable notification records belong in OneBrain.';

CREATE INDEX IF NOT EXISTS idx_assistant_telegram_deliveries_binding_state
  ON assistant_telegram_deliveries (binding_id, state);
