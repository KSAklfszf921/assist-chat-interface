-- Set replica identity for realtime to work properly with all columns
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;