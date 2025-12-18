-- Create call_sessions table for tracking video/voice calls
CREATE TABLE public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'connected', 'ended', 'missed', 'declined')),
  call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for call sessions
CREATE POLICY "Users can view their own calls"
ON public.call_sessions
FOR SELECT
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Users can create calls"
ON public.call_sessions
FOR INSERT
WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Users can update their own calls"
ON public.call_sessions
FOR UPDATE
USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Create indexes for better query performance
CREATE INDEX idx_call_sessions_caller ON public.call_sessions(caller_id);
CREATE INDEX idx_call_sessions_callee ON public.call_sessions(callee_id);
CREATE INDEX idx_call_sessions_status ON public.call_sessions(status);

-- Create trigger for updating updated_at
CREATE TRIGGER update_call_sessions_updated_at
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for call signaling
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;