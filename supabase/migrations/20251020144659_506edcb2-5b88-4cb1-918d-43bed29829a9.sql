-- Create table to store user-to-assistant mappings
CREATE TABLE IF NOT EXISTS public.user_assistants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, assistant_id)
);

-- Enable RLS
ALTER TABLE public.user_assistants ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only manage their own assistants
CREATE POLICY "Users can view their own assistants"
  ON public.user_assistants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assistants"
  ON public.user_assistants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assistants"
  ON public.user_assistants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assistants"
  ON public.user_assistants
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create table to track rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No public access to rate_limits table (managed by edge functions only)

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for user_assistants
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_assistants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();