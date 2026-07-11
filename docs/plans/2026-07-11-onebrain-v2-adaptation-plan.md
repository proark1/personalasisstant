# OneBrain Target-Architecture v2 Adaptation Plan

Date: 2026-07-11

OneBrain approved its target-architecture v2 and shipped the deletion/tombstone
contract on 2026-07-11 (`onebrain/docs/target-architecture.md`,
`onebrain/docs/deletion-tombstone-contract.md`). Both name PersonalAssistant as
an in-scope module with concrete obligations. This plan records what changed,
what the assistant implemented on 2026-07-11, and what remains blocked on
OneBrain.

The initial product plan
(`docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`) stays the
product spec; the amendment section added to it points here for the v2 deltas.

## What OneBrain v2 changes for the assistant

1. **Deletion tombstones (live contract).** OneBrain is the deletion
   authority. It exposes `GET /api/service/tombstones?since=<cursor>` and
   `POST /api/service/tombstones/{id}/ack`; the assistant is a *required*
   consumer — a deletion is not complete until the assistant applies and acks
   it. Module-initiated erasure uses `POST /api/service/records/delete`
   (refused with 409 under a legal hold). Precedence is fixed:
   `legal hold > erasure > retention expiry`.
2. **Identity shim retirement.** `POST /api/service/assistant/identity/login`
   (password forwarding) is now a declared transitional shim; no further
   integration against it. Target: OneBrain becomes the sole OIDC relying
   party and issues modules short-lived entitlement tokens (5–15 min, verified
   locally) plus server-side revocable refresh tokens.
3. **Acting-for grants gate background sync.** Background provider sync must
   run under a durable, revocable, employee-bound grant that is a credential
   (per-grant secret material), not a service key alone. v2 sequencing:
   "delegation grants land before PersonalAssistant background sync ships."
4. **Two-tier personal spaces.** `personal/{employee}/work-correspondence`
   (company mailbox/calendar data; audited, notice-based access) vs
   `personal/{employee}/assistant-private` (drafts, notes, assistant
   conversations; break-glass only). Record writes must route by tier.
5. **Enforced conformance.** `assistant.v1` graduates from advisory to
   enforced (handshake rejection on version mismatch); a shared allow/deny
   fixture matrix must run in each repo's CI against real Postgres with RLS
   enabled; assistant Postgres needs row-level security.
6. **LLM boundary.** Inference/embedding endpoints must be EU-region,
   zero-retention, named subprocessors; embeddings run inside OneBrain's
   boundary ("no module sends content to a model provider directly");
   classification carries an inference-eligibility ceiling. Untrusted-content
   tags must survive into derived artifacts; draft-for-approval workflows are
   security invariants the model cannot disable.
7. **Service-key lifecycle.** Keys don't expire, but rotation has no
   dual-validity window (rotate → update `ONEBRAIN_SERVICE_KEY` immediately)
   and purpose-pinned keys must cover all 15 assistant purposes.

## Implemented 2026-07-11 (this repo)

- **Tombstone consumer** (`providers/tombstones.py`): a self-rescheduling
  worker job (`onebrain.tombstones.poll`, default every 300s, configurable via
  `ONEBRAIN_TOMBSTONE_POLL_SECONDS`) polls the feed from a persisted cursor
  (`assistant_onebrain_tombstone_state`, migration 0007), applies each
  tombstone (account- and space-scope purges across actions, outbox, jobs,
  sessions, provider accounts/cursors/subscriptions, OAuth attempts, Telegram
  bindings; referenced secrets revoked), acks it, then advances the cursor.
  Apply-then-ack ordering: a crash between the two re-applies an idempotent
  purge rather than losing the deletion. OneBrain outages skip the poll and
  reschedule instead of dead-lettering the chain.
- **Module-initiated erasure client** (`BrainClient.delete_record` →
  `POST /api/service/records/delete`), including 409 legal-hold handling.
  Not yet triggered by any product flow — no assistant flow means "erase" today;
  wire it into account/provider offboarding when that flow exists.
- **Session revocation stopgap**: assistant sessions never re-validate against
  OneBrain after login, so the default TTL dropped 12h → 4h
  (`AUTH_SESSION_TTL_SECONDS`), and an account/space tombstone now deletes the
  scope's sessions. Full fix is the entitlement-token migration (blocked, below).
- **Identity 403 surfacing**: a service key pinned to the wrong app now
  surfaces as a 503 misconfiguration, not a bad-credentials 401.
- **Two-tier space routing** (`providers/space_routing.py`): a wrapping
  `BrainClient` routes writes (and typed reads) by record type — provider
  mail/calendar mirrors → work-correspondence; assistant work-product,
  conversations, transcripts, actions → assistant-private; company-level
  operational metadata (provider health, scope grants, sync state) stays in
  the operational space. Inert until
  `ONEBRAIN_WORK_CORRESPONDENCE_SPACE_ID` / `ONEBRAIN_ASSISTANT_PRIVATE_SPACE_ID`
  are configured, so nothing changes until OneBrain provisions the tier spaces.
- **RLS on assistant Postgres** (migration 0008): forced row-level security on
  every account-scoped operational table, keyed to the
  `assistant.account_scope` GUC. API requests pin the GUC to the authenticated
  principal's account (`api/auth.py` → `persistence/scope.py`); worker paths
  use the `__all__` sentinel; unset scope is denied (fail closed). Enforcement
  is proven by conformance fixtures (`tests/test_rls_conformance.py`) that run
  against real Postgres under a non-superuser app role — CI now provides a
  Postgres service container for them.

## Blocked on OneBrain (design now, build when OneBrain ships)

1. **Entitlement tokens + refresh tokens** (v2 §3, migration step 4): replace
   `OneBrainIdentityProvider.resolve_login` with local verification of
   OneBrain-issued entitlement tokens; delete the password-forwarding shim;
   assistant sessions become derived from OneBrain-refreshable tokens and
   inherit real revocation. The `IdentityProvider` seam already isolates this
   to one adapter.
2. **Acting-for grants** (v2 §11): mint a grant at provider-connect time,
   store its secret behind `SecretProvider`, present it alongside the service
   key on background sync, honor revocation. Blocks shipping live background
   sync beyond the current single-owner deployment.
3. **Shared conformance fixture matrix** (v2 §20): adopt OneBrain's shared
   allow/deny fixtures when published; until then the assistant runs its own
   RLS fixtures (above).
4. **Contract-version handshake**: when OneBrain starts rejecting mismatched
   `assistant.v1` versions at handshake, surface the rejection in
   `/health/ready` (the existing `onebrain_contract` check is the seam).
5. **Tier-space provisioning**: OneBrain must create the two personal tier
   spaces and extend the assistant service key/installation to them; then set
   the two space env vars to activate routing.

## Consequences for the initial plan's phases

- **Phase 5/6 (voice, drafts) LLM work** must select EU-region zero-retention
  endpoints and keep embeddings inside OneBrain; the "Gemini first for speed"
  decision is constrained accordingly. Untrusted-tagging must propagate into
  OneBrain records (`content_trust` metadata exists for Telegram; extend to
  provider-derived records and generation-context provenance).
- **Phase 8 (GDPR hardening) shrinks**: legal holds, retention enforcement,
  and erasure authority are OneBrain's; the assistant's share — tombstone
  consumption, RLS, erasure calls — is implemented now rather than deferred.
- **Deployment**: expect pinned release bundles (OneBrain + modules versioned
  together) instead of independent module deploys; service-key rotation
  requires an immediate `ONEBRAIN_SERVICE_KEY` update (no grace window).
