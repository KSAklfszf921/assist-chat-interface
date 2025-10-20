-- Skapa storage bucket för chat-bilagor
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', false);

-- RLS Policies för upload
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policies för select
CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policies för delete
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Skapa tabell för att lagra fil-metadata
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  openai_file_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS på message_attachments
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy för att visa bilagor från användarens meddelanden
CREATE POLICY "Users can view attachments from their conversations"
ON public.message_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.chat_messages cm
    JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
    WHERE cm.id = message_attachments.message_id 
    AND cc.user_id = auth.uid()
  )
);

-- RLS Policy för att skapa bilagor till användarens meddelanden
CREATE POLICY "Users can create attachments for their messages"
ON public.message_attachments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.chat_messages cm
    JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
    WHERE cm.id = message_attachments.message_id 
    AND cc.user_id = auth.uid()
  )
);

-- RLS Policy för att ta bort sina egna bilagor
CREATE POLICY "Users can delete their own attachments"
ON public.message_attachments FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.chat_messages cm
    JOIN public.chat_conversations cc ON cm.conversation_id = cc.id
    WHERE cm.id = message_attachments.message_id 
    AND cc.user_id = auth.uid()
  )
);