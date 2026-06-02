import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuthContext } from '@/contexts/AuthContext';

// "Personal" is the implicit namespace — no workspace_id on the row. We
// represent it in the UI with this sentinel so the switcher can render
// "Personal" alongside the user's actual workspaces.
export const PERSONAL_WORKSPACE_ID = 'personal';

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  icon: string | null;
  owner_id: string;
  archived: boolean;
  updated_at: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  display_name: string | null;
  joined_at: string | null;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;                 // last fetchWorkspaces failure, if any
  activeWorkspaceId: string | null;     // null == Personal
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];           // members of the ACTIVE workspace (empty for Personal)
  setActiveWorkspaceId: (id: string | null) => void;
  createWorkspace: (input: { name: string; description?: string; icon?: string }) => Promise<Workspace | null>;
  joinByCode: (code: string) => Promise<{ ok: boolean; error?: string; workspace?: Workspace }>;
  refresh: () => Promise<void>;
  refreshMembers: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const ACTIVE_KEY = 'darai.active_workspace_id';

function readStoredActive(): string | null {
  try {
    const v = window.localStorage.getItem(ACTIVE_KEY);
    return v && v !== PERSONAL_WORKSPACE_ID ? v : null;
  } catch { return null; }
}

function writeStoredActive(id: string | null) {
  try {
    if (id) window.localStorage.setItem(ACTIVE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_KEY);
  } catch { /* ignore */ }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => readStoredActive());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setError(null);
      setLoading(false);
      return;
    }
    const { data, error: dbError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: true });
    if (dbError) {
      // Keep the previous workspace list visible. Wiping it on a transient
      // failure was triggering the "fall back to Personal" effect below and
      // silently demoting users out of workspaces they actually belonged to.
      console.error('fetchWorkspaces failed', dbError);
      setError(dbError.message || 'Failed to load workspaces');
    } else {
      setWorkspaces((data || []) as Workspace[]);
      setError(null);
    }
    setLoading(false);
  }, [user]);

  const fetchMembers = useCallback(async (wsId: string | null) => {
    if (!wsId) { setMembers([]); return; }
    const { data, error: dbError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, display_name, joined_at')
      .eq('workspace_id', wsId);
    if (dbError) {
      // Same reasoning as fetchWorkspaces: don't blow away the cached
      // member list on a transient failure.
      console.error('fetchMembers failed', dbError);
    } else {
      setMembers((data || []) as WorkspaceMember[]);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchMembers(activeWorkspaceId); }, [activeWorkspaceId, fetchMembers]);

  // If the active id points at a workspace the user can no longer see
  // (removed from the team, archived, deleted) fall back to Personal.
  // Wait for `loading` and require a successful fetch (`!error`) so a
  // transient network failure can't silently demote the user.
  useEffect(() => {
    if (loading) return;
    if (error) return;
    if (!activeWorkspaceId) return;
    if (!workspaces.find((w) => w.id === activeWorkspaceId)) {
      setActiveWorkspaceIdState(null);
      writeStoredActive(null);
    }
  }, [loading, error, activeWorkspaceId, workspaces]);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
    writeStoredActive(id);
  }, []);

  const activeWorkspace = useMemo(
    () => (activeWorkspaceId ? workspaces.find((w) => w.id === activeWorkspaceId) || null : null),
    [activeWorkspaceId, workspaces],
  );

  const createWorkspace = useCallback(async ({ name, description, icon }: { name: string; description?: string; icon?: string }) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('workspaces')
      .insert({ name: name.trim(), description: description ?? null, icon: icon ?? null, owner_id: user.id })
      .select('*')
      .single();
    if (error || !data) {
      console.error('createWorkspace failed', error);
      return null;
    }
    await fetchWorkspaces();
    setActiveWorkspaceId((data as Workspace).id);
    return data as Workspace;
  }, [user, fetchWorkspaces, setActiveWorkspaceId]);

  const joinByCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return { ok: false, error: 'Empty code' };
    const { data, error } = await supabase.functions.invoke('workspace-join', {
      body: { code: trimmed },
    });
    if (error) {
      console.error('joinByCode failed', error);
      return { ok: false, error: await describeEdgeError(error, 'Could not join') };
    }
    const result = data as { ok?: boolean; workspace_id?: string; workspace?: Workspace; error?: string };
    if (!result?.ok || !result.workspace_id) {
      return { ok: false, error: result?.error || 'Code invalid or expired' };
    }
    // Use the workspace row the server returned directly — the in-memory
    // `workspaces` list from a just-finished fetch wouldn't contain it yet
    // because state updates are async. Merge it in optimistically so the
    // switcher can show the name immediately.
    if (result.workspace) {
      setWorkspaces((prev) => (prev.find((w) => w.id === result.workspace!.id) ? prev : [...prev, result.workspace!]));
    }
    // Still kick a refresh so memberships and any other side effects land.
    fetchWorkspaces();
    setActiveWorkspaceId(result.workspace_id);
    return { ok: true, workspace: result.workspace };
  }, [fetchWorkspaces, setActiveWorkspaceId]);

  const refreshMembers = useCallback(
    () => fetchMembers(activeWorkspaceId),
    [fetchMembers, activeWorkspaceId],
  );

  const value = useMemo(
    () => ({
      workspaces,
      loading,
      error,
      activeWorkspaceId,
      activeWorkspace,
      members,
      setActiveWorkspaceId,
      createWorkspace,
      joinByCode,
      refresh: fetchWorkspaces,
      refreshMembers,
    }),
    [
      workspaces,
      loading,
      error,
      activeWorkspaceId,
      activeWorkspace,
      members,
      setActiveWorkspaceId,
      createWorkspace,
      joinByCode,
      fetchWorkspaces,
      refreshMembers,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

// Convenience: the id the hooks should pass to queries. Null means Personal.
// eslint-disable-next-line react-refresh/only-export-components
export function useActiveWorkspaceId(): string | null {
  return useWorkspace().activeWorkspaceId;
}
