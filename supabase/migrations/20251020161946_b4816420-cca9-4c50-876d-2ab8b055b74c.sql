CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _user_id UUID,
  _endpoint TEXT,
  _window_start TIMESTAMPTZ,
  _max_requests INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Insert or get current count atomically using ON CONFLICT
  INSERT INTO rate_limits (user_id, endpoint, window_start, request_count)
  VALUES (_user_id, _endpoint, _window_start, 1)
  ON CONFLICT (user_id, endpoint, window_start) 
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO current_count;
  
  -- Return whether limit is exceeded
  RETURN current_count <= _max_requests;
END;
$$;