-- Add OAuth token storage columns to external_calendar_connections
ALTER TABLE public.external_calendar_connections
ADD COLUMN IF NOT EXISTS access_token text,
ADD COLUMN IF NOT EXISTS refresh_token text,
ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
ADD COLUMN IF NOT EXISTS external_calendar_id text;

-- Add external source tracking to events table
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS external_source text,
ADD COLUMN IF NOT EXISTS external_id text;

-- Create unique index to prevent duplicate external events
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external_unique 
ON public.events(user_id, external_source, external_id) 
WHERE external_id IS NOT NULL;