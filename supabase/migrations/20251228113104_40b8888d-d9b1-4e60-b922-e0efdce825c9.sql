-- Create hadith_favorites table for storing user's favorite hadiths
CREATE TABLE public.hadith_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hadith_collection TEXT NOT NULL,
  hadith_number INTEGER NOT NULL,
  arabic_text TEXT NOT NULL,
  english_text TEXT NOT NULL,
  narrator TEXT,
  chapter TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, hadith_collection, hadith_number)
);

-- Enable Row Level Security
ALTER TABLE public.hadith_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own hadith favorites" 
ON public.hadith_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own hadith favorites" 
ON public.hadith_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own hadith favorites" 
ON public.hadith_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_hadith_favorites_user_id ON public.hadith_favorites(user_id);
CREATE INDEX idx_hadith_favorites_collection ON public.hadith_favorites(hadith_collection);