-- ============ FINANCES ============
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'checking',
  institution TEXT,
  currency TEXT DEFAULT 'EUR',
  current_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own financial_accounts" ON public.financial_accounts;
CREATE POLICY "own financial_accounts" ON public.financial_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_fa_updated ON public.financial_accounts;
CREATE TRIGGER trg_fa_updated BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  direction TEXT NOT NULL DEFAULT 'expense',
  category TEXT,
  description TEXT,
  merchant TEXT,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_id UUID,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own financial_transactions" ON public.financial_transactions;
CREATE POLICY "own financial_transactions" ON public.financial_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_ft_user_date ON public.financial_transactions(user_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS public.financial_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  monthly_limit NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);
ALTER TABLE public.financial_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own financial_budgets" ON public.financial_budgets;
CREATE POLICY "own financial_budgets" ON public.financial_budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_fb_updated ON public.financial_budgets;
CREATE TRIGGER trg_fb_updated BEFORE UPDATE ON public.financial_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  target_date DATE,
  category TEXT,
  notes TEXT,
  is_achieved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own financial_goals" ON public.financial_goals;
CREATE POLICY "own financial_goals" ON public.financial_goals FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_fg_updated ON public.financial_goals;
CREATE TRIGGER trg_fg_updated BEFORE UPDATE ON public.financial_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID REFERENCES public.financial_transactions(id) ON DELETE SET NULL,
  file_url TEXT,
  file_path TEXT,
  ocr_text TEXT,
  amount NUMERIC,
  merchant TEXT,
  receipt_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own receipts" ON public.receipts;
CREATE POLICY "own receipts" ON public.receipts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ TRAVEL ============
CREATE TABLE IF NOT EXISTS public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  destination_country TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  purpose TEXT,
  companions JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own trips" ON public.trips;
CREATE POLICY "own trips" ON public.trips FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_trips_updated ON public.trips;
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.trip_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  booking_type TEXT NOT NULL,
  provider TEXT,
  confirmation_number TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  origin TEXT,
  destination TEXT,
  cost NUMERIC,
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own trip_bookings" ON public.trip_bookings;
CREATE POLICY "own trip_bookings" ON public.trip_bookings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  program_name TEXT NOT NULL,
  program_type TEXT,
  membership_number TEXT,
  tier TEXT,
  points_balance NUMERIC DEFAULT 0,
  expires_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own loyalty_programs" ON public.loyalty_programs;
CREATE POLICY "own loyalty_programs" ON public.loyalty_programs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_lp_updated ON public.loyalty_programs;
CREATE TRIGGER trg_lp_updated BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.packing_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Packing list',
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.packing_lists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own packing_lists" ON public.packing_lists;
CREATE POLICY "own packing_lists" ON public.packing_lists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_pl_updated ON public.packing_lists;
CREATE TRIGGER trg_pl_updated BEFORE UPDATE ON public.packing_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.country_essentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  plug_type TEXT,
  currency TEXT,
  emergency_number TEXT,
  embassy_phone TEXT,
  embassy_address TEXT,
  language TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, country)
);
ALTER TABLE public.country_essentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own country_essentials" ON public.country_essentials;
CREATE POLICY "own country_essentials" ON public.country_essentials FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_ce_updated ON public.country_essentials;
CREATE TRIGGER trg_ce_updated BEFORE UPDATE ON public.country_essentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PROPERTIES & VEHICLES (user_properties to avoid collision) ============
CREATE TABLE IF NOT EXISTS public.user_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  property_type TEXT DEFAULT 'home',
  address TEXT,
  city TEXT,
  country TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  current_value NUMERIC,
  mortgage_amount NUMERIC,
  mortgage_provider TEXT,
  insurance_provider TEXT,
  insurance_renewal DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own user_properties" ON public.user_properties;
CREATE POLICY "own user_properties" ON public.user_properties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_prop_updated ON public.user_properties;
CREATE TRIGGER trg_prop_updated BEFORE UPDATE ON public.user_properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INT,
  license_plate TEXT,
  vin TEXT,
  insurance_provider TEXT,
  insurance_renewal DATE,
  next_service_date DATE,
  next_inspection_date DATE,
  current_mileage INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own vehicles" ON public.vehicles;
CREATE POLICY "own vehicles" ON public.vehicles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_veh_updated ON public.vehicles;
CREATE TRIGGER trg_veh_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.maintenance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.user_properties(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  performed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  next_due_date DATE,
  cost NUMERIC,
  provider TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own maintenance_log" ON public.maintenance_log;
CREATE POLICY "own maintenance_log" ON public.maintenance_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  property_id UUID REFERENCES public.user_properties(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  serial_number TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  current_value NUMERIC,
  warranty_until DATE,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own inventory_items" ON public.inventory_items;
CREATE POLICY "own inventory_items" ON public.inventory_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_inv_updated ON public.inventory_items;
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PERSONAL HEALTH ============
CREATE TABLE IF NOT EXISTS public.personal_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  schedule TEXT,
  start_date DATE,
  end_date DATE,
  refill_date DATE,
  prescriber TEXT,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_medications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own personal_medications" ON public.personal_medications;
CREATE POLICY "own personal_medications" ON public.personal_medications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_pm_updated ON public.personal_medications;
CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.personal_medications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.personal_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT,
  clinic TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  last_visit DATE,
  next_visit DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_doctors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own personal_doctors" ON public.personal_doctors;
CREATE POLICY "own personal_doctors" ON public.personal_doctors FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_pd_updated ON public.personal_doctors;
CREATE TRIGGER trg_pd_updated BEFORE UPDATE ON public.personal_doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  test_name TEXT NOT NULL,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value NUMERIC,
  unit TEXT,
  reference_low NUMERIC,
  reference_high NUMERIC,
  status TEXT,
  doctor_id UUID REFERENCES public.personal_doctors(id) ON DELETE SET NULL,
  notes TEXT,
  document_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own lab_results" ON public.lab_results;
CREATE POLICY "own lab_results" ON public.lab_results FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workout_date DATE NOT NULL DEFAULT CURRENT_DATE,
  workout_type TEXT,
  duration_minutes INT,
  exercises JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  felt_rating INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own workouts" ON public.workouts;
CREATE POLICY "own workouts" ON public.workouts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ RELATIONSHIPS PLUS ============
CREATE TABLE IF NOT EXISTS public.contact_special_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.user_contacts(id) ON DELETE CASCADE,
  date_type TEXT NOT NULL DEFAULT 'birthday',
  occurs_on DATE NOT NULL,
  reminder_days_before INT DEFAULT 7,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_special_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own contact_special_dates" ON public.contact_special_dates;
CREATE POLICY "own contact_special_dates" ON public.contact_special_dates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.gift_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.user_contacts(id) ON DELETE CASCADE,
  occasion TEXT,
  given_on DATE NOT NULL DEFAULT CURRENT_DATE,
  gift_description TEXT NOT NULL,
  cost NUMERIC,
  reaction TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gift_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own gift_log" ON public.gift_log;
CREATE POLICY "own gift_log" ON public.gift_log FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.friend_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.friend_circles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own friend_circles" ON public.friend_circles;
CREATE POLICY "own friend_circles" ON public.friend_circles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_fc_updated ON public.friend_circles;
CREATE TRIGGER trg_fc_updated BEFORE UPDATE ON public.friend_circles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.friend_circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  circle_id UUID REFERENCES public.friend_circles(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.user_contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(circle_id, contact_id)
);
ALTER TABLE public.friend_circle_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own friend_circle_members" ON public.friend_circle_members;
CREATE POLICY "own friend_circle_members" ON public.friend_circle_members FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ LEARNING ============
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  status TEXT DEFAULT 'queue',
  rating INT,
  started_on DATE,
  finished_on DATE,
  cover_url TEXT,
  notes TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own books" ON public.books;
CREATE POLICY "own books" ON public.books FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_books_updated ON public.books;
CREATE TRIGGER trg_books_updated BEFORE UPDATE ON public.books FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  provider TEXT,
  url TEXT,
  status TEXT DEFAULT 'in_progress',
  progress_percent INT DEFAULT 0,
  started_on DATE,
  completed_on DATE,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own courses" ON public.courses;
CREATE POLICY "own courses" ON public.courses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_courses_updated ON public.courses;
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  current_level TEXT,
  target_level TEXT,
  category TEXT,
  last_practiced DATE,
  practice_frequency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own skills" ON public.skills;
CREATE POLICY "own skills" ON public.skills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_skills_updated ON public.skills;
CREATE TRIGGER trg_skills_updated BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEMORIES & JOURNAL ============
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  title TEXT,
  content TEXT NOT NULL,
  mood TEXT,
  prompt TEXT,
  tags TEXT[],
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own journal_entries" ON public.journal_entries;
CREATE POLICY "own journal_entries" ON public.journal_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_je_updated ON public.journal_entries;
CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.life_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  occurred_on DATE NOT NULL,
  category TEXT,
  related_people JSONB DEFAULT '[]'::jsonb,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.life_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own life_milestones" ON public.life_milestones;
CREATE POLICY "own life_milestones" ON public.life_milestones FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.bucket_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  target_year INT,
  status TEXT DEFAULT 'open',
  achieved_on DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bucket_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own bucket_list" ON public.bucket_list;
CREATE POLICY "own bucket_list" ON public.bucket_list FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_bl_updated ON public.bucket_list;
CREATE TRIGGER trg_bl_updated BEFORE UPDATE ON public.bucket_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();