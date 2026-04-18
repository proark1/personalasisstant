
-- Health records (medical profile per member)
CREATE TABLE public.family_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  blood_type TEXT,
  conditions TEXT[],
  surgeries JSONB DEFAULT '[]'::jsonb,
  primary_doctor_name TEXT,
  primary_doctor_phone TEXT,
  primary_doctor_address TEXT,
  dentist_name TEXT,
  dentist_phone TEXT,
  specialists JSONB DEFAULT '[]'::jsonb,
  last_checkup_date DATE,
  next_checkup_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_health_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own health records select" ON public.family_health_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own health records insert" ON public.family_health_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own health records update" ON public.family_health_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own health records delete" ON public.family_health_records FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_health_records_updated BEFORE UPDATE ON public.family_health_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Emergency contacts
CREATE TABLE public.family_emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  phone TEXT NOT NULL,
  alt_phone TEXT,
  email TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emergency contacts select" ON public.family_emergency_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own emergency contacts insert" ON public.family_emergency_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own emergency contacts update" ON public.family_emergency_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own emergency contacts delete" ON public.family_emergency_contacts FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_emergency_contacts_updated BEFORE UPDATE ON public.family_emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Growth log
CREATE TABLE public.family_growth_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  measured_on DATE NOT NULL DEFAULT CURRENT_DATE,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  head_circumference_cm NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_growth_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own growth log select" ON public.family_growth_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own growth log insert" ON public.family_growth_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own growth log update" ON public.family_growth_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own growth log delete" ON public.family_growth_log FOR DELETE USING (auth.uid() = user_id);

-- Sick log
CREATE TABLE public.family_sick_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  sick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recovery_date DATE,
  symptoms TEXT[],
  diagnosis TEXT,
  treatment TEXT,
  doctor_visited BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_sick_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sick log select" ON public.family_sick_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own sick log insert" ON public.family_sick_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sick log update" ON public.family_sick_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own sick log delete" ON public.family_sick_log FOR DELETE USING (auth.uid() = user_id);

-- Insurance
CREATE TABLE public.family_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  insurance_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  policy_number TEXT,
  group_number TEXT,
  start_date DATE,
  end_date DATE,
  premium_amount NUMERIC,
  premium_frequency TEXT,
  contact_phone TEXT,
  card_image_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insurance select" ON public.family_insurance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own insurance insert" ON public.family_insurance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own insurance update" ON public.family_insurance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own insurance delete" ON public.family_insurance FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_insurance_updated BEFORE UPDATE ON public.family_insurance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Important documents (passport, ID, visa with expiry tracking)
CREATE TABLE public.family_important_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_number TEXT,
  issuing_country TEXT,
  issuing_authority TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  file_path TEXT,
  reminder_days_before INTEGER DEFAULT 180,
  last_reminded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_important_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own important docs select" ON public.family_important_documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own important docs insert" ON public.family_important_documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own important docs update" ON public.family_important_documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own important docs delete" ON public.family_important_documents FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_important_docs_updated BEFORE UPDATE ON public.family_important_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_important_docs_expiry ON public.family_important_documents(user_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX idx_insurance_end_date ON public.family_insurance(user_id, end_date) WHERE end_date IS NOT NULL;
CREATE INDEX idx_growth_member ON public.family_growth_log(family_member_id, measured_on DESC);
CREATE INDEX idx_sick_member ON public.family_sick_log(family_member_id, sick_date DESC);
