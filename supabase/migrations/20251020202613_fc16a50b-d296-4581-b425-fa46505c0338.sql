-- Add ChatGPT assistant for all existing users who don't have it yet
INSERT INTO public.user_assistants (user_id, assistant_id, name, is_active)
SELECT 
  ua.user_id,
  'chatgpt' as assistant_id,
  'ChatGPT' as name,
  false as is_active
FROM public.user_assistants ua
WHERE ua.user_id NOT IN (
  SELECT user_id 
  FROM public.user_assistants 
  WHERE assistant_id = 'chatgpt'
)
GROUP BY ua.user_id;