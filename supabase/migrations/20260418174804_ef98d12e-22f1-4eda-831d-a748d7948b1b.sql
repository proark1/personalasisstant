-- Extend external_calendar_connections for multi-provider, per-family-member, CalDAV support
ALTER TABLE public.external_calendar_connections
  ADD COLUMN IF NOT EXISTS family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'oauth',
  ADD COLUMN IF NOT EXISTS caldav_url text,
  ADD COLUMN IF NOT EXISTS caldav_username text,
  ADD COLUMN IF NOT EXISTS caldav_password_encrypted text,
  ADD COLUMN IF NOT EXISTS sync_direction text NOT NULL DEFAULT 'two_way',
  ADD COLUMN IF NOT EXISTS last_sync_error text;

-- Allow 'outlook' and 'apple' as providers (provider was previously open text but let's add a check)
ALTER TABLE public.external_calendar_connections
  DROP CONSTRAINT IF EXISTS external_calendar_connections_provider_check;
ALTER TABLE public.external_calendar_connections
  ADD CONSTRAINT external_calendar_connections_provider_check
  CHECK (provider IN ('google', 'outlook', 'apple', 'ics'));

ALTER TABLE public.external_calendar_connections
  ADD CONSTRAINT external_calendar_connections_auth_type_check
  CHECK (auth_type IN ('oauth', 'caldav', 'ics'));

ALTER TABLE public.external_calendar_connections
  ADD CONSTRAINT external_calendar_connections_sync_direction_check
  CHECK (sync_direction IN ('one_way_pull', 'one_way_push', 'two_way'));

-- Track sync state on events for two-way sync conflict resolution
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sync_status text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS external_etag text,
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.external_calendar_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_pushed_at timestamptz;

ALTER TABLE public.events
  ADD CONSTRAINT events_sync_status_check
  CHECK (sync_status IN ('local', 'pending_push', 'synced', 'pending_pull', 'conflict', 'error'));

CREATE INDEX IF NOT EXISTS idx_events_sync_status ON public.events(sync_status) WHERE sync_status != 'local';
CREATE INDEX IF NOT EXISTS idx_events_connection_id ON public.events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_family_member ON public.external_calendar_connections(family_member_id);

-- RLS: family member calendars are visible to the user who owns the family group
-- (existing user_id-based RLS already covers this since family_members are user-owned)