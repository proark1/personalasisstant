import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface FamilyDocument {
  id: string;
  user_id: string;
  family_member_id: string | null;
  name: string;
  description: string | null;
  category: string;
  file_url: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  expiry_date: string | null;
  is_sensitive: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export function useFamilyDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<FamilyDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocuments = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('family_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const uploadDocument = async (
    file: File,
    metadata: {
      name: string;
      description?: string;
      category: string;
      family_member_id?: string;
      expiry_date?: string;
      is_sensitive?: boolean;
      tags?: string[];
    }
  ) => {
    if (!user?.id) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('family-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('family-documents')
        .getPublicUrl(fileName);

      // Create signed URL for private bucket
      const { data: signedData } = await supabase.storage
        .from('family-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      const fileUrl = signedData?.signedUrl || urlData.publicUrl;

      // Save metadata to database
      const { data, error } = await supabase
        .from('family_documents')
        .insert({
          user_id: user.id,
          name: metadata.name,
          description: metadata.description || null,
          category: metadata.category,
          family_member_id: metadata.family_member_id || null,
          file_url: fileUrl,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          expiry_date: metadata.expiry_date || null,
          is_sensitive: metadata.is_sensitive || false,
          tags: metadata.tags || [],
        })
        .select()
        .single();

      if (error) throw error;
      
      setDocuments(prev => [data, ...prev]);
      toast.success('Document uploaded');
      return data;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
      return null;
    }
  };

  const updateDocument = async (id: string, updates: Partial<FamilyDocument>) => {
    try {
      const { data, error } = await supabase
        .from('family_documents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setDocuments(prev => prev.map(d => d.id === id ? data : d));
      toast.success('Document updated');
      return data;
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Failed to update document');
      return null;
    }
  };

  const deleteDocument = async (id: string) => {
    const doc = documents.find(d => d.id === id);
    if (!doc) return;

    try {
      // Delete from storage
      await supabase.storage
        .from('family-documents')
        .remove([doc.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('family_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== id));
      toast.success('Document deleted');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    }
  };

  const getSignedUrl = async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('family-documents')
      .createSignedUrl(filePath, 60 * 60); // 1 hour

    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  useEffect(() => {
    fetchDocuments();
  }, [user?.id]);

  const getDocumentsByCategory = (category: string) => 
    documents.filter(d => d.category === category);

  const getDocumentsByMember = (memberId: string) =>
    documents.filter(d => d.family_member_id === memberId);

  const getExpiringDocuments = (daysAhead: number = 30) => {
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
    return documents.filter(d => 
      d.expiry_date && new Date(d.expiry_date) <= futureDate && new Date(d.expiry_date) >= new Date()
    );
  };

  return {
    documents,
    isLoading,
    uploadDocument,
    updateDocument,
    deleteDocument,
    getSignedUrl,
    getDocumentsByCategory,
    getDocumentsByMember,
    getExpiringDocuments,
    refetch: fetchDocuments,
  };
}
