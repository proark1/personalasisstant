-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create task_tags junction table
CREATE TABLE public.task_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, tag_id)
);

-- Enable RLS on tags
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tags"
ON public.tags FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tags"
ON public.tags FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tags"
ON public.tags FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tags"
ON public.tags FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on task_tags
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task_tags for their tasks"
ON public.task_tags FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tasks 
  WHERE tasks.id = task_tags.task_id 
  AND tasks.user_id = auth.uid()
));

CREATE POLICY "Users can create task_tags for their tasks"
ON public.task_tags FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tasks 
  WHERE tasks.id = task_tags.task_id 
  AND tasks.user_id = auth.uid()
));

CREATE POLICY "Users can delete task_tags for their tasks"
ON public.task_tags FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.tasks 
  WHERE tasks.id = task_tags.task_id 
  AND tasks.user_id = auth.uid()
));