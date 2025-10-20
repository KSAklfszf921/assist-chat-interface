import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserAssistant } from "@/hooks/useUserAssistant";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const assistantIdSchema = z.string().regex(/^asst_[a-zA-Z0-9]+$/, "Assistant ID must start with 'asst_' followed by alphanumeric characters");

export const AssistantConfig = () => {
  const { assistant, saveAssistant } = useUserAssistant();
  const { toast } = useToast();
  const [tempId, setTempId] = useState("");
  const [tempName, setTempName] = useState("");
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (assistant) {
      setTempId(assistant.assistant_id);
      setTempName(assistant.name || "");
    }
  }, [assistant]);

  const handleSave = async () => {
    if (!tempId.trim()) {
      setValidationError("Assistant ID is required");
      return;
    }
    
    // Validate assistant ID format
    const validation = assistantIdSchema.safeParse(tempId);
    if (!validation.success) {
      setValidationError(validation.error.errors[0].message);
      toast({
        title: "Invalid Format",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }
    
    setValidationError(null);
    const success = await saveAssistant(tempId, tempName);
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assistant Konfiguration</DialogTitle>
          <DialogDescription>
            Ange ID för din OpenAI Assistant som du vill använda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="assistant-name">Namn (valfritt)</Label>
            <Input
              id="assistant-name"
              placeholder="Min Assistant"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assistant-id">Assistant ID</Label>
            <Input
              id="assistant-id"
              placeholder="asst_..."
              value={tempId}
              onChange={(e) => {
                setTempId(e.target.value);
                setValidationError(null);
              }}
              className={validationError ? "border-destructive" : ""}
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: asst_ followed by alphanumeric characters
            </p>
          </div>
          <Button onClick={handleSave} className="w-full">
            Spara
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
