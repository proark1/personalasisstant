-- Create table for assistant conversation history
CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  related_startup_id UUID,
  is_startup_brainstorm BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for conversation messages
CREATE TABLE public.assistant_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for startup ideas (extends workspace concept)
CREATE TABLE public.startup_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.startup_workspaces(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  problem_statement TEXT,
  target_audience TEXT,
  unique_value_proposition TEXT,
  key_features JSONB DEFAULT '[]'::jsonb,
  business_model TEXT,
  competitive_advantage TEXT,
  status TEXT DEFAULT 'brainstorming' CHECK (status IN ('brainstorming', 'researching', 'validating', 'building', 'launched', 'archived')),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  ai_insights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key from conversations to startup_ideas
ALTER TABLE public.assistant_conversations 
  ADD CONSTRAINT fk_startup_idea 
  FOREIGN KEY (related_startup_id) 
  REFERENCES public.startup_ideas(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.startup_ideas ENABLE ROW LEVEL SECURITY;

-- RLS policies for assistant_conversations
CREATE POLICY "Users can view own conversations" ON public.assistant_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON public.assistant_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON public.assistant_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON public.assistant_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for assistant_messages
CREATE POLICY "Users can view messages from own conversations" ON public.assistant_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can create messages in own conversations" ON public.assistant_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.assistant_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can delete messages from own conversations" ON public.assistant_messages
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations 
    WHERE id = conversation_id AND user_id = auth.uid()
  ));

-- RLS policies for startup_ideas
CREATE POLICY "Users can view own startup ideas" ON public.startup_ideas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own startup ideas" ON public.startup_ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own startup ideas" ON public.startup_ideas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own startup ideas" ON public.startup_ideas
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_assistant_conversations_user ON public.assistant_conversations(user_id);
CREATE INDEX idx_assistant_conversations_startup ON public.assistant_conversations(related_startup_id);
CREATE INDEX idx_assistant_messages_conversation ON public.assistant_messages(conversation_id);
CREATE INDEX idx_startup_ideas_user ON public.startup_ideas(user_id);
CREATE INDEX idx_startup_ideas_workspace ON public.startup_ideas(workspace_id);
CREATE INDEX idx_startup_ideas_status ON public.startup_ideas(status);