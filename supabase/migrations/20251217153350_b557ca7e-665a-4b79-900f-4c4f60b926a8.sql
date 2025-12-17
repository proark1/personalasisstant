-- Create contracts table for subscription and contract management
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Basic Info
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  provider TEXT,
  
  -- Cost Tracking
  cost_amount DECIMAL(10,2),
  cost_frequency TEXT DEFAULT 'monthly',
  
  -- Dates & Renewal
  start_date DATE,
  end_date DATE,
  renewal_date DATE,
  cancellation_notice_days INTEGER DEFAULT 30,
  auto_renews BOOLEAN DEFAULT true,
  
  -- Additional Info
  contract_number TEXT,
  notes TEXT,
  document_url TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own contracts"
ON public.contracts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contracts"
ON public.contracts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts"
ON public.contracts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts"
ON public.contracts FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();