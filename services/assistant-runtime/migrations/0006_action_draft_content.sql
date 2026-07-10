-- Draft-reply content and the approval snapshot hash on assistant actions.
-- The content_hash binds an approval to the exact subject/body/recipients/sending
-- account the user saw; editing a draft recomputes it and resets a prior approval.

ALTER TABLE assistant_actions
  ADD COLUMN IF NOT EXISTS draft_subject text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS draft_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS content_hash text NOT NULL DEFAULT '';

COMMENT ON COLUMN assistant_actions.content_hash IS
  'Exact-approval-snapshot hash over draft subject/body/recipients/sending account/changed fields. OneBrain holds the durable approved-content snapshot.';
