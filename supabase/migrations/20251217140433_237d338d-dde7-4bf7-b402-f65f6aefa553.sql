-- Activity feed table for tracking changes
CREATE TABLE public.activity_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  item_title TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity for items they own or are shared with"
ON public.activity_feed
FOR SELECT
USING (
  user_id = auth.uid() OR 
  actor_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM shared_items 
    WHERE shared_items.item_id = activity_feed.item_id 
    AND shared_items.shared_with_id = auth.uid()
  )
);

CREATE POLICY "Users can create activity entries"
ON public.activity_feed
FOR INSERT
WITH CHECK (actor_id = auth.uid());

-- Search history table
CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history"
ON public.search_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own search history"
ON public.search_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history"
ON public.search_history
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;

-- Create index for faster activity queries
CREATE INDEX idx_activity_feed_user_id ON public.activity_feed(user_id);
CREATE INDEX idx_activity_feed_item_id ON public.activity_feed(item_id);
CREATE INDEX idx_activity_feed_created_at ON public.activity_feed(created_at DESC);
CREATE INDEX idx_search_history_user_id ON public.search_history(user_id);