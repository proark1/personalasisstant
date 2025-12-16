-- Add parent_id for subtask hierarchy
ALTER TABLE public.tasks 
ADD COLUMN parent_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE;

-- Add sort_order for drag-and-drop reordering
ALTER TABLE public.tasks 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Create index for efficient parent-child queries
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);

-- Create index for sort order queries
CREATE INDEX idx_tasks_sort_order ON public.tasks(user_id, parent_id, sort_order);