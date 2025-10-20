import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Conversation } from "@/hooks/useConversations";

interface ConversationTabsProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  openTabIds: string[];
  onTabChange: (conversationId: string) => void;
  onTabClose: (conversationId: string) => void;
  onNewConversation: () => void;
}

export const ConversationTabs = ({
  conversations,
  activeConversationId,
  openTabIds,
  onTabChange,
  onTabClose,
  onNewConversation,
}: ConversationTabsProps) => {
  const truncateTitle = (title: string | null, maxLength: number = 20) => {
    if (!title) return "Ny konversation";
    return title.length > maxLength ? title.slice(0, maxLength) + "..." : title;
  };

  // Only show conversations that are explicitly opened in this session
  const activeConversations = conversations.filter(c => 
    openTabIds.includes(c.id)
  );

  if (activeConversations.length === 0) {
    return null;
  }

  return (
    <div className="border-b">
      <ScrollArea className="w-full">
        <Tabs value={activeConversationId || ""} onValueChange={onTabChange}>
          <div className="flex items-center gap-2 px-4">
            <TabsList className="h-12 flex-1">
              {activeConversations.map((conv) => (
                <TabsTrigger
                  key={conv.id}
                  value={conv.id}
                  className="relative group px-4 flex items-center gap-2"
                >
                  <span className="max-w-[150px] truncate">
                    {truncateTitle(conv.title)}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onTabClose(conv.id);
                    }}
                    className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-destructive/10 rounded p-0.5"
                    role="button"
                    aria-label="Stäng konversation"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <Button onClick={onNewConversation} size="sm" variant="ghost">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Tabs>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
