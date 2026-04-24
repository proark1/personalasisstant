import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project } from '@/types/flux';
import { useActiveWorkspaceId } from '@/contexts/WorkspaceContext';

interface DbProject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export function useProjects(userId: string | undefined) {
  const workspaceId = useActiveWorkspaceId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const dbProjectToProject = (dbProject: DbProject): Project => ({
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description || undefined,
    color: dbProject.color,
    isArchived: dbProject.is_archived,
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
  });

  const fetchProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Active workspace → all projects in that workspace the user can see.
    // Personal (workspaceId === null) → only the user's own personal projects.
    const query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    const scoped = workspaceId
      ? query.eq('workspace_id', workspaceId)
      : query.eq('user_id', userId).is('workspace_id', null);
    const { data } = await scoped;

    if (data) {
      setProjects(data.map(dbProjectToProject));
    }
    setLoading(false);
  }, [userId, workspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = useCallback(async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project | null> => {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        name: project.name,
        description: project.description,
        color: project.color,
        is_archived: project.isArchived,
      })
      .select()
      .single();

    if (data && !error) {
      const newProject = dbProjectToProject(data);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    }
    return null;
  }, [userId, workspaceId]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.isArchived !== undefined) dbUpdates.is_archived = updates.isArchived;

    const { error } = await supabase
      .from('projects')
      .update(dbUpdates)
      .eq('id', id);

    if (!error) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const getProjectProgress = useCallback((projectId: string, tasks: { projectId?: string; completed: boolean }[]) => {
    const projectTasks = tasks.filter(t => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completed = projectTasks.filter(t => t.completed).length;
    return Math.round((completed / projectTasks.length) * 100);
  }, []);

  return {
    projects,
    loading,
    addProject,
    updateProject,
    deleteProject,
    getProjectProgress,
    refetch: fetchProjects,
  };
}
