import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface UploadedFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'text/javascript',
  'application/javascript',
  'text/x-python',
  'text/x-java',
  'text/html',
  'text/css',
];

  // Validate file content by checking magic numbers (file signatures)
  const validateFileContent = async (file: File): Promise<boolean> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer).subarray(0, 8);
    
    // Define magic numbers for allowed file types
    const signatures: Record<string, number[]> = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/jpg': [0xFF, 0xD8, 0xFF],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (at 0), then WEBP at offset 8
      'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF8
      // Text-based files don't have fixed signatures, skip validation
      'text/plain': [],
      'text/csv': [],
      'application/json': [],
      'text/javascript': [],
      'application/javascript': [],
      'text/x-python': [],
      'text/x-java': [],
      'text/html': [],
      'text/css': [],
    };
    
    const signature = signatures[file.type];
    if (!signature) return false; // Unknown type
    if (signature.length === 0) return true; // Text files - no signature check needed
    
    // Special case for WEBP: check RIFF at start and WEBP at offset 8
    if (file.type === 'image/webp') {
      const webpBytes = new Uint8Array(buffer).subarray(0, 12);
      return signature.every((byte, i) => webpBytes[i] === byte) && 
             webpBytes[8] === 0x57 && webpBytes[9] === 0x45 && 
             webpBytes[10] === 0x42 && webpBytes[11] === 0x50;
    }
    
    // Verify file starts with expected bytes
    return signature.every((byte, i) => bytes[i] === byte);
  };

export const useFileUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    // Validering
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "Filen är för stor",
        description: `Max filstorlek är 10 MB. Din fil är ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
        variant: "destructive",
      });
      return null;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Filtyp stöds inte",
        description: "Tillåtna filtyper: PDF, TXT, CSV, JSON, PNG, JPG, WEBP, GIF, JS, PY, JAVA, HTML, CSS",
        variant: "destructive",
      });
      return null;
    }

    // Validate file content matches declared MIME type
    const isValidContent = await validateFileContent(file);
    if (!isValidContent) {
      toast({
        title: "Ogiltig fil",
        description: "Filens innehåll matchar inte den angivna filtypen.",
        variant: "destructive",
      });
      return null;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Inte inloggad");
      }

      // Skapa unikt filnamn med timestamp
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

      // Ladda upp till Supabase Storage
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      setUploadProgress(100);

      toast({
        title: "Fil uppladdad",
        description: `${file.name} har laddats upp.`,
      });

      return {
        name: file.name,
        url: data.path, // Store path instead of URL for security
        type: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Uppladdning misslyckades",
        description: error instanceof Error ? error.message : "Ett okänt fel uppstod",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    uploadFile,
    uploading,
    uploadProgress,
  };
};
