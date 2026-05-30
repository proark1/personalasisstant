-- event_sync_links — one row per (DarAI event, connected calendar).
--
-- The events table tracks a single external_source/external_id, which only
-- models a 1:1 relationship between a local event and ONE external calendar.
-- To mirror a locally-created event to every connected calendar (Google AND
-- Apple, etc.) we need a per-connection copy id, so this table holds one link
-- per (event, connection) with its own provider id + etag + sync state.
--
-- Identity model:
--   * Locally-created event  → events.external_source IS NULL; gets a link for
--     every writable connection (mirror-to-all). The provider id lives on the
--     link, never on the events row.
--   * Provider-origin event  → events.external_source = provider/external_id
--     (legacy/back-compat) AND a link to its origin connection.

CREATE TABLE IF NOT EXISTS public.event_sync_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.external_calendar_connections(id) ON DELETE CASCADE,
  external_id text,
  external_etag text,
  sync_status text NOT NULL DEFAULT 'pending_push',
  last_pushed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_sync_links_status_check CHECK (sync_status IN ('pending_push', 'synced', 'error')),
  CONSTRAINT event_sync_links_unique UNIQUE (event_id, connection_id)
);

CREATE INDEX IF NOT EXISTS idx_event_sync_links_conn_ext ON public.event_sync_links(connection_id, external_id);
CREATE INDEX IF NOT EXISTS idx_event_sync_links_conn_status ON public.event_sync_links(connection_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_event_sync_links_event ON public.event_sync_links(event_id);

ALTER TABLE public.event_sync_links ENABLE ROW LEVEL SECURITY;

-- Edge functions use the service role (RLS-exempt); this policy is for any
-- direct client read/write of links for the user's own events.
DROP POLICY IF EXISTS "own event sync links" ON public.event_sync_links;
CREATE POLICY "own event sync links" ON public.event_sync_links
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.user_id = auth.uid()));

-- When a user-meaningful field of an event changes, flag its mirror links so
-- the next sync pushes the update to each calendar. The sync writer re-sets the
-- specific link it just reconciled back to 'synced' immediately after pulling,
-- so a pull-driven content update doesn't cause a push echo to its origin.
CREATE OR REPLACE FUNCTION public.flag_event_sync_links_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.title IS DISTINCT FROM OLD.title
      OR NEW.start_time IS DISTINCT FROM OLD.start_time
      OR NEW.end_time IS DISTINCT FROM OLD.end_time
      OR NEW.location IS DISTINCT FROM OLD.location
      OR NEW.description IS DISTINCT FROM OLD.description) THEN
    UPDATE public.event_sync_links
      SET sync_status = 'pending_push', updated_at = now()
      WHERE event_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_flag_event_sync_links ON public.events;
CREATE TRIGGER trg_flag_event_sync_links
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_event_sync_links_pending();

-- Backfill: events already tagged with a connection (e.g. Apple-pulled events,
-- or anything previously assigned a connection_id) get a link so they keep
-- syncing under the new model. Google-origin events that predate connection_id
-- tagging are adopted lazily by the pull step (matched on external_source+id).
INSERT INTO public.event_sync_links (event_id, connection_id, external_id, external_etag, sync_status, last_pushed_at)
SELECT e.id, e.connection_id, e.external_id, e.external_etag,
       CASE WHEN e.sync_status = 'pending_push' THEN 'pending_push' ELSE 'synced' END,
       e.last_pushed_at
FROM public.events e
WHERE e.connection_id IS NOT NULL
ON CONFLICT (event_id, connection_id) DO NOTHING;
