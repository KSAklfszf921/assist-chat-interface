import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserAssistant {
  id: string;
  assistant_id: string;
  name: string | null;
  is_active: boolean;
}

const PREDEFINED_ASSISTANTS = [
  { assistant_id: "asst_0J4GuAbDQ53RnQUBKmuQ2rXz", name: "Övrigt" },
  { assistant_id: "asst_attpbFbLY1d3rcKAdc0LesaF", name: "Bedömning" },
  { assistant_id: "asst_OQr1CTfiVxXLNXWh6ahqeTle", name: "Läxa" },
  { assistant_id: "asst_aCtXJvTTVNEue0LY7oDt570b", name: "Lektion" },
  { assistant_id: "asst_3rtloUT0lPeYhzYJPfj37gob", name: "Prov" },
  { assistant_id: "asst_pHM6m3mcCgo7X4dLEPP2Hm0Z", name: "Planering" },
];

export const useUserAssistant = () => {
  const [assistants, setAssistants] = useState<UserAssistant[]>([]);
  const [activeAssistant, setActiveAssistantState] = useState<UserAssistant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssistants = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAssistants([]);
        setActiveAssistantState(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_assistants')
        .select('*')
        .eq('user_id', session.user.id)
        .order('name');

      if (error) throw error;

      // Om användaren inte har några assistenter, skapa de förkonfigurerade
      if (!data || data.length === 0) {
        await initializeAssistants(session.user.id);
        return;
      }

      setAssistants(data);
      const active = data.find(a => a.is_active) || data[0];
      setActiveAssistantState(active);
    } catch (error) {
      console.error("Error fetching assistants:", error);
      toast({
        title: "Fel",
        description: "Kunde inte hämta assistenter",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const initializeAssistants = async (userId: string) => {
    try {
      // Skapa alla förkonfigurerade assistenter
      const assistantsToCreate = PREDEFINED_ASSISTANTS.map((asst, index) => ({
        user_id: userId,
        assistant_id: asst.assistant_id,
        name: asst.name,
        is_active: index === 0, // Sätt första som aktiv
      }));

      const { error } = await supabase
        .from('user_assistants')
        .insert(assistantsToCreate);

      if (error) throw error;

      // Hämta assistenterna igen
      await fetchAssistants();
      
      toast({
        title: "Assistenter skapade",
        description: "Alla assistenter har konfigurerats",
      });
    } catch (error) {
      console.error("Error initializing assistants:", error);
      toast({
        title: "Fel",
        description: "Kunde inte skapa assistenter",
        variant: "destructive",
      });
    }
  };

  const setActiveAssistant = async (assistantId: string) => {
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

      const assistant = assistants.find(a => a.id === assistantId);
      if (!assistant) return false;

      // Uppdatera aktiv status (triggern hanterar att sätta andra till inaktiva)
      const { error } = await supabase
        .from('user_assistants')
        .update({ is_active: true })
        .eq('id', assistantId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Uppdatera lokalt state
      setAssistants(prev => prev.map(a => ({
        ...a,
        is_active: a.id === assistantId
      })));
      setActiveAssistantState(assistant);

      toast({
        title: "Assistent bytt",
        description: `Nu chattar du med ${assistant.name}`,
      });

      return true;
    } catch (error) {
      console.error("Error setting active assistant:", error);
      toast({
        title: "Fel",
        description: "Kunde inte byta assistent",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  return {
    assistants,
    activeAssistant,
    isLoading,
    setActiveAssistant,
    refetch: fetchAssistants,
  };
};
