
-- 1. telegram_group_links
CREATE TABLE IF NOT EXISTS public.telegram_group_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  partner_user_id uuid,
  space_member_id uuid,
  chat_id bigint UNIQUE,
  title text,
  link_code text UNIQUE,
  link_code_expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_group_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages group link"
  ON public.telegram_group_links
  FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Partner can view group link"
  ON public.telegram_group_links
  FOR SELECT
  USING (auth.uid() = partner_user_id);

CREATE TRIGGER update_telegram_group_links_updated_at
  BEFORE UPDATE ON public.telegram_group_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. telegram_user_map
CREATE TABLE IF NOT EXISTS public.telegram_user_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  telegram_username text,
  telegram_first_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_user_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User can view own telegram mapping"
  ON public.telegram_user_map
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "User can manage own telegram mapping"
  ON public.telegram_user_map
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Provenance columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_via text,
  ADD COLUMN IF NOT EXISTS created_by_telegram_user_id bigint;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_via text,
  ADD COLUMN IF NOT EXISTS created_by_telegram_user_id bigint;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS created_via text,
  ADD COLUMN IF NOT EXISTS created_by_telegram_user_id bigint;

ALTER TABLE public.shopping_list_items
  ADD COLUMN IF NOT EXISTS created_via text,
  ADD COLUMN IF NOT EXISTS created_by_telegram_user_id bigint;

-- 4. Proactive setting
ALTER TABLE public.proactive_settings
  ADD COLUMN IF NOT EXISTS telegram_group_enabled boolean NOT NULL DEFAULT true;
