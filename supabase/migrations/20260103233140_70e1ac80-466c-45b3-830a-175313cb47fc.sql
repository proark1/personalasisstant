-- Create Quran reading progress table
CREATE TABLE public.quran_reading_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surah_number INTEGER NOT NULL,
  ayah_number INTEGER NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on user/surah/ayah to prevent duplicates
CREATE UNIQUE INDEX idx_quran_progress_unique ON public.quran_reading_progress (user_id, surah_number, ayah_number);

-- Create Quran reading goals table
CREATE TABLE public.quran_reading_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  daily_ayahs_goal INTEGER NOT NULL DEFAULT 10,
  daily_pages_goal INTEGER,
  daily_surahs_goal INTEGER,
  reminder_enabled BOOLEAN DEFAULT false,
  reminder_time TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.quran_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quran_reading_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for reading progress
CREATE POLICY "Users can view their own reading progress" 
ON public.quran_reading_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading progress" 
ON public.quran_reading_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading progress" 
ON public.quran_reading_progress 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for reading goals
CREATE POLICY "Users can view their own reading goals" 
ON public.quran_reading_goals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading goals" 
ON public.quran_reading_goals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading goals" 
ON public.quran_reading_goals 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_quran_progress_user_date ON public.quran_reading_progress (user_id, read_at);
CREATE INDEX idx_quran_goals_user ON public.quran_reading_goals (user_id);

-- Create trigger for updating goals timestamp
CREATE TRIGGER update_quran_reading_goals_updated_at
BEFORE UPDATE ON public.quran_reading_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();