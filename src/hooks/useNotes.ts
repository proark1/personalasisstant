import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useActiveWorkspaceId } from '@/contexts/WorkspaceContext';

export interface LinkedItem {
  type: 'task' | 'project' | 'contact' | 'contract' | 'event';
  id: string;
  title: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  linkedItems: LinkedItem[];
  tags: string[];
  isPinned: boolean;
  trashed: boolean;
  trashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function useNotes(userId: string | undefined) {
  const workspaceId = useActiveWorkspaceId();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const base = supabase
        .from('notes')
        .select('*')
        .eq('trashed', false)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      const scoped = workspaceId
        ? base.eq('workspace_id', workspaceId)
        : base.eq('user_id', userId).is('workspace_id', null);
      const { data, error } = await scoped;

      if (error) throw error;

      const mapped: Note[] = (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        content: n.content,
        linkedItems: (n.linked_items as unknown as LinkedItem[]) || [],
        tags: n.tags || [],
        isPinned: n.is_pinned,
        trashed: n.trashed,
        trashedAt: n.trashed_at ? new Date(n.trashed_at) : null,
        createdAt: new Date(n.created_at),
        updatedAt: new Date(n.updated_at),
      }));

      setNotes(mapped);
    } catch (error) {
      console.error('[notes] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceId]);

  const createNote = useCallback(async (title: string = 'Untitled', content: string = '', tags: string[] = []) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          workspace_id: workspaceId,
          title,
          content,
          tags: tags.length > 0 ? tags : null,
        })
        .select()
        .single();

      if (error) throw error;

      const newNote: Note = {
        id: data.id,
        userId: data.user_id,
        title: data.title,
        content: data.content,
        linkedItems: [],
        tags: data.tags || [],
        isPinned: false,
        trashed: false,
        trashedAt: null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setNotes(prev => [newNote, ...prev]);
      return newNote;
    } catch (error) {
      console.error('[notes] Create error:', error);
      toast({
        title: 'Error',
        description: 'Could not create note.',
        variant: 'destructive',
      });
      return null;
    }
  }, [userId, workspaceId, toast]);

  const updateNote = useCallback(async (noteId: string, updates: Partial<Pick<Note, 'title' | 'content' | 'linkedItems' | 'tags' | 'isPinned'>>) => {
    try {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.linkedItems !== undefined) dbUpdates.linked_items = updates.linkedItems;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;

      const { error } = await supabase
        .from('notes')
        .update(dbUpdates as TablesUpdate<'notes'>)
        .eq('id', noteId);

      if (error) throw error;

      setNotes(prev => prev.map(n => 
        n.id === noteId 
          ? { ...n, ...updates, updatedAt: new Date() }
          : n
      ));
    } catch (error) {
      console.error('[notes] Update error:', error);
      toast({
        title: 'Error',
        description: 'Could not update note.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const deleteNote = useCallback(async (noteId: string, permanent: boolean = false) => {
    try {
      if (permanent) {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', noteId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notes')
          .update({ trashed: true, trashed_at: new Date().toISOString() })
          .eq('id', noteId);
        if (error) throw error;
      }

      setNotes(prev => prev.filter(n => n.id !== noteId));

      toast({
        title: permanent ? 'Note Deleted' : 'Note Trashed',
        description: permanent 
          ? 'The note has been permanently deleted.'
          : 'The note has been moved to trash.',
      });
    } catch (error) {
      console.error('[notes] Delete error:', error);
      toast({
        title: 'Error',
        description: 'Could not delete note.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const searchNotes = useCallback(async (query: string) => {
    if (!userId || !query.trim()) {
      return fetchNotes();
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('trashed', false)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: Note[] = (data || []).map(n => ({
        id: n.id,
        userId: n.user_id,
        title: n.title,
        content: n.content,
        linkedItems: (n.linked_items as unknown as LinkedItem[]) || [],
        tags: n.tags || [],
        isPinned: n.is_pinned,
        trashed: n.trashed,
        trashedAt: n.trashed_at ? new Date(n.trashed_at) : null,
        createdAt: new Date(n.created_at),
        updatedAt: new Date(n.updated_at),
      }));

      setNotes(mapped);
    } catch (error) {
      console.error('[notes] Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchNotes]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return {
    notes,
    loading,
    refetch: fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
  };
}
