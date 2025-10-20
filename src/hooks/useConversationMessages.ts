import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export const useConversationMessages = (conversationId: string | null) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
      
      // Subscribe to realtime updates for new messages
      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `conversation_id=eq.${conversationId}`
          },
          (payload) => {
            console.log('New message received:', payload);
            setMessages((prev) => {
              // Avoid duplicates
              const exists = prev.some(m => m.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as Message];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadMessages = async (convId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast({
        title: "Kunde inte ladda meddelanden",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = async (
    convId: string,
    role: "user" | "assistant",
    content: string,
    metadata?: Record<string, any>
  ): Promise<Message | null> => {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: convId,
          role,
          content,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation's last_message_at
      await supabase
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);

      setMessages((prev) => [...prev, data as Message]);
      return data as Message;
    } catch (error: any) {
      console.error("Error adding message:", error);
      toast({
        title: "Kunde inte spara meddelande",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const addOptimisticMessage = (role: "user" | "assistant", content: string) => {
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId || "",
      role,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    return tempMessage.id;
  };

  const updateOptimisticMessage = (tempId: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === tempId ? { ...msg, content } : msg
      )
    );
  };

  const removeOptimisticMessage = (tempId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
  };

  return {
    messages,
    isLoading,
    loadMessages,
    addMessage,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  };
};
