-- Add contact_id to family_members to link with user_contacts
ALTER TABLE public.family_members
ADD COLUMN contact_id uuid REFERENCES public.user_contacts(id) ON DELETE SET NULL;

-- Add contact_id to contracts to link with user_contacts (e.g., insurance agent, utility provider contact)
ALTER TABLE public.contracts
ADD COLUMN contact_id uuid REFERENCES public.user_contacts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_family_members_contact_id ON public.family_members(contact_id);
CREATE INDEX idx_contracts_contact_id ON public.contracts(contact_id);