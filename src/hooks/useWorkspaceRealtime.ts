import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWorkspaceId } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';

// Subscribes to every mutation on tasks / events / notes / task_comments
// scoped to the currently active workspace and surfaces a compact toast
// whenever a *teammate* (not the local user) is the actor. Also broadcasts
// a DOM event so pages that want to hard-refresh can listen cheaply.
export function useWorkspaceRealtime() {
  const { user } = useAuth();
  const workspaceId = useActiveWorkspaceId();

  useEffect(() => {
    if (!workspaceId || !user?.id) return;

    const notify = (kind: string, event: 'INSERT' | 'UPDATE' | 'DELETE', newRow: Record<string, unknown>, oldRow: Record<string, unknown>) => {
      // Only surface events another user caused. Our own create/update/delete
      // already produced its own UI feedback. The migration sets
      // REPLICA IDENTITY FULL on these tables so `oldRow` carries user_id /
      // author_id even on DELETE — otherwise the default (primary-key only)
      // would drop the actor and every self-delete would also toast.
      const row = newRow || oldRow;
      const actor = (row?.user_id as string | undefined) || (row?.author_id as string | undefined);
      if (actor && actor === user.id) return;
      const title = row?.title || row?.body || kind;
      const label =
        event === 'INSERT' ? 'added' :
        event === 'UPDATE' ? 'updated' :
        'removed';
      toast.message(`Workspace: ${kind} ${label}`, {
        description: typeof title === 'string' ? title.slice(0, 120) : undefined,
        duration: 3500,
      });
      try {
        window.dispatchEvent(new CustomEvent('workspace:changed', {
          detail: { kind, event, row },
        }));
      } catch { /* non-browser env */ }
    };

    const channel = supabase
      .channel(`ws-rt-${workspaceId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => notify('task', payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', payload.new as Record<string, unknown>, payload.old as Record<string, unknown>))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => notify('event', payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', payload.new as Record<string, unknown>, payload.old as Record<string, unknown>))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => notify('note', payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE', payload.new as Record<string, unknown>, payload.old as Record<string, unknown>))
      .on('postgres_changes',
        // task_comments.workspace_id is denormalized via trigger so we can
        // subscribe with a server-side filter instead of receiving every
        // workspace's comments and filtering client-side.
        { event: 'INSERT', schema: 'public', table: 'task_comments', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => notify('comment', 'INSERT', payload.new as Record<string, unknown>, payload.old as Record<string, unknown>))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [workspaceId, user?.id]);
}
