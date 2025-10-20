import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { FileAttachment } from "@/components/FileAttachment";

interface FileAttachmentData {
  name: string;
  size: number;
  type: string;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  attachments?: FileAttachmentData[];
}

export const ChatMessage = ({ role, content, attachments }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-4 p-6 animate-fade-in",
        isUser ? "bg-muted/30" : "bg-card"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-primary to-accent"
        )}
      >
        {isUser ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden">
        <p className="text-sm font-semibold">
          {isUser ? "Du" : "Assistent"}
        </p>
        
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((file, index) => (
              <FileAttachment
                key={index}
                name={file.name}
                size={file.size}
                type={file.type}
              />
            ))}
          </div>
        )}
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>
      </div>
    </div>
  );
};
