-- Add recurrence fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN recurrence_rule TEXT,
ADD COLUMN recurrence_end TIMESTAMP WITH TIME ZONE;

-- Add recurrence fields to events table
ALTER TABLE public.events
ADD COLUMN recurrence_rule TEXT,
ADD COLUMN recurrence_end TIMESTAMP WITH TIME ZONE;

-- Add comments for clarity
COMMENT ON COLUMN public.tasks.recurrence_rule IS 'RRULE format recurrence pattern (e.g., FREQ=DAILY;INTERVAL=1)';
COMMENT ON COLUMN public.events.recurrence_rule IS 'RRULE format recurrence pattern (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)';