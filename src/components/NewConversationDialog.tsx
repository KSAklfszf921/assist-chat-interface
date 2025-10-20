import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAssistantIcon } from "@/lib/assistantIcons";

interface Assistant {
  id: string;
  assistant_id: string;
  name: string | null;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistants: Assistant[];
  onCreateConversation: (assistantId: string, title?: string) => void;
}

export const NewConversationDialog = ({
  open,
  onOpenChange,
  assistants,
  onCreateConversation,
}: NewConversationDialogProps) => {
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>("");
  const [title, setTitle] = useState("");

  const handleCreate = () => {
    if (!selectedAssistantId) return;
    onCreateConversation(selectedAssistantId, title || undefined);
    setTitle("");
    setSelectedAssistantId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ny konversation</DialogTitle>
          <DialogDescription>
            Välj en assistent och ge konversationen ett namn (valfritt)
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="assistant">Assistent</Label>
            <Select value={selectedAssistantId} onValueChange={setSelectedAssistantId}>
              <SelectTrigger id="assistant">
                <SelectValue placeholder="Välj assistent" />
              </SelectTrigger>
              <SelectContent>
                {assistants.map((assistant) => (
                  <SelectItem key={assistant.id} value={assistant.assistant_id}>
                    <div className="flex items-center gap-2">
                      {getAssistantIcon(assistant.name || "")}
                      <span>{assistant.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Titel (valfritt)</Label>
            <Input
              id="title"
              placeholder="T.ex. Dagens lektion"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreate} disabled={!selectedAssistantId}>
            Skapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
