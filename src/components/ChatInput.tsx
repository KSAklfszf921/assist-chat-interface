import { useState, useRef } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload, UploadedFile } from "@/hooks/useFileUpload";
import { FileAttachment } from "@/components/FileAttachment";

interface ChatInputProps {
  onSendMessage: (message: string, files?: UploadedFile[]) => void;
  disabled?: boolean;
}
export const ChatInput = ({
  onSendMessage,
  disabled
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading } = useFileUpload();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && !uploading) {
      onSendMessage(message, attachedFiles.length > 0 ? attachedFiles : undefined);
      setMessage("");
      setAttachedFiles([]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (attachedFiles.length + files.length > 5) {
      alert("Max 5 filer per meddelande");
      return;
    }

    for (const file of files) {
      const uploaded = await uploadFile(file);
      if (uploaded) {
        setAttachedFiles(prev => [...prev, uploaded]);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };
  return (
    <div className="space-y-2">
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachedFiles.map((file, index) => (
            <FileAttachment
              key={index}
              name={file.name}
              size={file.size}
              type={file.type}
              onRemove={() => handleRemoveFile(index)}
              showRemove={!disabled && !uploading}
            />
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        <Textarea 
          value={message} 
          onChange={e => setMessage(e.target.value)} 
          onKeyDown={handleKeyDown} 
          placeholder="Skriv ditt meddelande här..." 
          disabled={disabled || uploading} 
          className="min-h-[60px] pr-24 resize-none mx-0 px-[20px] py-[50px]" 
        />
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.js,.py,.java,.html,.css"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={disabled || uploading || attachedFiles.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 w-8"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button 
            type="submit" 
            size="icon" 
            disabled={!message.trim() || disabled || uploading} 
            className="h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};