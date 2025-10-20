import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const useAssistantChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (message: string) => {
      setIsLoading(true);
      setMessages((prev) => [...prev, { role: "user", content: message }]);

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 60000); // 60s timeout

      try {
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
          clearTimeout(timeoutId);
          return;
        }

        // Use fetch directly to handle SSE streaming
        const response = await fetch(
          `https://cvskbnrxuppbarkspfld.supabase.co/functions/v1/openai-assistant`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ message, threadId }),
            signal: abortController.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Request failed');
        }

        // Extract thread ID from response headers
        const newThreadId = response.headers.get('X-Thread-Id');
        if (newThreadId && newThreadId !== threadId) {
          setThreadId(newThreadId);
        }

        // Parse SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantMessage = '';

        if (!reader) {
          throw new Error('No response body');
        }

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              if (data === '[DONE]') {
                break;
              }

              try {
                const event = JSON.parse(data);
                
                // Handle text deltas from OpenAI
                if (event.type === 'response.text.delta') {
                  assistantMessage += event.delta || '';
                } else if (event.type === 'response.content_part.added') {
                  // Start of new content part
                  continue;
                } else if (event.type === 'response.done') {
                  // Response complete
                  break;
                } else if (event.error) {
                  throw new Error(event.error);
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }

        if (assistantMessage) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: assistantMessage },
          ]);
        }

      } catch (error) {
        console.error("Error sending message:", error);
        
        if (error instanceof Error && error.name === 'AbortError') {
          toast({
            title: "Timeout",
            description: "Förfrågan tog för lång tid",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Fel",
            description: error instanceof Error ? error.message : "Kunde inte skicka meddelande",
            variant: "destructive",
          });
        }
        
        // Remove the user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    },
    [threadId, toast]
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
