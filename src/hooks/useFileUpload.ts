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

      // Hämta publik URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(data.path);

      setUploadProgress(100);

      toast({
        title: "Fil uppladdad",
        description: `${file.name} har laddats upp.`,
      });

      return {
        name: file.name,
        url: publicUrl,
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
