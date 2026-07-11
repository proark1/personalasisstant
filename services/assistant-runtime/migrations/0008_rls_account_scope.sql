-- Row-level security on account-scoped operational tables.
--
-- Target-architecture v2 requires the assistant module to mirror OneBrain's
-- account isolation with forced Postgres RLS as a second, independent layer.
-- The application sets the `assistant.account_scope` GUC on every connection
-- (persistence/scope.py):
--   - an authenticated API request pins it to the principal's account,
--   - worker/background paths use the '__all__' sentinel (cross-scope by design),
--   - a session that never set the GUC is denied (fail closed).
--
-- Excluded for now (no NOT NULL account_id column of their own):
--   assistant_action_transitions, assistant_telegram_deliveries,
--   assistant_telegram_processed_updates, assistant_provider_webhook_events
--     (child/dedupe tables reachable only through scoped parents),
--   assistant_secret_references, assistant_operational_audit, assistant_locks
--     (account_id is nullable today; scoping them is a named follow-up).

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'assistant_actions',
    'assistant_outbox',
    'assistant_jobs',
    'assistant_sessions',
    'assistant_telegram_bindings',
    'assistant_connected_provider_accounts',
    'assistant_provider_oauth_attempts',
    'assistant_sync_cursors',
    'assistant_provider_subscriptions',
    'assistant_idempotency_keys',
    'assistant_policy_rows',
    'assistant_onebrain_tombstone_state'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS assistant_account_scope ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY assistant_account_scope ON %I '
      'USING ('
      '  current_setting(''assistant.account_scope'', true) = ''__all__'''
      '  OR account_id = current_setting(''assistant.account_scope'', true)'
      ') '
      'WITH CHECK ('
      '  current_setting(''assistant.account_scope'', true) = ''__all__'''
      '  OR account_id = current_setting(''assistant.account_scope'', true)'
      ')',
      tbl
    );
  END LOOP;
END $$;
