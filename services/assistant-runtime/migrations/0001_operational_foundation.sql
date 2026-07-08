-- OneBrain Assistant operational foundation.
-- Assistant Postgres owns execution/retry/recovery state only. Durable business
-- memory, provenance, permissions, retrieval, and audit-of-record belong in
-- OneBrain.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS assistant_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  state text NOT NULL CHECK (
    state IN ('proposed', 'needs_review', 'approved', 'executing', 'executed', 'failed', 'cancelled')
  ),
  action_type text NOT NULL,
  risk_tier text NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  summary text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  sending_account_ref text,
  recipient_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitive_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_reason text NOT NULL,
  reversible boolean NOT NULL DEFAULT false,
  external_side_effect boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_actions IS
  'Operational mirror of typed action state. OneBrain owns proposal content, source provenance, approval facts, final execution facts, policy decisions, and audit-of-record.';

CREATE INDEX IF NOT EXISTS idx_assistant_actions_scope_state
  ON assistant_actions (account_id, user_id, space_id, state);

CREATE TABLE IF NOT EXISTS assistant_action_transitions (
  transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES assistant_actions(action_id) ON DELETE CASCADE,
  from_state text,
  to_state text NOT NULL CHECK (
    to_state IN ('proposed', 'needs_review', 'approved', 'executing', 'executed', 'failed', 'cancelled')
  ),
  actor text NOT NULL,
  channel text CHECK (channel IN ('web', 'telegram', 'voice', 'worker', 'fresh_auth')),
  reason text NOT NULL,
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_outbox (
  outbox_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  action_id uuid REFERENCES assistant_actions(action_id) ON DELETE SET NULL,
  state text NOT NULL CHECK (
    state IN ('pending', 'leased', 'delivered', 'retry_wait', 'failed', 'dead_lettered', 'cancelled')
  ),
  effect_type text NOT NULL,
  payload_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  lease_owner text,
  lease_expires_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_outbox IS
  'Transactional outbox for all external side effects. Rows carry references and execution metadata, not business memory.';

CREATE INDEX IF NOT EXISTS idx_assistant_outbox_runnable
  ON assistant_outbox (state, next_run_at, lease_expires_at);

CREATE TABLE IF NOT EXISTS assistant_jobs (
  job_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  state text NOT NULL CHECK (
    state IN ('queued', 'leased', 'running', 'succeeded', 'retry_wait', 'failed', 'dead_lettered', 'cancelled')
  ),
  job_type text NOT NULL,
  payload_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  audit_correlation_id text NOT NULL,
  timezone text NOT NULL,
  run_at timestamptz NOT NULL,
  lease_owner text,
  lease_expires_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_jobs_runnable
  ON assistant_jobs (state, run_at, lease_expires_at);

CREATE TABLE IF NOT EXISTS assistant_locks (
  lock_key text PRIMARY KEY,
  account_id text,
  user_id text,
  space_id text,
  lease_owner text NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_provider_subscriptions (
  subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  provider text NOT NULL,
  provider_account_ref text NOT NULL,
  subscription_ref text NOT NULL,
  secret_ref text,
  state text NOT NULL DEFAULT 'active',
  expires_at timestamptz,
  renewal_job_id uuid REFERENCES assistant_jobs(job_id) ON DELETE SET NULL,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_ref, subscription_ref)
);

CREATE TABLE IF NOT EXISTS assistant_sync_cursors (
  cursor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  provider text NOT NULL,
  provider_account_ref text NOT NULL,
  cursor_kind text NOT NULL,
  encrypted_cursor_value text,
  cursor_ref text,
  reconciliation_state text NOT NULL DEFAULT 'current',
  last_success_at timestamptz,
  last_error text,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_ref, cursor_kind)
);

CREATE TABLE IF NOT EXISTS assistant_idempotency_keys (
  idempotency_key text PRIMARY KEY,
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_policy_rows (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text,
  space_id text,
  policy_kind text NOT NULL,
  risk_tier text NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  policy_ref text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_secret_references (
  secret_ref text PRIMARY KEY,
  account_id text,
  user_id text,
  space_id text,
  purpose text NOT NULL,
  encrypted_value text NOT NULL,
  key_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  rotated_at timestamptz,
  revoked_at timestamptz
);

COMMENT ON TABLE assistant_secret_references IS
  'Encrypted secret envelopes or managed secret references. Raw secret values must never be stored in OneBrain records or logs.';

CREATE TABLE IF NOT EXISTS assistant_operational_audit (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text,
  user_id text,
  space_id text,
  action_id uuid,
  job_id uuid,
  outbox_id uuid,
  event_type text NOT NULL,
  correlation_id text NOT NULL,
  audit_correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_operational_audit_correlation
  ON assistant_operational_audit (correlation_id, occurred_at);
