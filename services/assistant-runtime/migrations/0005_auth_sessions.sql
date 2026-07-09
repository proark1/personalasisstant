-- Assistant-side session references for the auth enforcement layer.
-- OneBrain remains the identity authority: rows here only *reference* a resolved
-- OneBrain account/user/space. Raw bearer tokens are never stored, only a sha256 hash.

CREATE TABLE IF NOT EXISTS assistant_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  user_id text NOT NULL,
  space_id text NOT NULL,
  purpose text NOT NULL DEFAULT 'assistant_operations',
  token_hash text NOT NULL UNIQUE,
  identity_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);

COMMENT ON TABLE assistant_sessions IS
  'Operational assistant session references. OneBrain owns user/account/space identity and permissions; this table stores only a bearer-token hash, resolved scope, and session lifecycle for enforcement and revocation.';

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_active
  ON assistant_sessions (token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_expiry
  ON assistant_sessions (expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_sessions_scope
  ON assistant_sessions (account_id, user_id, space_id);
