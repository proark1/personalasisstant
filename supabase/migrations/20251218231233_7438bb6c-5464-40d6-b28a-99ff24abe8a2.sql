-- Drop the existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view group members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Group admins can add members" ON public.chat_group_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.chat_group_members;

-- Create a security definer function to check group membership without RLS
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Create a security definer function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'admin'
  )
$$;

-- Create a security definer function to check if user created the group
CREATE OR REPLACE FUNCTION public.is_group_creator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_groups
    WHERE id = _group_id
      AND created_by = _user_id
  )
$$;

-- Recreate policies using the security definer functions
CREATE POLICY "Users can view group members" 
ON public.chat_group_members 
FOR SELECT 
USING (public.is_group_member(auth.uid(), group_id));

CREATE POLICY "Group admins can add members" 
ON public.chat_group_members 
FOR INSERT 
WITH CHECK (
  public.is_group_admin(auth.uid(), group_id) OR 
  public.is_group_creator(auth.uid(), group_id)
);

CREATE POLICY "Group admins can remove members" 
ON public.chat_group_members 
FOR DELETE 
USING (
  public.is_group_admin(auth.uid(), group_id) OR 
  user_id = auth.uid()
);