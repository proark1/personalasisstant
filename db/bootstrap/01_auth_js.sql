-- Auth.js (NextAuth) Postgres adapter schema.
-- Source: https://authjs.dev/getting-started/adapters/pg
--
-- Design choices:
--   * `users.id` is UUID (matches the Supabase `auth.users.id` shape so we
--     can preserve IDs during data migration, keeping every FK in the app
--     schema valid).
--   * Table names mirror the adapter defaults — Auth.js will read/write
--     these directly with zero config.
--   * No FKs to `auth.users` anywhere in the app schema after Phase 1b;
--     every FK that previously pointed at `auth.users(id)` will point at
--     `public.users(id)` instead (see squash-schema.ts).
--   * Passwords are NOT stored here. Users on the credentials provider go
--     through Auth.js's verification flow; OAuth users live in `accounts`.

CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text,
  email           text UNIQUE,
  "emailVerified" timestamptz,
  image           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  provider            text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token       text,
  access_token        text,
  expires_at          bigint,
  token_type          text,
  scope               text,
  id_token            text,
  session_state       text,
  UNIQUE (provider, "providerAccountId")
);

CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON public.accounts("userId");

CREATE TABLE IF NOT EXISTS public.sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" text UNIQUE NOT NULL,
  "userId"       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires        timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions("userId");

CREATE TABLE IF NOT EXISTS public.verification_tokens (
  identifier text NOT NULL,
  token      text NOT NULL,
  expires    timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);
