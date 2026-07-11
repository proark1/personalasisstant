-- OneBrain tombstone feed consumer state.
-- The assistant is a required consumer of OneBrain's deletion tombstone feed
-- (GET /api/service/tombstones). This table stores only the per-account feed
-- cursor; tombstone content stays in OneBrain and is content-free by contract.

CREATE TABLE IF NOT EXISTS assistant_onebrain_tombstone_state (
  account_id text PRIMARY KEY,
  cursor_seq bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE assistant_onebrain_tombstone_state IS
  'Cursor position in the OneBrain deletion tombstone feed per account. Applying a tombstone twice is an idempotent no-op, so losing this cursor is safe but wasteful.';
