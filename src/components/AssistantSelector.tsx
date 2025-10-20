import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserAssistant } from "@/hooks/useUserAssistant";
import { getAssistantIcon } from "@/lib/assistantIcons";

export const AssistantSelector = () => {
  const { assistants, activeAssistant, setActiveAssistant, isLoading } = useUserAssistant();

  if (isLoading) {
    return (
      <div className="w-[200px] h-10 bg-muted/50 animate-pulse rounded-md" />
    );
  }

  if (assistants.length === 0) {
    return null;
  }

  const handleValueChange = async (assistantId: string) => {
    await setActiveAssistant(assistantId);
  };

  return (
    <Select
      value={activeAssistant?.id}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          {activeAssistant && (
            <div className="flex items-center gap-2">
              {getAssistantIcon(activeAssistant.name || "")}
              <span>{activeAssistant.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {assistants.map((assistant) => (
          <SelectItem key={assistant.id} value={assistant.id}>
            <div className="flex items-center gap-2 w-full">
              {getAssistantIcon(assistant.name || "")}
              <span>{assistant.name}</span>
              {assistant.is_active && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
