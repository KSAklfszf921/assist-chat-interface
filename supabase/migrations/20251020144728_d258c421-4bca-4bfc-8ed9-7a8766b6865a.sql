-- The rate_limits table is only accessed by edge functions using service role key
-- It doesn't need RLS since users never access it directly
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;