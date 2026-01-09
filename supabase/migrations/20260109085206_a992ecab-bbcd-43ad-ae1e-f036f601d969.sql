-- Create notifications table for sharing and other notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- System can insert notifications (via trigger)
CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify when an item is shared
CREATE OR REPLACE FUNCTION public.notify_on_share()
RETURNS TRIGGER AS $$
DECLARE
  owner_name TEXT;
  item_name TEXT;
BEGIN
  -- Get owner's display name
  SELECT COALESCE(display_name, email, 'Someone') INTO owner_name
  FROM public.profiles
  WHERE user_id = NEW.owner_id;

  -- Get item name based on type
  CASE NEW.item_type
    WHEN 'task' THEN
      SELECT title INTO item_name FROM public.tasks WHERE id = NEW.item_id;
    WHEN 'event' THEN
      SELECT title INTO item_name FROM public.events WHERE id = NEW.item_id;
    WHEN 'contract' THEN
      SELECT name INTO item_name FROM public.contracts WHERE id = NEW.item_id;
    WHEN 'contact' THEN
      SELECT name INTO item_name FROM public.user_contacts WHERE id = NEW.item_id;
    ELSE
      item_name := 'an item';
  END CASE;

  -- Create notification for the recipient
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.shared_with_id,
    'item_shared',
    owner_name || ' shared a ' || NEW.item_type || ' with you',
    COALESCE(item_name, 'Untitled') || ' (' || NEW.permission || ' access)',
    jsonb_build_object(
      'item_type', NEW.item_type,
      'item_id', NEW.item_id,
      'owner_id', NEW.owner_id,
      'permission', NEW.permission,
      'share_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for share notifications
DROP TRIGGER IF EXISTS on_item_shared ON public.shared_items;
CREATE TRIGGER on_item_shared
  AFTER INSERT ON public.shared_items
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_share();

-- Add RLS policies for contracts to allow shared access
CREATE POLICY "Users can view contracts shared with them"
ON public.contracts
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'contract' 
    AND item_id = contracts.id 
    AND shared_with_id = auth.uid()
  )
);

-- Allow users with edit permission to update shared contracts
CREATE POLICY "Users can update contracts shared with edit permission"
ON public.contracts
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'contract' 
    AND item_id = contracts.id 
    AND shared_with_id = auth.uid()
    AND permission = 'edit'
  )
);

-- Add RLS policies for user_contacts to allow shared access
CREATE POLICY "Users can view contacts shared with them"
ON public.user_contacts
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'contact' 
    AND item_id = user_contacts.id 
    AND shared_with_id = auth.uid()
  )
);

-- Allow users with edit permission to update shared contacts
CREATE POLICY "Users can update contacts shared with edit permission"
ON public.user_contacts
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.shared_items 
    WHERE item_type = 'contact' 
    AND item_id = user_contacts.id 
    AND shared_with_id = auth.uid()
    AND permission = 'edit'
  )
);

-- Enable realtime for contracts and contacts
ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_contacts;