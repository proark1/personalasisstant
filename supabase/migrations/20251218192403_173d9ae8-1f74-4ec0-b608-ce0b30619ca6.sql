-- Add trashed field to tasks for soft delete / archive functionality
ALTER TABLE public.tasks 
ADD COLUMN trashed boolean NOT NULL DEFAULT false;

-- Add trashed_at timestamp for when it was trashed
ALTER TABLE public.tasks 
ADD COLUMN trashed_at timestamp with time zone DEFAULT NULL;

-- Update RLS policies to exclude trashed tasks by default in normal views
-- but allow viewing them when explicitly requested (for trash view)