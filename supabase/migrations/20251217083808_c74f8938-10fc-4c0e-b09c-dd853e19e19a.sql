-- Add reminder_before column to tasks table (stores minutes before due date)
ALTER TABLE public.tasks 
ADD COLUMN reminder_before integer DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.reminder_before IS 'Number of minutes before due date to send notification reminder';