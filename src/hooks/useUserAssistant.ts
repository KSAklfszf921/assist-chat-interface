import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserAssistant {
  id: string;
  assistant_id: string;
  name: string | null;
}

export const useUserAssistant = () => {
  const [assistant, setAssistant] = useState<UserAssistant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssistant = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAssistant(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_assistants')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) throw error;
      setAssistant(data);
    } catch (error) {
      console.error("Error fetching assistant:", error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta assistentkonfiguration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveAssistant = async (assistantId: string, name?: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Autentisering krävs",
          description: "Du måste vara inloggad",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('user_assistants')
        .upsert({
          user_id: session.user.id,
          assistant_id: assistantId,
          name: name || null,
        }, {
          onConflict: 'user_id,assistant_id'
        });

      if (error) throw error;

      await fetchAssistant();
      
      toast({
        title: "Sparat",
        description: "Assistant konfigurerad",
      });
      
      return true;
    } catch (error) {
      console.error("Error saving assistant:", error);
      toast({
        title: "Fel",
        description: "Kunde inte spara assistant",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteAssistant = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !assistant) return false;

      const { error } = await supabase
        .from('user_assistants')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      setAssistant(null);
      
      toast({
        title: "Borttagen",
        description: "Assistant konfiguration borttagen",
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting assistant:", error);
      toast({
        title: "Fel",
        description: "Kunde inte ta bort assistant",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAssistant();
  }, []);

  return {
    assistant,
    isLoading,
    saveAssistant,
    deleteAssistant,
    refetch: fetchAssistant,
  };
};
