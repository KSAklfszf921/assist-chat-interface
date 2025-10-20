import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { AssistantSelector } from "@/components/AssistantSelector";
import { ConversationTabs } from "@/components/ConversationTabs";
import { NewConversationDialog } from "@/components/NewConversationDialog";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { useConversations } from "@/hooks/useConversations";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useUserAssistant } from "@/hooks/useUserAssistant";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [openTabIds, setOpenTabIds] = useState<string[]>([]);
  
  const { activeAssistant, assistants } = useUserAssistant();
  const {
    conversations,
    activeConversationId,
    loadConversations,
    createConversation,
    deleteConversation,
    setActiveConversation,
    updateConversationTitle,
  } = useConversations();
  
  const { messages, isLoading: isLoadingMessages, addMessage, addOptimisticMessage, updateOptimisticMessage } = useConversationMessages(activeConversationId);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  // Session management
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsCheckingAuth(false);
      if (!session) {
        navigate("/auth");
      } else {
        loadConversations(session.user.id);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate, loadConversations]);

  // Don't auto-create conversations on startup - let user initiate

  // Sync threadId when active conversation changes
  useEffect(() => {
    if (activeConversationId) {
      const activeConv = conversations.find(c => c.id === activeConversationId);
      if (activeConv?.thread_id) {
        setThreadId(activeConv.thread_id);
      } else {
        setThreadId(null);
      }
    }
  }, [activeConversationId, conversations]);

  // Auto scroll to bottom when new messages arrive (but only if user is near bottom)
  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      const scrollElement = scrollRef.current;
      const isNearBottom = 
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
      
      if (isNearBottom || isStreamingResponse) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isStreamingResponse, shouldAutoScroll]);

  // Track user scroll position to determine if we should auto-scroll
  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current;
      const isNearBottom = 
        scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight < 100;
      setShouldAutoScroll(isNearBottom);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/auth");
  };

  const handleCreateConversation = async (assistantId: string, title?: string) => {
    if (!user) return;
    
    const conversation = await createConversation(user.id, assistantId, title);
    if (conversation) {
      setThreadId(null); // Reset thread for new conversation
      setOpenTabIds(prev => [...prev, conversation.id]); // Add to open tabs
    }
    return conversation;
  };

  const handleAssistantChange = async (assistantId: string) => {
    if (!user) return;
    
    // Check if there's already an open conversation for this assistant
    const existingConversation = conversations.find(
      (conv) => conv.assistant_id === assistantId && !conv.is_deleted
    );
    
    if (existingConversation) {
      // Switch to existing conversation
      setActiveConversation(existingConversation.id);
      setThreadId(existingConversation.thread_id);
      // Add to open tabs if not already there
      setOpenTabIds(prev => prev.includes(existingConversation.id) ? prev : [...prev, existingConversation.id]);
      console.log('Switched to existing conversation:', existingConversation.id);
    } else {
      // Create new conversation for this assistant
      console.log('Creating new conversation for assistant:', assistantId);
      const newConversation = await handleCreateConversation(assistantId);
      if (newConversation) {
        console.log('New conversation created:', newConversation.id);
      }
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    await deleteConversation(conversationId);
    // Remove from open tabs
    setOpenTabIds(prev => prev.filter(id => id !== conversationId));
  };

  const handleDeleteAllConversations = async () => {
    if (!activeAssistant) return;
    
    const assistantConversations = conversations.filter(
      (conv) => conv.assistant_id === activeAssistant.assistant_id
    );
    
    for (const conv of assistantConversations) {
      await deleteConversation(conv.id);
    }
    
    toast({
      title: "Alla konversationer raderade",
      description: `Raderade ${assistantConversations.length} konversationer för ${activeAssistant.name}`,
    });
  };

  const handleSendMessage = async (message: string) => {
    if (!activeConversationId || !user) return;

    // Client-side validation
    if (!message || message.trim().length === 0) {
      toast({
        title: "Tomt meddelande",
        description: "Skriv ett meddelande först.",
        variant: "destructive",
      });
      return;
    }

    if (message.length > 4000) {
      toast({
        title: "Meddelandet är för långt",
        description: "Meddelandet får inte vara längre än 4000 tecken.",
        variant: "destructive",
      });
      return;
    }

    setIsStreamingResponse(true);

    // Add user message to UI and DB
    const userMessageId = addOptimisticMessage("user", message);
    await addMessage(activeConversationId, "user", message);

    // Add optimistic assistant message
    const assistantTempId = addOptimisticMessage("assistant", "");

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Autentisering krävs",
          description: "Du måste vara inloggad för att använda assistenten.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ message, threadId, conversationId: activeConversationId }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }

      const newThreadId = response.headers.get('X-Thread-Id');
      if (newThreadId && newThreadId !== threadId) {
        setThreadId(newThreadId);
      }

      // Parse SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantMessage = '';
      let currentEvent = '';

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') break;

            try {
              const eventData = JSON.parse(data);
              
              if (currentEvent === 'thread.message.delta') {
                const content = eventData.delta?.content;
                if (content && content[0]?.type === 'text') {
                  const textValue = content[0].text?.value;
                  if (textValue) {
                    assistantMessage += textValue;
                    updateOptimisticMessage(assistantTempId, assistantMessage);
                  }
                }
              } else if (currentEvent === 'thread.message.completed') {
                const content = eventData.content;
                if (content && content[0]?.type === 'text') {
                  assistantMessage = content[0].text.value;
                  updateOptimisticMessage(assistantTempId, assistantMessage);
                }
              } else if (currentEvent === 'thread.run.failed') {
                const lastError = eventData.last_error;
                throw new Error(`Assistant run failed: ${lastError?.message || 'Unknown error'}`);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          }
        }
      }

      // Save final assistant message to DB
      if (assistantMessage) {
        await addMessage(activeConversationId, "assistant", assistantMessage);
        
        // Update conversation title if it's the first message
        const activeConv = conversations.find(c => c.id === activeConversationId);
        if (activeConv && !activeConv.title && messages.length === 0) {
          const title = message.slice(0, 50) + (message.length > 50 ? "..." : "");
          await updateConversationTitle(activeConversationId, title);
        }
      }

    } catch (error) {
      console.error("Error sending message:", error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: "Timeout",
          description: "Förfrågan tog för lång tid",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fel",
          description: error instanceof Error ? error.message : "Kunde inte skicka meddelande",
          variant: "destructive",
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setIsStreamingResponse(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent mb-4">
            <Sparkles className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold">OpenAI Assistants</h1>
          </div>
          <div className="flex items-center gap-2">
            <AssistantSelector onAssistantChange={handleAssistantChange} />
            <SettingsDrawer
              assistantId={activeAssistant?.assistant_id || null}
              assistantName={activeAssistant?.name || null}
              onDeleteAllConversations={handleDeleteAllConversations}
            />
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Conversation Tabs */}
      <ConversationTabs
        conversations={conversations}
        activeConversationId={activeConversationId}
        openTabIds={openTabIds}
        onTabChange={setActiveConversation}
        onTabClose={handleDeleteConversation}
        onNewConversation={() => setNewConversationDialogOpen(true)}
      />

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef} onScrollCapture={handleScroll}>
          <div className="container mx-auto max-w-4xl">
            {!activeConversationId || messages.length === 0 ? (
              <div className="flex h-full min-h-[calc(100vh-250px)] items-center justify-center">
                <div className="text-center space-y-4 p-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold">Välkommen!</h2>
                  <p className="text-muted-foreground max-w-md">
                    {activeConversationId
                      ? "Börja konversationen genom att skriva ett meddelande nedan."
                      : "Skapa en ny konversation för att komma igång."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => (
                  <ChatMessage key={message.id} role={message.role} content={message.content} />
                ))}
                {isStreamingResponse && (
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
      <div className="border-t backdrop-blur-sm py-[50px] rounded-none bg-[#525244]/0">
        <div className="container mx-auto max-w-4xl p-4">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isStreamingResponse || !activeConversationId}
          />
        </div>
      </div>

      {/* New Conversation Dialog */}
      <NewConversationDialog
        open={newConversationDialogOpen}
        onOpenChange={setNewConversationDialogOpen}
        assistants={assistants}
        onCreateConversation={handleCreateConversation}
      />
    </div>
  );
};

export default Index;
