-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Also enable realtime for events table for consistency
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;