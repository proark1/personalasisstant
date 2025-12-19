-- Create shopping_lists table
CREATE TABLE public.shopping_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'grocery',
  assigned_to UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  is_template BOOLEAN DEFAULT false,
  is_completed BOOLEAN DEFAULT false,
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shopping_list_items table
CREATE TABLE public.shopping_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  category TEXT DEFAULT 'other',
  is_checked BOOLEAN DEFAULT false,
  notes TEXT,
  added_by UUID REFERENCES public.family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for shopping_lists
CREATE POLICY "Users can create own shopping lists" ON public.shopping_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own shopping lists" ON public.shopping_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own shopping lists" ON public.shopping_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shopping lists" ON public.shopping_lists FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for shopping_list_items
CREATE POLICY "Users can create items in own lists" ON public.shopping_list_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view items in own lists" ON public.shopping_list_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update items in own lists" ON public.shopping_list_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete items in own lists" ON public.shopping_list_items FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_shopping_lists_user_id ON public.shopping_lists(user_id);
CREATE INDEX idx_shopping_list_items_list_id ON public.shopping_list_items(list_id);