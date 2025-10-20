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
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
  }>;
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
              // Remove corresponding optimistic message if exists
              const withoutTemp = prev.filter(m => 
                !(m.id.startsWith('temp-') && m.content === payload.new.content && m.role === payload.new.role)
              );
              
              // Avoid duplicates
              const exists = withoutTemp.some(m => m.id === payload.new.id);
              if (exists) return prev;
              
              return [...withoutTemp, payload.new as Message];
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
      
      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      
      // Load attachments for all messages
      const messageIds = (messagesData || []).map(m => m.id);
      let attachmentsMap: Record<string, any[]> = {};
      
      if (messageIds.length > 0) {
        const { data: attachmentsData, error: attachmentsError } = await supabase
          .from("message_attachments")
          .select("*")
          .in("message_id", messageIds);
        
        if (!attachmentsError && attachmentsData) {
          // Group attachments by message_id
          attachmentsMap = attachmentsData.reduce((acc, att) => {
            if (!acc[att.message_id]) acc[att.message_id] = [];
            acc[att.message_id].push({
              name: att.file_name,
              size: att.file_size,
              type: att.file_type,
            });
            return acc;
          }, {} as Record<string, any[]>);
        }
      }
      
      // Combine messages with their attachments
      const messagesWithAttachments = (messagesData || []).map(msg => ({
        ...msg,
        attachments: attachmentsMap[msg.id] || undefined,
      })) as Message[];
      
      setMessages(messagesWithAttachments);
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

      // Realtime subscription handles state update automatically
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
