from __future__ import annotations

from contextvars import ContextVar

# Row-level-security scope for assistant Postgres (target-architecture v2 §20:
# the RLS layer mirrors application account checks as a second, independent layer).
#
# Every connection sets the `assistant.account_scope` GUC from this context var:
# - API request paths narrow it to the authenticated principal's account
#   (see api/auth.py), so a scoping bug in application SQL cannot read or write
#   another account's rows.
# - Worker and boot paths keep the cross-account sentinel: background processing
#   (job leasing, outbox relay, tombstone purges) is legitimately cross-scope.
# - A session that never set the GUC at all is denied by the policies (fail
#   closed); ad-hoc psql needs SET assistant.account_scope = '__all__'.

ALL_ACCOUNTS_SENTINEL = "__all__"

current_account_scope: ContextVar[str] = ContextVar(
    "assistant_account_scope", default=ALL_ACCOUNTS_SENTINEL
)
