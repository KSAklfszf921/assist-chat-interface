import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Sparkles, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { AssistantSelector } from "@/components/AssistantSelector";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { useUserAssistant } from "@/hooks/useUserAssistant";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
const Index = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const {
    activeAssistant,
    isLoading: isLoadingAssistant
  } = useUserAssistant();
  const {
    messages,
    isLoading,
    sendMessage,
    clearChat
  } = useAssistantChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevAssistantRef = useRef<string | null>(null);

  // Auto-clear chat when switching assistants
  useEffect(() => {
    if (activeAssistant && prevAssistantRef.current !== null && prevAssistantRef.current !== activeAssistant.id) {
      clearChat();
    }
    if (activeAssistant) {
      prevAssistantRef.current = activeAssistant.id;
    }
  }, [activeAssistant, clearChat]);

  // Session management
  useEffect(() => {
    // Set up auth state listener
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsCheckingAuth(false);
      if (!session) {
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
    navigate("/auth");
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return <div className="flex h-screen items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent mb-4">
            <Sparkles className="h-6 w-6 text-white animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>;
  }

  // If no session after check, don't render (will redirect)
  if (!session || !user) {
    return null;
  }
  return <div className="flex h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-semibold">openai Assistants
          </h1>
          </div>
          <div className="flex items-center gap-2">
            <AssistantSelector />
            <Button variant="outline" size="icon" onClick={clearChat} disabled={messages.length === 0}>
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="container mx-auto max-w-4xl">
            {messages.length === 0 ? <div className="flex h-full min-h-[calc(100vh-200px)] items-center justify-center">
                <div className="text-center space-y-4 p-8">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
                    <Sparkles className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-semibold">Välkommen!</h2>
                  <p className="text-muted-foreground max-w-md">
                    {activeAssistant ? `Börja chatta med ${activeAssistant.name} genom att skriva ett meddelande nedan.` : "Laddar assistenter..."}
                  </p>
                  {activeAssistant}
                </div>
              </div> : <div className="divide-y">
                {messages.map((message, index) => <ChatMessage key={index} role={message.role} content={message.content} />)}
                {isLoading && <div className="p-6 animate-pulse">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                      </div>
                    </div>
                  </div>}
              </div>}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t backdrop-blur-sm py-[50px] rounded-none bg-[#525244]/0">
        <div className="container mx-auto max-w-4xl p-4">
          <ChatInput onSendMessage={sendMessage} disabled={isLoading || !activeAssistant} />
        </div>
      </div>
    </div>;
};
export default Index;