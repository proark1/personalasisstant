-- Phase 4: Follow-up Queue for Smart Follow-up System
CREATE TABLE IF NOT EXISTS public.follow_up_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL, -- task, event, goal, habit
  entity_id UUID NOT NULL,
  follow_up_type TEXT NOT NULL, -- stalled_task, post_event, goal_check, habit_reminder, day_prediction
  check_at TIMESTAMP WITH TIME ZONE NOT NULL,
  message_template TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, completed, dismissed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'completed', 'dismissed'))
);

-- Enable RLS on follow_up_queue
ALTER TABLE public.follow_up_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for follow_up_queue
CREATE POLICY "Users can view their own follow-ups" 
ON public.follow_up_queue FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own follow-ups" 
ON public.follow_up_queue FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own follow-ups" 
ON public.follow_up_queue FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own follow-ups" 
ON public.follow_up_queue FOR DELETE 
USING (auth.uid() = user_id);

-- Add index for efficient querying
CREATE INDEX idx_follow_up_queue_user_status ON public.follow_up_queue(user_id, status);
CREATE INDEX idx_follow_up_queue_check_at ON public.follow_up_queue(check_at) WHERE status = 'pending';

-- Add last_session_at to profiles for morning briefing detection
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_session_at TIMESTAMP WITH TIME ZONE;

-- Enable realtime for follow_up_queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_queue;