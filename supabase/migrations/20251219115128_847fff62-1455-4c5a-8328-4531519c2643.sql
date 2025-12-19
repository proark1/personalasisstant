-- Create medications table
CREATE TABLE public.family_medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  prescribing_doctor TEXT,
  pharmacy TEXT,
  refill_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.family_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  appointment_type TEXT DEFAULT 'checkup',
  provider_name TEXT,
  provider_phone TEXT,
  location TEXT,
  appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
  reminder_before INTEGER DEFAULT 60,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vaccinations table
CREATE TABLE public.family_vaccinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_administered DATE NOT NULL,
  administered_by TEXT,
  location TEXT,
  lot_number TEXT,
  next_dose_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_vaccinations ENABLE ROW LEVEL SECURITY;

-- RLS policies for medications
CREATE POLICY "Users can create own medications" ON public.family_medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own medications" ON public.family_medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own medications" ON public.family_medications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own medications" ON public.family_medications FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for appointments
CREATE POLICY "Users can create own appointments" ON public.family_appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own appointments" ON public.family_appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own appointments" ON public.family_appointments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own appointments" ON public.family_appointments FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for vaccinations
CREATE POLICY "Users can create own vaccinations" ON public.family_vaccinations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own vaccinations" ON public.family_vaccinations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own vaccinations" ON public.family_vaccinations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own vaccinations" ON public.family_vaccinations FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_family_medications_user_id ON public.family_medications(user_id);
CREATE INDEX idx_family_medications_member_id ON public.family_medications(family_member_id);
CREATE INDEX idx_family_appointments_user_id ON public.family_appointments(user_id);
CREATE INDEX idx_family_appointments_date ON public.family_appointments(appointment_date);
CREATE INDEX idx_family_vaccinations_user_id ON public.family_vaccinations(user_id);
CREATE INDEX idx_family_vaccinations_member_id ON public.family_vaccinations(family_member_id);