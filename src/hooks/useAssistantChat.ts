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
      // Client-side validation
      if (!message || message.trim().length === 0) {
        toast({
          title: "Tomt meddelande",
          description: "Skriv ett meddelande först.",
          variant: "destructive",
        });
        return;
      }

      if (message.length > 4000) {
        toast({
          title: "Meddelandet är för långt",
          description: "Meddelandet får inte vara längre än 4000 tecken.",
          variant: "destructive",
        });
        return;
      }

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
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-assistant`,
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
        let currentEvent = '';
        let isFirstDelta = true;

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
            // Handle SSE format: 'event:' and 'data:' are on separate lines
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              if (data === '[DONE]') {
                break;
              }

              try {
                const eventData = JSON.parse(data);
                
                // Handle OpenAI Assistants API v2 events
                if (currentEvent === 'thread.message.delta') {
                  // Text comes in delta.content[0].text.value
                  const content = eventData.delta?.content;
                  if (content && content[0]?.type === 'text') {
                    const textValue = content[0].text?.value;
                    if (textValue) {
                      assistantMessage += textValue;
                      
                      // Update UI in real-time
                      setMessages((prev) => {
                        if (isFirstDelta) {
                          isFirstDelta = false;
                          return [...prev, { role: "assistant", content: textValue }];
                        } else {
                          const updated = [...prev];
                          updated[updated.length - 1] = {
                            role: "assistant",
                            content: assistantMessage
                          };
                          return updated;
                        }
                      });
                    }
                  }
                } else if (currentEvent === 'thread.message.completed') {
                  // Fallback: Get complete message if we missed deltas
                  const content = eventData.content;
                  if (content && content[0]?.type === 'text') {
                    assistantMessage = content[0].text.value;
                  }
                } else if (currentEvent === 'thread.run.failed') {
                  const lastError = eventData.last_error;
                  throw new Error(`Assistant run failed: ${lastError?.message || 'Unknown error'}`);
                } else if (currentEvent === 'thread.run.cancelled') {
                  throw new Error('Assistant run was cancelled');
                } else if (currentEvent === 'thread.run.expired') {
                  throw new Error('Assistant run expired');
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError, 'Event:', currentEvent, 'Line:', line);
              }
            }
          }
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
