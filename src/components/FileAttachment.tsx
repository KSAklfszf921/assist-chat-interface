import { FileText, Image, FileCode, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileAttachmentProps {
  name: string;
  size: number;
  type: string;
  onRemove?: () => void;
  showRemove?: boolean;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf')) return FileText;
  if (type.includes('javascript') || type.includes('python') || type.includes('java')) return FileCode;
  return File;
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const FileAttachment = ({ name, size, type, onRemove, showRemove = false }: FileAttachmentProps) => {
  const Icon = getFileIcon(type);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>
      </div>
      {showRemove && onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
