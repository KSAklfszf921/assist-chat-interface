import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface AssistantSettings {
  id: string;
  user_id: string;
  assistant_id: string;
  enable_function_calling: boolean;
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export const useAssistantSettings = (assistantId: string | null) => {
  const [settings, setSettings] = useState<AssistantSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (assistantId) {
      loadSettings(assistantId);
    } else {
      setSettings(null);
    }
  }, [assistantId]);

  const loadSettings = async (asstId: string) => {
    try {
      setIsLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) return;

      const { data, error } = await supabase
        .from("assistant_settings")
        .select("*")
        .eq("user_id", session.session.user.id)
        .eq("assistant_id", asstId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create default settings
        const { data: newSettings, error: insertError } = await supabase
          .from("assistant_settings")
          .insert({
            user_id: session.session.user.id,
            assistant_id: asstId,
            enable_function_calling: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      } else {
        setSettings(data);
      }
    } catch (error: any) {
      console.error("Error loading settings:", error);
      toast({
        title: "Kunde inte ladda inställningar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof AssistantSettings, value: any) => {
    if (!settings) return;

    try {
      const { error } = await supabase
        .from("assistant_settings")
        .update({ [key]: value })
        .eq("id", settings.id);

      if (error) throw error;

      setSettings((prev) => (prev ? { ...prev, [key]: value } : null));

      toast({
        title: "Inställning uppdaterad",
      });
    } catch (error: any) {
      console.error("Error updating setting:", error);
      toast({
        title: "Kunde inte uppdatera inställning",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return {
    settings,
    isLoading,
    loadSettings,
    updateSetting,
  };
};
