-- Family Traditions
CREATE TABLE public.family_traditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL DEFAULT 'annual',
  next_occurrence DATE,
  day_of_week INTEGER,
  month_of_year INTEGER,
  day_of_month INTEGER,
  is_active BOOLEAN DEFAULT true,
  last_celebrated_at DATE,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.family_traditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own traditions select" ON public.family_traditions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own traditions insert" ON public.family_traditions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own traditions update" ON public.family_traditions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own traditions delete" ON public.family_traditions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_traditions_updated BEFORE UPDATE ON public.family_traditions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pets
CREATE TABLE public.pets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  species TEXT,
  breed TEXT,
  date_of_birth DATE,
  weight_kg NUMERIC(5,2),
  microchip_number TEXT,
  vet_name TEXT,
  vet_phone TEXT,
  food_brand TEXT,
  food_notes TEXT,
  next_vaccination_date DATE,
  next_vet_checkup DATE,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  notes TEXT,
  photo_url TEXT,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pets select" ON public.pets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pets insert" ON public.pets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own pets update" ON public.pets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own pets delete" ON public.pets FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON public.pets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Household Maintenance
CREATE TABLE public.household_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_name TEXT NOT NULL,
  category TEXT,
  frequency_months INTEGER,
  last_done_date DATE,
  next_due_date DATE,
  provider_name TEXT,
  provider_phone TEXT,
  cost_estimate NUMERIC(10,2),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  reminder_days_before INTEGER DEFAULT 30,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.household_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own maintenance select" ON public.household_maintenance FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own maintenance insert" ON public.household_maintenance FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own maintenance update" ON public.household_maintenance FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own maintenance delete" ON public.household_maintenance FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_maintenance_updated BEFORE UPDATE ON public.household_maintenance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vehicle Records
CREATE TABLE public.vehicle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nickname TEXT NOT NULL,
  make TEXT,
  model TEXT,
  year INTEGER,
  license_plate TEXT,
  vin TEXT,
  current_mileage INTEGER,
  next_inspection_date DATE,
  insurance_provider TEXT,
  insurance_renewal_date DATE,
  next_service_date DATE,
  next_tire_change_date DATE,
  notes TEXT,
  last_reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicle_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own vehicles select" ON public.vehicle_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own vehicles insert" ON public.vehicle_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own vehicles update" ON public.vehicle_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own vehicles delete" ON public.vehicle_records FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicle_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_traditions_user ON public.family_traditions(user_id, next_occurrence);
CREATE INDEX idx_maintenance_due ON public.household_maintenance(user_id, next_due_date);
CREATE INDEX idx_vehicles_user ON public.vehicle_records(user_id);