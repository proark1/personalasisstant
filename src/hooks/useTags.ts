import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: Date;
}

export interface TaskTag {
  taskId: string;
  tagId: string;
}

export function useTags(userId?: string) {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [taskTags, setTaskTags] = useState<TaskTag[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all tags
  const fetchTags = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      return;
    }

    setTags(data.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      userId: t.user_id,
      createdAt: new Date(t.created_at),
    })));
  }, [userId]);

  // Fetch all task-tag associations
  const fetchTaskTags = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('task_tags')
      .select('task_id, tag_id');

    if (error) {
      console.error('Error fetching task tags:', error);
      return;
    }

    setTaskTags(data.map(tt => ({
      taskId: tt.task_id,
      tagId: tt.tag_id,
    })));
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchTags(), fetchTaskTags()]);
      setLoading(false);
    };
    loadData();
  }, [fetchTags, fetchTaskTags]);

  // Create a new tag
  const createTag = useCallback(async (name: string, color: string = '#3b82f6') => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('tags')
      .insert({ user_id: userId, name: name.toLowerCase().trim(), color })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        toast({
          variant: 'destructive',
          title: 'Tag exists',
          description: 'A tag with that name already exists',
        });
      } else {
        console.error('Error creating tag:', error);
      }
      return null;
    }

    const newTag: Tag = {
      id: data.id,
      name: data.name,
      color: data.color,
      userId: data.user_id,
      createdAt: new Date(data.created_at),
    };

    setTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
    return newTag;
  }, [userId, toast]);

  // Delete a tag
  const deleteTag = useCallback(async (tagId: string) => {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      console.error('Error deleting tag:', error);
      return false;
    }

    setTags(prev => prev.filter(t => t.id !== tagId));
    setTaskTags(prev => prev.filter(tt => tt.tagId !== tagId));
    return true;
  }, []);

  // Add tag to task
  const addTagToTask = useCallback(async (taskId: string, tagId: string) => {
    const { error } = await supabase
      .from('task_tags')
      .insert({ task_id: taskId, tag_id: tagId });

    if (error) {
      if (error.code === '23505') return true; // Already exists, that's fine
      console.error('Error adding tag to task:', error);
      return false;
    }

    setTaskTags(prev => [...prev, { taskId, tagId }]);
    return true;
  }, []);

  // Remove tag from task
  const removeTagFromTask = useCallback(async (taskId: string, tagId: string) => {
    const { error } = await supabase
      .from('task_tags')
      .delete()
      .eq('task_id', taskId)
      .eq('tag_id', tagId);

    if (error) {
      console.error('Error removing tag from task:', error);
      return false;
    }

    setTaskTags(prev => prev.filter(tt => !(tt.taskId === taskId && tt.tagId === tagId)));
    return true;
  }, []);

  // Get tags for a specific task
  const getTaskTags = useCallback((taskId: string): Tag[] => {
    const tagIds = taskTags.filter(tt => tt.taskId === taskId).map(tt => tt.tagId);
    return tags.filter(t => tagIds.includes(t.id));
  }, [tags, taskTags]);

  // Get tasks for a specific tag
  const getTasksWithTag = useCallback((tagId: string): string[] => {
    return taskTags.filter(tt => tt.tagId === tagId).map(tt => tt.taskId);
  }, [taskTags]);

  return {
    tags,
    taskTags,
    loading,
    createTag,
    deleteTag,
    addTagToTask,
    removeTagFromTask,
    getTaskTags,
    getTasksWithTag,
    refetch: () => Promise.all([fetchTags(), fetchTaskTags()]),
  };
}
