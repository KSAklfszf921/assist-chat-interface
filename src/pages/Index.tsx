import { useState, useEffect, useRef } from "react";
import { Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { AssistantConfig } from "@/components/AssistantConfig";
import { useAssistantChat } from "@/hooks/useAssistantChat";

const Index = () => {
  const [assistantId, setAssistantId] = useState("");
  const { messages, isLoading, sendMessage, clearChat } = useAssistantChat(assistantId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">OpenAI Assistant</h1>
              <p className="text-xs text-muted-foreground">
                {assistantId ? `ID: ${assistantId.substring(0, 15)}...` : "Ingen assistent konfigurerad"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={clearChat}
              disabled={messages.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <AssistantConfig
              assistantId={assistantId}
              onAssistantIdChange={setAssistantId}
            />
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="container mx-auto max-w-4xl">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[calc(100vh-200px)] items-center justify-center">
                <div className="text-center space-y-4 p-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold">Välkommen!</h2>
                  <p className="text-muted-foreground max-w-md">
                    {assistantId
                      ? "Börja chatta med din OpenAI Assistant genom att skriva ett meddelande nedan."
                      : "Konfigurera din Assistant ID genom att klicka på inställningsikonen ovan."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message, index) => (
                  <ChatMessage
                    key={index}
                    role={message.role}
                    content={message.content}
                  />
                ))}
                {isLoading && (
                  <div className="p-6 animate-pulse">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto max-w-4xl p-4">
          <ChatInput onSendMessage={sendMessage} disabled={isLoading || !assistantId} />
        </div>
      </div>
    </div>
  );
};

export default Index;
