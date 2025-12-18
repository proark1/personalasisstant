import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export function useChatAttachments(userId: string) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const uploadFile = useCallback(async (file: File): Promise<ChatAttachment | null> => {
    if (!userId) return null;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

      return {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload the file. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [userId, toast]);

  const uploadMultipleFiles = useCallback(async (files: FileList): Promise<ChatAttachment[]> => {
    const results: ChatAttachment[] = [];
    
    for (const file of Array.from(files)) {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than 10MB`,
          variant: 'destructive',
        });
        continue;
      }
      
      const attachment = await uploadFile(file);
      if (attachment) {
        results.push(attachment);
      }
    }
    
    return results;
  }, [uploadFile, toast]);

  return {
    uploading,
    uploadFile,
    uploadMultipleFiles,
  };
}
