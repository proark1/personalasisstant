ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_category_check
  CHECK (category = ANY (ARRAY['business'::text, 'personal'::text, 'family'::text, 'work'::text, 'shared'::text]));