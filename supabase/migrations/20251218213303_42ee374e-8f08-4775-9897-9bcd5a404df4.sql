-- Create space_members table to link users together
CREATE TABLE public.space_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  member_id UUID NOT NULL,
  member_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(owner_id, member_id)
);

-- Create space_share_settings table for granular permissions
CREATE TABLE public.space_share_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_member_id UUID NOT NULL REFERENCES public.space_members(id) ON DELETE CASCADE,
  share_business_tasks BOOLEAN NOT NULL DEFAULT false,
  share_personal_tasks BOOLEAN NOT NULL DEFAULT false,
  share_family_tasks BOOLEAN NOT NULL DEFAULT false,
  share_work_tasks BOOLEAN NOT NULL DEFAULT false,
  share_contracts BOOLEAN NOT NULL DEFAULT false,
  share_contacts BOOLEAN NOT NULL DEFAULT false,
  share_business_events BOOLEAN NOT NULL DEFAULT false,
  share_personal_events BOOLEAN NOT NULL DEFAULT false,
  share_family_events BOOLEAN NOT NULL DEFAULT false,
  share_work_events BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(space_member_id)
);

-- Create user_notifications table for persistent notifications
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}'::jsonb,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_share_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for space_members
CREATE POLICY "Owners can manage their space members"
ON public.space_members
FOR ALL
USING (auth.uid() = owner_id);

CREATE POLICY "Members can view their memberships"
ON public.space_members
FOR SELECT
USING (auth.uid() = member_id);

CREATE POLICY "Members can update their membership status"
ON public.space_members
FOR UPDATE
USING (auth.uid() = member_id)
WITH CHECK (auth.uid() = member_id);

-- RLS policies for space_share_settings
CREATE POLICY "Owners can manage share settings"
ON public.space_share_settings
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.space_members sm
  WHERE sm.id = space_share_settings.space_member_id
  AND sm.owner_id = auth.uid()
));

CREATE POLICY "Members can view their share settings"
ON public.space_share_settings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.space_members sm
  WHERE sm.id = space_share_settings.space_member_id
  AND sm.member_id = auth.uid()
));

-- RLS policies for user_notifications
CREATE POLICY "Users can view their own notifications"
ON public.user_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.user_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.user_notifications
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications for any user"
ON public.user_notifications
FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- Create trigger for updated_at on space_members
CREATE TRIGGER update_space_members_updated_at
BEFORE UPDATE ON public.space_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for updated_at on space_share_settings
CREATE TRIGGER update_space_share_settings_updated_at
BEFORE UPDATE ON public.space_share_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer function to check if user has access to shared tasks by category
CREATE OR REPLACE FUNCTION public.can_view_shared_task(task_row public.tasks)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = task_row.user_id
    AND sm.member_id = auth.uid()
    AND sm.status = 'accepted'
    AND (
      (task_row.category = 'business' AND sss.share_business_tasks = true) OR
      (task_row.category = 'personal' AND sss.share_personal_tasks = true) OR
      (task_row.category = 'family' AND sss.share_family_tasks = true) OR
      (task_row.category = 'work' AND sss.share_work_tasks = true)
    )
  )
$$;

-- Security definer function to check if user has access to shared events by category
CREATE OR REPLACE FUNCTION public.can_view_shared_event(event_row public.events)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = event_row.user_id
    AND sm.member_id = auth.uid()
    AND sm.status = 'accepted'
    AND (
      (event_row.category = 'business' AND sss.share_business_events = true) OR
      (event_row.category = 'personal' AND sss.share_personal_events = true) OR
      (event_row.category = 'family' AND sss.share_family_events = true) OR
      (event_row.category = 'work' AND sss.share_work_events = true)
    )
  )
$$;

-- Security definer function to check if user has access to shared contracts
CREATE OR REPLACE FUNCTION public.can_view_shared_contracts(owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = owner_user_id
    AND sm.member_id = auth.uid()
    AND sm.status = 'accepted'
    AND sss.share_contracts = true
  )
$$;

-- Security definer function to check if user has access to shared contacts
CREATE OR REPLACE FUNCTION public.can_view_shared_contacts(owner_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = owner_user_id
    AND sm.member_id = auth.uid()
    AND sm.status = 'accepted'
    AND sss.share_contacts = true
  )
$$;

-- Add RLS policy for tasks to allow viewing shared tasks
CREATE POLICY "Users can view shared tasks based on category permissions"
ON public.tasks
FOR SELECT
USING (public.can_view_shared_task(tasks));

-- Add RLS policy for events to allow viewing shared events
CREATE POLICY "Users can view shared events based on category permissions"
ON public.events
FOR SELECT
USING (public.can_view_shared_event(events));

-- Add RLS policy for contracts to allow viewing shared contracts
CREATE POLICY "Users can view shared contracts"
ON public.contracts
FOR SELECT
USING (public.can_view_shared_contracts(user_id));

-- Add RLS policy for contacts to allow viewing shared contacts
CREATE POLICY "Users can view shared contacts"
ON public.user_contacts
FOR SELECT
USING (public.can_view_shared_contacts(user_id));

-- Function to create notification for space members when items are created
CREATE OR REPLACE FUNCTION public.notify_space_members_on_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  owner_name TEXT;
BEGIN
  -- Get owner's display name
  SELECT display_name INTO owner_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Find all space members who should be notified based on task category
  FOR member_record IN
    SELECT sm.member_id, sss.*
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = NEW.user_id
    AND sm.status = 'accepted'
    AND (
      (NEW.category = 'business' AND sss.share_business_tasks = true) OR
      (NEW.category = 'personal' AND sss.share_personal_tasks = true) OR
      (NEW.category = 'family' AND sss.share_family_tasks = true) OR
      (NEW.category = 'work' AND sss.share_work_tasks = true)
    )
  LOOP
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (
      member_record.member_id,
      'task',
      'New Task Shared',
      COALESCE(owner_name, 'Someone') || ' added a new ' || NEW.category || ' task: ' || NEW.title,
      jsonb_build_object('task_id', NEW.id, 'category', NEW.category, 'owner_id', NEW.user_id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for space members when events are created
CREATE OR REPLACE FUNCTION public.notify_space_members_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  owner_name TEXT;
BEGIN
  -- Get owner's display name
  SELECT display_name INTO owner_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Find all space members who should be notified based on event category
  FOR member_record IN
    SELECT sm.member_id, sss.*
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = NEW.user_id
    AND sm.status = 'accepted'
    AND (
      (NEW.category = 'business' AND sss.share_business_events = true) OR
      (NEW.category = 'personal' AND sss.share_personal_events = true) OR
      (NEW.category = 'family' AND sss.share_family_events = true) OR
      (NEW.category = 'work' AND sss.share_work_events = true)
    )
  LOOP
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (
      member_record.member_id,
      'event',
      'New Event Shared',
      COALESCE(owner_name, 'Someone') || ' added a new ' || COALESCE(NEW.category, 'personal') || ' event: ' || NEW.title,
      jsonb_build_object('event_id', NEW.id, 'category', NEW.category, 'owner_id', NEW.user_id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for space members when contracts are created
CREATE OR REPLACE FUNCTION public.notify_space_members_on_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  owner_name TEXT;
BEGIN
  -- Get owner's display name
  SELECT display_name INTO owner_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Find all space members who should be notified
  FOR member_record IN
    SELECT sm.member_id
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = NEW.user_id
    AND sm.status = 'accepted'
    AND sss.share_contracts = true
  LOOP
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (
      member_record.member_id,
      'contract',
      'New Contract Shared',
      COALESCE(owner_name, 'Someone') || ' added a new contract: ' || NEW.name,
      jsonb_build_object('contract_id', NEW.id, 'owner_id', NEW.user_id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for space members when contacts are created
CREATE OR REPLACE FUNCTION public.notify_space_members_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_record RECORD;
  owner_name TEXT;
BEGIN
  -- Get owner's display name
  SELECT display_name INTO owner_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Find all space members who should be notified
  FOR member_record IN
    SELECT sm.member_id
    FROM public.space_members sm
    JOIN public.space_share_settings sss ON sss.space_member_id = sm.id
    WHERE sm.owner_id = NEW.user_id
    AND sm.status = 'accepted'
    AND sss.share_contacts = true
  LOOP
    INSERT INTO public.user_notifications (user_id, type, title, message, data)
    VALUES (
      member_record.member_id,
      'contact',
      'New Contact Shared',
      COALESCE(owner_name, 'Someone') || ' added a new contact: ' || NEW.name,
      jsonb_build_object('contact_id', NEW.id, 'owner_id', NEW.user_id)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create triggers for notifications
CREATE TRIGGER notify_on_task_insert
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_space_members_on_task();

CREATE TRIGGER notify_on_event_insert
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.notify_space_members_on_event();

CREATE TRIGGER notify_on_contract_insert
AFTER INSERT ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.notify_space_members_on_contract();

CREATE TRIGGER notify_on_contact_insert
AFTER INSERT ON public.user_contacts
FOR EACH ROW
EXECUTE FUNCTION public.notify_space_members_on_contact();