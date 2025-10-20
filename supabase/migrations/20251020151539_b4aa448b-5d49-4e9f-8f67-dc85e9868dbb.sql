-- Uppdatera user_assistants för att stödja flera assistenter per användare
-- Lägg till is_active kolumn för att markera vilken assistent som är aktiv
ALTER TABLE user_assistants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Ta bort gamla unique constraint (om den finns)
ALTER TABLE user_assistants DROP CONSTRAINT IF EXISTS user_assistants_user_id_assistant_id_key;

-- Skapa unique constraint för att endast tillåta en aktiv assistent per användare
CREATE UNIQUE INDEX IF NOT EXISTS user_assistants_one_active_per_user 
ON user_assistants(user_id) 
WHERE is_active = true;

-- Skapa index för snabbare queries
CREATE INDEX IF NOT EXISTS idx_user_assistants_user_id ON user_assistants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assistants_active ON user_assistants(user_id, is_active);

-- Funktion för att automatiskt sätta andra assistenter till inaktiva när en aktiveras
CREATE OR REPLACE FUNCTION public.set_active_assistant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    -- Sätt alla andra assistenter för samma användare till inaktiva
    UPDATE user_assistants 
    SET is_active = false 
    WHERE user_id = NEW.user_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Skapa trigger för att automatiskt hantera aktiv status
DROP TRIGGER IF EXISTS trigger_set_active_assistant ON user_assistants;
CREATE TRIGGER trigger_set_active_assistant
  BEFORE INSERT OR UPDATE ON user_assistants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_active_assistant();