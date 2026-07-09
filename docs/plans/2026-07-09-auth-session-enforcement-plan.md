# Auth & Session Enforcement — Implementation Plan (2026-07-09)

## Context

Every business endpoint on the assistant API is currently **unauthenticated**. Identity
is a set of caller-supplied strings (`account_id` / `user_id` / `space_id`) that default to
`user_demo` / `acct_demo` / `space_demo` and are trusted and forwarded without verification
(`api/app.py` query defaults; `schemas.py` `scope` default factories). Anyone who can reach
the API can create/approve actions, read/write OneBrain records, start provider OAuth, and set
up Telegram bindings. This is the single blocking gap before any real inbox/calendar is connected.

The implementation plan (`docs/plans/2026-07-08-onebrain-assistant-implementation-plan.md`,
"Auth And Session Design", lines 1059–1072) states the intended end-state: **OneBrain is the
identity authority**; web login resolves a OneBrain user/account/space; the assistant API
validates that scope before every read/proposal/approval/action and stores only **session
references**; auth is **token-based** (native-shell compatible), revocable, and Telegram binding
must originate from an authenticated web session.

**Reality that shapes this work:** OneBrain is a separate service, not in this repo. Its client
(`providers/onebrain.py`) exposes only data/audit endpoints authenticated with a single static
*service* key — there is **no login / session / `/me` / token-verify** call to delegate to. So
the plan's ideal login cannot be built here yet.

## Decision

Confirmed with the product owner across three choices:

1. **OneBrain remains the identity authority** — do not invent a separate user system.
2. **Minting a session is deferred to OneBrain** (a future OneBrain identity endpoint).
3. **Enforcement is built now.** Minting and enforcement are separable: only *minting* (resolving
   who you are) needs OneBrain; *enforcing* (requiring a valid session, deriving verified scope,
   revocation, gating) needs nothing external. We build all of enforcement now behind a clean
   `IdentityProvider` seam, so the OneBrain handoff later is a single adapter method.

**Outcome:** the open-API hole closes immediately. In production, session minting stays blocked on
OneBrain (login returns `503` until it ships) — strictly safer than today. A config-gated **stub**
identity provider (mirroring the existing `ONEBRAIN_CLIENT_MODE=memory` pattern) mints sessions for
local dev and tests only. No throwaway operator-secret login is added.

## Architecture

### Identity provider seam (the deferred part)
- `interfaces.py`: `IdentityProvider` protocol — `resolve_login(credentials) -> ResolvedIdentity | None`.
- `OneBrainIdentityProvider` — **deferred**: raises `IdentityAuthorityUnavailable`; the sole method to
  implement once OneBrain exposes an identity endpoint.
- `StubIdentityProvider` — dev/test only: mints a `ResolvedIdentity` bound to the configured
  `onebrain_account_id` / `space_id` (and a supplied/derived `user_id`).
- `build_identity_provider(settings)` selects by `AUTH_IDENTITY_MODE` (`onebrain` | `stub` | `disabled`),
  mirroring `build_brain_client`.

### Session layer (built now)
- `SessionRecord` (schemas.py): `session_id`, `token_hash` (sha256 — raw token never stored, mirroring
  the Telegram binding-code-hash + secret discipline), `scope: ScopedIdentity`, `created_at`,
  `expires_at`, `revoked_at`, `last_used_at`.
- `SessionStore` protocol + `InMemorySessionStore` (`domain/sessions.py`) + `PostgresSessionStore`
  (`persistence/postgres.py`). Methods: `create_session`, `get_active_session_by_token_hash`
  (excludes expired/revoked), `revoke_session`, `touch`. Wired into `build_operational_stores`.
- Migration `0005_auth_sessions.sql` (`assistant_sessions` table) following the numbered convention;
  documented in `migrations/README.md`. Applied manually in filename order like 0001–0004.

### Guard + scope derivation
- `api/auth.py`: `require_principal` — a `fastapi.security.HTTPBearer` dependency that hashes the bearer
  token, looks up an active session, `touch`es it, and yields an `AuthPrincipal` carrying the verified
  `ScopedIdentity`. `401` on missing/invalid/expired/revoked. Using `HTTPBearer` makes the OpenAPI
  contract advertise the security scheme (flows to the generated web client).
- Every `/v1/*` business route gains `principal: AuthPrincipal = Depends(require_principal)` and derives
  scope from `principal.scope`. The `user_demo`/`acct_demo` query/body defaults, `_provider_request_scope`
  demo remap, and `build_workday_snapshot` demo fallback are removed/neutralized.
- Where a request still carries `account_id`/`space_id` (brain-records reads), the values must **match**
  the principal's scope or the request is `403`; `purpose` remains a caller-supplied data facet.

### Auth endpoints
- `POST /v1/auth/login` → `IdentityProvider.resolve_login`; on success mints a session, returns the bearer
  token + expiry; `503` when the provider is the deferred OneBrain one.
- `POST /v1/auth/logout` → revoke current session.
- `GET /v1/auth/session` → current principal (`/me`).
- `POST /v1/telegram/setup` gated by `require_principal`, scope derived from the session (plan 1066–1068).

### Public (unauthenticated) routes — unchanged
`/health/live`, `/health/ready`, `/metrics`, `/v1/auth/login`, `POST /v1/telegram/webhook`
(own shared-secret), `GET /v1/providers/oauth/{provider}/callback` (provider redirect; validated by the
minted OAuth `state`), `POST /v1/providers/webhooks/{google,microsoft}` (provider webhooks).

### Config additions (`config.py`)
- `AUTH_IDENTITY_MODE` (default `stub` for local/test, `onebrain` for staging/production).
- `AUTH_SESSION_TTL_SECONDS` (default e.g. 43200).
- CORS already sets `allow_credentials=True`; the frontend will send a bearer, not cookies cross-origin.

## Frontend (`apps/assistant-web`)
- New `app/login/page.tsx`; an auth gate (`middleware.ts` and/or a layout provider) that redirects
  unauthenticated users to `/login`; resolves the `/assistant` + `/settings` 404s only insofar as they
  now sit behind auth (full pages are out of scope here).
- Attach the session token to outbound calls at the two sites in `src/api/client.ts` (`requestJson`
  headers and `getToday`), handling the SSR + browser dual-execution context. Preferred transport per
  plan: httpOnly cookie set by a Next route handler + a BFF proxy so the browser never holds a durable
  credential and CSRF/origin protections apply. Token stored server-side, never in localStorage.

## Tests
- New `tests/conftest.py`: an authenticated `TestClient` fixture built in `AUTH_IDENTITY_MODE=stub`, plus
  a `mint_session` helper. This is the single choke point the current suite lacks (no conftest today).
- Update the ~62 endpoint tests across `test_api.py`, `test_workday_loop.py`, `test_telegram_binding.py`,
  `test_provider_connectors.py` to authenticate.
- New `tests/test_auth.py`: login success/failure, guard `401` (missing/garbage/expired/revoked token),
  logout revocation, scope-mismatch `403`, and OneBrain-mode login `503`.

## Verification
- `python -m pytest services/assistant-runtime/tests` (all green), `python -m ruff check ...`.
- `npm run generate:api` (or the export script) → refreshed `openapi.json` + `generated.ts`; `npm run typecheck:web`; `npm run build:web`; `docker compose config --quiet`.
- Drive it: unauthenticated `GET /v1/today` → `401`; `POST /v1/auth/login` (stub) → token; authenticated
  request → `200`; `POST /v1/auth/logout` → subsequent call `401`; frontend redirects to `/login` when
  unauthenticated. Confirm `POST /v1/auth/login` returns `503` under `AUTH_IDENTITY_MODE=onebrain`.

## Deferred (OneBrain handoff — one method later)
When OneBrain exposes an identity/session endpoint, implement `OneBrainIdentityProvider.resolve_login`
(and add the client call in `providers/onebrain.py`). No change to the guard, session store, revocation,
routes, frontend, or tests. A short spec of the expected OneBrain identity contract will accompany that work.
