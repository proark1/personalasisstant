import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Project } from "@/types/flux";

interface SharedProjectMember {
  id: string;
  projectId: string;
  userId: string;
  ownerId: string;
  role: "member" | "admin";
  createdAt: Date;
  userEmail?: string;
  userDisplayName?: string;
}

export function useSharedProjects(userId: string | undefined) {
  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);
  const [projectMembers, setProjectMembers] = useState<Record<string, SharedProjectMember[]>>({});
  const [loading, setLoading] = useState(false);

  // Fetch projects shared with the current user
  const fetchSharedProjects = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase
      .from("shared_project_members")
      .select(
        `
        *,
        project:projects (*)
      `,
      )
      .eq("user_id", userId);

    if (data) {
      const projects = data
        .filter((d) => d.project)
        .map((d) => ({
          id: d.project.id,
          name: d.project.name,
          description: d.project.description || undefined,
          color: d.project.color,
          isArchived: d.project.is_archived,
          createdAt: new Date(d.project.created_at),
          updatedAt: new Date(d.project.updated_at),
        }));
      setSharedProjects(projects);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSharedProjects();
  }, [fetchSharedProjects]);

  // Share a project with another user
  const shareProject = useCallback(
    async (
      projectId: string,
      shareWithEmail: string,
      role: "member" | "admin" = "member",
    ): Promise<{ error: string | null }> => {
      if (!userId) return { error: "Not authenticated" };

      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .ilike("email", shareWithEmail)
        .single();

      if (profileError || !profile) {
        return { error: "User not found with that email" };
      }

      if (profile.user_id === userId) {
        return { error: "Cannot share with yourself" };
      }

      // Check if already shared
      const { data: existing } = await supabase
        .from("shared_project_members")
        .select("id")
        .eq("project_id", projectId)
        .eq("user_id", profile.user_id)
        .single();

      if (existing) {
        return { error: "Already shared with this user" };
      }

      // Create share
      const { error: shareError } = await supabase.from("shared_project_members").insert({
        project_id: projectId,
        user_id: profile.user_id,
        owner_id: userId,
        role,
      });

      if (shareError) {
        return { error: "Failed to share project" };
      }

      return { error: null };
    },
    [userId],
  );

  // Get members of a project
  const getProjectMembers = useCallback(async (projectId: string) => {
    const { data } = await supabase
      .from("shared_project_members")
      .select(
        `
        *,
        profile:profiles!shared_project_members_user_id_fkey (
          email,
          display_name
        )
      `,
      )
      .eq("project_id", projectId);

    if (data) {
      const members: SharedProjectMember[] = data.map((d) => {
        const row = d as typeof d & { profile?: { email?: string; display_name?: string } };
        return {
          id: d.id,
          projectId: d.project_id,
          userId: d.user_id,
          ownerId: d.owner_id,
          role: d.role as "member" | "admin",
          createdAt: new Date(d.created_at),
          userEmail: row.profile?.email,
          userDisplayName: row.profile?.display_name,
        };
      });

      setProjectMembers((prev) => ({ ...prev, [projectId]: members }));
      return members;
    }
    return [];
  }, []);

  // Remove a member from a project
  const removeProjectMember = useCallback(
    async (memberId: string) => {
      const { error } = await supabase.from("shared_project_members").delete().eq("id", memberId);

      if (!error) {
        // Refresh the members
        Object.keys(projectMembers).forEach((projectId) => {
          getProjectMembers(projectId);
        });
      }

      return { error: error?.message || null };
    },
    [projectMembers, getProjectMembers],
  );

  // Set up realtime subscription for shared projects
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("shared-projects-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shared_project_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchSharedProjects();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "shared_project_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchSharedProjects();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSharedProjects]);

  return {
    sharedProjects,
    projectMembers,
    loading,
    shareProject,
    getProjectMembers,
    removeProjectMember,
    refetch: fetchSharedProjects,
  };
}
