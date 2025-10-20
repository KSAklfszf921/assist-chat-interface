-- Re-enable RLS and add a deny-all policy
-- Edge functions using service role key will bypass RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create a policy that denies all user access (edge functions bypass this)
CREATE POLICY "No direct user access to rate limits"
  ON public.rate_limits
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);