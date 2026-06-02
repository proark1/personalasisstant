import { useEffect, useState } from 'react';
import { Send, Loader2, Check, Copy, Unlink, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TelegramLink {
  is_active: boolean;
  telegram_username: string | null;
  telegram_first_name: string | null;
  linked_at: string | null;
}

interface GroupLink {
  is_active: boolean;
  title: string | null;
  linked_at: string | null;
  partner_user_id: string | null;
}

export function TelegramConnectPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [group, setGroup] = useState<GroupLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingGroup, setGeneratingGroup] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [groupAddUrl, setGroupAddUrl] = useState<string | null>(null);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; telegram_username: string | null; display_name: string | null; status: string; role: string }>>([]);
  const [newUsername, setNewUsername] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  const fetchMembers = async () => {
    const { data, error: e } = await supabase.functions.invoke('telegram-link', { body: { action: 'family_members_list' } });
    if (!e && data?.members) setMembers(data.members);
  };

  const addMember = async () => {
    const uname = newUsername.replace(/^@/, '').trim();
    if (!uname) return;
    setMemberBusy(true);
    try {
      const { data, error: e } = await supabase.functions.invoke('telegram-link', { body: { action: 'family_member_add', username: uname } });
      if (e || data?.error) { toast({ title: 'Could not add member', description: data?.error || await describeEdgeError(e, 'Could not add member'), variant: 'destructive' }); }
      else { setMembers(data.members || []); setNewUsername(''); }
    } finally { setMemberBusy(false); }
  };

  const removeMember = async (id: string) => {
    setMemberBusy(true);
    try {
      const { data } = await supabase.functions.invoke('telegram-link', { body: { action: 'family_member_remove', id } });
      if (data?.members) setMembers(data.members);
    } finally { setMemberBusy(false); }
  };

  const fetchLink = async () => {
    if (!user) return;
    const [{ data: l }, { data: g }] = await Promise.all([
      supabase.from('telegram_links').select('is_active, telegram_username, telegram_first_name, linked_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('telegram_group_links').select('is_active, title, linked_at, partner_user_id').eq('owner_user_id', user.id).maybeSingle(),
    ]);
    setLink(l);
    setGroup(g);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLink(); }, [user?.id]);

  useEffect(() => { if (group?.is_active) fetchMembers(); }, [group?.is_active]);

  useEffect(() => {
    if ((!code && !groupCode) || (link?.is_active && group?.is_active)) return;
    // Poll less aggressively and pause while the tab is hidden.
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchLink();
    }, 8000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, groupCode, link?.is_active, group?.is_active]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', { body: { action: 'generate', scope: 'personal' } });
      if (error) throw error;
      if (!data || !data.code) {
        throw new Error('No link code returned from server');
      }
      setCode(data.code);
      setDeepLink(data.deepLink ?? null);
      if (data.botUsername) {
        setBotUsername(data.botUsername);
      }
      if (!data.deepLink) {
        setError(`Telegram connector is currently unreachable. Your code is ready — open @${data.botUsername ?? 'daraibot_bot'} manually and send: /start ${data.code}`);
      }
    } catch (e) {
      toast({ title: 'Could not generate code', description: await describeEdgeError(e, 'Could not generate link code'), variant: 'destructive' });
      setCode(null);
      setDeepLink(null);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateGroup = async () => {
    setGeneratingGroup(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', { body: { action: 'generate', scope: 'group' } });
      if (error) throw error;
      if (!data || !data.code) {
        throw new Error('No link code returned from server');
      }
      setGroupCode(data.code);
      setGroupAddUrl(data.addToGroupUrl ?? null);
    } catch (e) {
      toast({ title: 'Could not generate group code', description: await describeEdgeError(e, 'Could not generate group link code'), variant: 'destructive' });
      setGroupCode(null);
      setGroupAddUrl(null);
    } finally {
      setGeneratingGroup(false);
    }
  };

  const handleUnlink = async (scope: 'personal' | 'group') => {
    try {
      await supabase.functions.invoke('telegram-link', { body: { action: 'unlink', scope } });
      if (scope === 'personal') { setLink(null); setCode(null); setDeepLink(null); }
      else { setGroup(null); setGroupCode(null); setGroupAddUrl(null); }
      toast({ title: scope === 'group' ? 'Family group disconnected' : 'Telegram disconnected' });
    } catch {
      toast({ title: 'Could not unlink', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Personal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            Telegram (Personal)
            {link?.is_active && <Badge variant="secondary" className="ml-auto"><Check className="w-3 h-3 mr-1" />Connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {link?.is_active ? (
            <>
              <p className="text-sm text-muted-foreground">
                Chat 1:1 with Dori as <span className="font-medium text-foreground">@{link.telegram_username ?? link.telegram_first_name}</span>.
              </p>
              <Button variant="outline" size="sm" onClick={() => handleUnlink('personal')}>
                <Unlink className="w-3 h-3 mr-2" /> Disconnect
              </Button>
            </>
          ) : code ? (
            <>
              <p className="text-sm text-muted-foreground">
                {deepLink
                  ? 'Tap to open Telegram and link your account. Code expires in 10 min.'
                  : `Open @${botUsername ?? 'daraibot_bot'} in Telegram and send: /start ${code}`}
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                {deepLink ? (
                  <a href={deepLink} target="_blank" rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                    <ExternalLink className="w-3 h-3" /> Open Telegram
                  </a>
                ) : (
                  <a href={`https://t.me/${botUsername ?? 'daraibot_bot'}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                    <ExternalLink className="w-3 h-3" /> Open bot in Telegram
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(deepLink ? code : `/start ${code}`); toast({ title: 'Copied' }); }}>
                  <Copy className="w-3 h-3 mr-2" /> {code}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for you…
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Connect Telegram to chat 1:1 with Dori from your phone.</p>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
                Connect Telegram
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Family Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            Family Group
            {group?.is_active && <Badge variant="secondary" className="ml-auto"><Check className="w-3 h-3 mr-1" />Linked</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {group?.is_active ? (
            <>
              <p className="text-sm text-muted-foreground">
                Linked to <span className="font-medium text-foreground">{group.title || 'your family group'}</span>. Dori posts reminders here, and either of you can write naturally — "buy milk", "dentist Friday 4pm" — and it goes straight into your shared space.
              </p>
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2"><Users className="w-4 h-4" /> Family members</p>
                <p className="text-xs text-muted-foreground">
                  Pre-authorize people by their Telegram @username. Once they post in the group, Dori recognizes them automatically and acts on their messages — no codes needed. Their tasks and events go into your shared family space.
                </p>
                <div className="flex gap-2">
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addMember(); }}
                    placeholder="@username"
                    className="flex-1 h-9 px-3 rounded-md border bg-background text-sm"
                  />
                  <Button size="sm" onClick={addMember} disabled={memberBusy || !newUsername.trim()}>
                    {memberBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                  </Button>
                </div>
                {members.length > 0 && (
                  <ul className="space-y-1">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{m.display_name || (m.telegram_username ? `@${m.telegram_username}` : 'Member')}</span>
                        <Badge variant={m.status === 'active' ? 'secondary' : 'outline'} className="text-[10px]">
                          {m.role === 'owner' ? 'you' : m.status === 'active' ? 'active' : 'invited'}
                        </Badge>
                        {m.role !== 'owner' && (
                          <button onClick={() => removeMember(m.id)} disabled={memberBusy}
                            className="ml-auto text-xs text-muted-foreground hover:text-destructive">Remove</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnlink('group')}>
                <Unlink className="w-3 h-3 mr-2" /> Disconnect group
              </Button>
            </>
          ) : groupCode ? (
            <>
              <p className="text-sm text-muted-foreground">
                <strong>Step 1:</strong> Add the bot to your family Telegram group.<br />
                <strong>Step 2:</strong> In that group, send: <code className="text-xs bg-muted px-1 py-0.5 rounded">/linkfamily {groupCode}</code><br />
                <strong>Step 3:</strong> Your partner sends <code className="text-xs bg-muted px-1 py-0.5 rounded">/linkme &lt;their-personal-code&gt;</code> there too.
              </p>
              <div className="flex gap-2">
                {groupAddUrl && (
                  <a href={groupAddUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                    <ExternalLink className="w-3 h-3" /> Add bot to group
                  </a>
                )}
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`/linkfamily ${groupCode}`); toast({ title: 'Command copied' }); }}>
                  <Copy className="w-3 h-3 mr-2" /> Copy command
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for /linkfamily…
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Use Dori with your spouse in one shared Telegram group. Reminders, shopping, meetings — all in one chat.
              </p>
              <Button size="sm" onClick={handleGenerateGroup} disabled={generatingGroup}>
                {generatingGroup ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Users className="w-3 h-3 mr-2" />}
                Connect Family Group
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
