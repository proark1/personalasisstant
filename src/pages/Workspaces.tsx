import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Trash2, Copy, Check, LogIn, Link2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace, type WorkspaceMember } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function WorkspacesPage() {
  const { user } = useAuth();
  const { workspaces, activeWorkspace, activeWorkspaceId, setActiveWorkspaceId, createWorkspace, joinByCode, refresh: _refresh, members, refreshMembers } = useWorkspace();

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState('🚀');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  const [inviteCodes, setInviteCodes] = useState<{ id: string; code: string; role: string; uses: number; max_uses: number | null; expires_at: string | null; revoked_at: string | null }[]>([]);
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [copied, setCopied] = useState<string | null>(null);

  const isOwnerOrAdmin = activeWorkspace && members.find((m) => m.user_id === user?.id && ['owner', 'admin'].includes(m.role));

  // Reload invite codes whenever the active workspace changes.
  useEffect(() => {
    (async () => {
      if (!activeWorkspaceId) { setInviteCodes([]); return; }
      const { data, error } = await supabase
        .from('workspace_invite_codes')
        .select('id, code, role, uses, max_uses, expires_at, revoked_at')
        .eq('workspace_id', activeWorkspaceId)
        .order('created_at', { ascending: false });
      if (error) { console.error(error); return; }
      setInviteCodes(data || []);
    })();
  }, [activeWorkspaceId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const ws = await createWorkspace({ name: newName.trim(), description: newDescription.trim() || undefined, icon: newIcon.trim() || undefined });
      if (ws) {
        toast.success(`Created workspace "${ws.name}"`);
        setNewName(''); setNewDescription(''); setNewIcon('🚀');
      } else {
        toast.error('Could not create workspace');
      }
    } finally { setBusy(false); }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const res = await joinByCode(joinCode.trim());
      if (res.ok) { toast.success('Joined workspace'); setJoinCode(''); }
      else toast.error(res.error || 'Could not join');
    } finally { setBusy(false); }
  };

  const generateInvite = async () => {
    if (!activeWorkspaceId || !user) return;
    // Short, URL-safe, easy to read: 10 chars of base32-alike
    const code = Array.from({ length: 10 }, () =>
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
    ).join('');
    const { error } = await supabase.from('workspace_invite_codes').insert({
      workspace_id: activeWorkspaceId, code, role: inviteRole, created_by: user.id,
    });
    if (error) { toast.error(error.message); return; }
    const { data } = await supabase
      .from('workspace_invite_codes')
      .select('id, code, role, uses, max_uses, expires_at, revoked_at')
      .eq('workspace_id', activeWorkspaceId)
      .order('created_at', { ascending: false });
    setInviteCodes(data || []);
    toast.success('Invite code created');
  };

  const revokeInvite = async (id: string) => {
    await supabase.from('workspace_invite_codes').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    setInviteCodes((prev) => prev.map((c) => c.id === id ? { ...c, revoked_at: new Date().toISOString() } : c));
  };

  const removeMember = async (m: WorkspaceMember) => {
    if (!activeWorkspaceId) return;
    const { error } = await supabase.from('workspace_members')
      .delete().eq('workspace_id', activeWorkspaceId).eq('user_id', m.user_id);
    if (error) toast.error(error.message);
    else { toast.success('Removed member'); refreshMembers(); }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Your personal space is always available. Create a workspace to collaborate with a team.
          </p>
        </div>
      </div>

      {/* Create / Join */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" /> Start a new workspace
            </CardTitle>
            <CardDescription>Become the owner and invite teammates with a code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                className="w-16 text-center text-xl"
                value={newIcon}
                onChange={(e) => setNewIcon(e.target.value.slice(0, 4))}
                maxLength={4}
              />
              <Input
                placeholder="Acme Inc."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Textarea
              placeholder="What's this workspace for? (optional)"
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={busy || !newName.trim()} className="w-full">
              Create workspace
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="w-4 h-4" /> Join a workspace
            </CardTitle>
            <CardDescription>Ask an admin for an invite code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="font-mono tracking-wider"
            />
            <Button onClick={handleJoin} disabled={busy || !joinCode.trim()} variant="outline" className="w-full">
              Join
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* My workspaces */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My workspaces</CardTitle>
          <CardDescription>Click to switch.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <button
            type="button"
            onClick={() => setActiveWorkspaceId(null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${activeWorkspaceId === null ? 'bg-accent' : 'hover:bg-accent/50'}`}
          >
            <span className="w-6 text-center">👤</span>
            <span className="flex-1">Personal</span>
            {activeWorkspaceId === null && <Badge variant="secondary" className="text-xs">Active</Badge>}
          </button>
          {workspaces.map((ws) => (
            <button
              type="button"
              key={ws.id}
              onClick={() => setActiveWorkspaceId(ws.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${activeWorkspaceId === ws.id ? 'bg-accent' : 'hover:bg-accent/50'}`}
            >
              <span className="w-6 text-center">{ws.icon || '📁'}</span>
              <span className="flex-1 truncate">
                <span className="block font-medium">{ws.name}</span>
                {ws.description && <span className="block text-xs text-muted-foreground truncate">{ws.description}</span>}
              </span>
              {activeWorkspaceId === ws.id && <Badge variant="secondary" className="text-xs">Active</Badge>}
            </button>
          ))}
          {workspaces.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-2">You're not in any workspaces yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Members + invite codes for active workspace */}
      {activeWorkspace && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" /> {activeWorkspace.name} — members
              </CardTitle>
              <CardDescription>{members.length} member{members.length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/50">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {(m.display_name || m.user_id).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.display_name || m.user_id}
                      {m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.role}</div>
                  </div>
                  {isOwnerOrAdmin && m.user_id !== activeWorkspace.owner_id && m.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeMember(m)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {isOwnerOrAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4" /> Invite codes
                </CardTitle>
                <CardDescription>Share these with people you want to add.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                    className="text-sm border rounded-md px-2 h-9 bg-background"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button size="sm" onClick={generateInvite}>Generate code</Button>
                </div>
                <div className="space-y-1">
                  {inviteCodes.filter((c) => !c.revoked_at).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 border rounded-md px-3 py-2">
                      <code className="font-mono text-sm flex-1 tracking-wider">{c.code}</code>
                      <Badge variant="outline" className="text-xs">{c.role}</Badge>
                      <span className="text-xs text-muted-foreground">{c.uses}/{c.max_uses ?? '∞'}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          navigator.clipboard.writeText(c.code);
                          setCopied(c.id);
                          setTimeout(() => setCopied(null), 1500);
                        }}
                      >
                        {copied === c.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => revokeInvite(c.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  {inviteCodes.filter((c) => !c.revoked_at).length === 0 && (
                    <p className="text-sm text-muted-foreground">No active codes.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
