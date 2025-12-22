-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to send push notification when item is shared
CREATE OR REPLACE FUNCTION public.notify_shared_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_title TEXT;
  owner_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only process task shares for now
  IF NEW.item_type = 'task' THEN
    -- Get the task title
    SELECT title INTO item_title FROM tasks WHERE id = NEW.item_id;
    
    -- Get the owner's display name
    SELECT COALESCE(display_name, email, 'Someone') INTO owner_name 
    FROM profiles WHERE user_id = NEW.owner_id;
    
    notification_title := 'Task Shared With You';
    notification_body := owner_name || ' shared a task: ' || COALESCE(item_title, 'Untitled');
    
    -- Create in-app notification directly (more reliable than HTTP call)
    INSERT INTO user_notifications (user_id, type, title, message, data, read)
    VALUES (
      NEW.shared_with_id,
      'shared_item',
      notification_title,
      notification_body,
      jsonb_build_object(
        'item_type', NEW.item_type,
        'item_id', NEW.item_id,
        'owner_id', NEW.owner_id,
        'permission', NEW.permission
      ),
      false
    );
  ELSIF NEW.item_type = 'event' THEN
    -- Get the event title
    SELECT title INTO item_title FROM events WHERE id = NEW.item_id;
    
    -- Get the owner's display name
    SELECT COALESCE(display_name, email, 'Someone') INTO owner_name 
    FROM profiles WHERE user_id = NEW.owner_id;
    
    notification_title := 'Event Shared With You';
    notification_body := owner_name || ' shared an event: ' || COALESCE(item_title, 'Untitled');
    
    -- Create in-app notification
    INSERT INTO user_notifications (user_id, type, title, message, data, read)
    VALUES (
      NEW.shared_with_id,
      'shared_item',
      notification_title,
      notification_body,
      jsonb_build_object(
        'item_type', NEW.item_type,
        'item_id', NEW.item_id,
        'owner_id', NEW.owner_id,
        'permission', NEW.permission
      ),
      false
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on shared_items table
DROP TRIGGER IF EXISTS on_item_shared ON shared_items;
CREATE TRIGGER on_item_shared
  AFTER INSERT ON shared_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_shared_item();