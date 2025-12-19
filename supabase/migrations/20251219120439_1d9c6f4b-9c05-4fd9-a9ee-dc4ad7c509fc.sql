-- Create family_budget_categories table
CREATE TABLE public.family_budget_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#3b82f6',
  monthly_limit NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create family_expenses table
CREATE TABLE public.family_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID REFERENCES public.family_budget_categories(id) ON DELETE SET NULL,
  family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.family_budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_expenses ENABLE ROW LEVEL SECURITY;

-- RLS policies for family_budget_categories
CREATE POLICY "Users can view own categories" ON public.family_budget_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories" ON public.family_budget_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.family_budget_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.family_budget_categories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for family_expenses
CREATE POLICY "Users can view own expenses" ON public.family_expenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own expenses" ON public.family_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" ON public.family_expenses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" ON public.family_expenses
  FOR DELETE USING (auth.uid() = user_id);