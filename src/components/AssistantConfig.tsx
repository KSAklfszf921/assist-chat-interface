import { useState } from "react";
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

interface AssistantConfigProps {
  assistantId: string;
  onAssistantIdChange: (id: string) => void;
}

export const AssistantConfig = ({
  assistantId,
  onAssistantIdChange,
}: AssistantConfigProps) => {
  const [tempId, setTempId] = useState(assistantId);
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    onAssistantIdChange(tempId);
    setOpen(false);
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
            <Label htmlFor="assistant-id">Assistant ID</Label>
            <Input
              id="assistant-id"
              placeholder="asst_..."
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            Spara
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
