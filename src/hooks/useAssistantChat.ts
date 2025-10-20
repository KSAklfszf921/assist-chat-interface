import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useAssistantChat = (assistantId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (message: string) => {
      if (!assistantId) {
        toast({
          title: "Fel",
          description: "Ingen Assistant ID konfigurerad. Öppna inställningar för att ange ett ID.",
          variant: "destructive",
        });
        return;
      }

      setIsLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: message }]);

      try {
        console.log('Sending message to assistant');

        // Get current session for authentication
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          toast({
            title: "Autentisering krävs",
            description: "Du måste vara inloggad för att använda assistenten.",
            variant: "destructive",
          });
          setMessages((prev) => prev.slice(0, -1));
          setIsLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('openai-assistant', {
          body: { 
            message, 
            threadId,
            assistantId 
          },
        });

        if (error) {
          console.error('Function invocation error:', error);
          throw error;
        }

        console.log('Response from assistant:', data);

        // Extract thread ID from response headers if available
        const newThreadId = data.threadId || threadId;
        if (newThreadId && newThreadId !== threadId) {
          setThreadId(newThreadId);
        }

        // Handle streaming response
        if (data && typeof data === 'object') {
          let assistantMessage = '';
          
          // If we got a direct response (non-streaming)
          if (data.content) {
            assistantMessage = data.content;
          } else if (data.error) {
            throw new Error(data.error);
          }

          if (assistantMessage) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: assistantMessage },
            ]);
          }
        }

      } catch (error) {
        console.error("Error sending message:", error);
        toast({
          title: "Fel",
          description: error instanceof Error ? error.message : "Kunde inte skicka meddelande",
          variant: "destructive",
        });
        
        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
      }
    },
    [assistantId, threadId, toast]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setThreadId(null);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
};
