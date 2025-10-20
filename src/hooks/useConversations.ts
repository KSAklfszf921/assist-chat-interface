import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Conversation {
  id: string;
  user_id: string;
  assistant_id: string;
  title: string | null;
  thread_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  is_deleted: boolean;
}

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadConversations = async (userId: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("user_id", userId)
        .eq("is_deleted", false)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Kunde inte ladda konversationer",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createConversation = async (
    userId: string,
    assistantId: string,
    title?: string
  ): Promise<Conversation | null> => {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: userId,
          assistant_id: assistantId,
          title: title || null,
        })
        .select()
        .single();

      if (error) throw error;

      setConversations((prev) => [data, ...prev]);
      setActiveConversationId(data.id);
      
      toast({
        title: "Ny konversation skapad",
        description: title || "Konversation med " + assistantId,
      });

      return data;
    } catch (error: any) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Kunde inte skapa konversation",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ is_deleted: true })
        .eq("id", conversationId);

      if (error) throw error;

      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );

      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }

      toast({
        title: "Konversation raderad",
      });
    } catch (error: any) {
      console.error("Error deleting conversation:", error);
      toast({
        title: "Kunde inte radera konversation",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversationId);

      if (error) throw error;

      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, title } : conv
        )
      );
    } catch (error: any) {
      console.error("Error updating conversation title:", error);
    }
  };

  const setActiveConversation = (conversationId: string | null) => {
    setActiveConversationId(conversationId);
  };

  return {
    conversations,
    activeConversationId,
    isLoading,
    loadConversations,
    createConversation,
    deleteConversation,
    updateConversationTitle,
    setActiveConversation,
  };
};
