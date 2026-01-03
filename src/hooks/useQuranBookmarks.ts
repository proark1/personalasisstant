import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface QuranBookmark {
  id: string;
  user_id: string;
  surah_number: number;
  surah_name: string;
  surah_english_name: string;
  ayah_number: number;
  ayah_text: string;
  note: string | null;
  created_at: string;
}

export function useQuranBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quran_bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookmarks(data || []);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const addBookmark = async (
    surahNumber: number,
    surahName: string,
    surahEnglishName: string,
    ayahNumber: number,
    ayahText: string
  ) => {
    if (!user) {
      toast.error('Please log in to bookmark ayahs');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('quran_bookmarks')
        .insert({
          user_id: user.id,
          surah_number: surahNumber,
          surah_name: surahName,
          surah_english_name: surahEnglishName,
          ayah_number: ayahNumber,
          ayah_text: ayahText.substring(0, 500), // Limit text length
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('This ayah is already bookmarked');
          return null;
        }
        throw error;
      }

      setBookmarks(prev => [data, ...prev]);
      toast.success('Ayah bookmarked');
      return data;
    } catch (error) {
      console.error('Error adding bookmark:', error);
      toast.error('Failed to add bookmark');
      return null;
    }
  };

  const removeBookmark = async (bookmarkId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('quran_bookmarks')
        .delete()
        .eq('id', bookmarkId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
      toast.success('Bookmark removed');
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast.error('Failed to remove bookmark');
      return false;
    }
  };

  const removeBookmarkByAyah = async (surahNumber: number, ayahNumber: number) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('quran_bookmarks')
        .delete()
        .eq('user_id', user.id)
        .eq('surah_number', surahNumber)
        .eq('ayah_number', ayahNumber);

      if (error) throw error;

      setBookmarks(prev => prev.filter(
        b => !(b.surah_number === surahNumber && b.ayah_number === ayahNumber)
      ));
      toast.success('Bookmark removed');
      return true;
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast.error('Failed to remove bookmark');
      return false;
    }
  };

  const updateBookmarkNote = async (bookmarkId: string, note: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('quran_bookmarks')
        .update({ note })
        .eq('id', bookmarkId)
        .eq('user_id', user.id);

      if (error) throw error;

      setBookmarks(prev => prev.map(b => 
        b.id === bookmarkId ? { ...b, note } : b
      ));
      toast.success('Note updated');
      return true;
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
      return false;
    }
  };

  const isBookmarked = useCallback((surahNumber: number, ayahNumber: number) => {
    return bookmarks.some(
      b => b.surah_number === surahNumber && b.ayah_number === ayahNumber
    );
  }, [bookmarks]);

  const getBookmark = useCallback((surahNumber: number, ayahNumber: number) => {
    return bookmarks.find(
      b => b.surah_number === surahNumber && b.ayah_number === ayahNumber
    );
  }, [bookmarks]);

  return {
    bookmarks,
    loading,
    fetchBookmarks,
    addBookmark,
    removeBookmark,
    removeBookmarkByAyah,
    updateBookmarkNote,
    isBookmarked,
    getBookmark,
  };
}
