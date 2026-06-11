import { useEffect, useState } from 'react';
import {
  Send,
  Loader2,
  Check,
  Copy,
  Unlink,
  ExternalLink,
  Users,
  MessageSquare,
  Sparkles,
  Mic,
  Image as ImageIcon,
  ShieldCheck,
  HelpCircle,
  CheckCircle2,
  AtSign,
  Bot,
  Activity,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  voice_replies_enabled: boolean;
  voice_digest_enabled: boolean;
}

// Fallback only — real username is fetched from telegram-link (getMe) so the
// app stays correct if the bot is renamed.
const DEFAULT_BOT_USERNAME = 'daraibot_bot';

interface DiagnosticsResult {
  version?: string;
  envVars: { GEMINI_API_KEY: boolean; TELEGRAM_API_KEY: boolean };
  botInfo: { ok: boolean; username?: string; first_name?: string; id?: number; error?: string };
  botState: { update_offset: number; updated_at: string; lastTickSeconds: number | null } | null;
  link: { is_active: boolean; chat_id: number | null; telegram_username: string | null; linked_at: string | null } | null;
  group: { is_active: boolean; chat_id: number | null; title: string | null; linked_at: string | null } | null;
  pollResult: { ok: boolean; status?: number; body?: unknown; error?: string } | null;
  timestamp: string;
}

interface DbStatusResult {
  bot_state: { update_offset: number | null; updated_at: string | null; last_tick_seconds: number | null };
  cron_job_exists: boolean | null;
  link: { is_active: boolean; chat_id: number | null; telegram_username: string | null; linked_at: string | null } | null;
  group_link: { is_active: boolean; chat_id: number | null; title: string | null; linked_at: string | null } | null;
  checked_at: string;
}

export function TelegramHubPanel() {
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
  const [botUsername, setBotUsername] = useState<string>(DEFAULT_BOT_USERNAME);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [rawDiagnostics, setRawDiagnostics] = useState<unknown>(null);
  const [dbStatus, setDbStatus] = useState<DbStatusResult | null>(null);
  const [dbChecking, setDbChecking] = useState(false);

  const fetchLink = async () => {
    if (!user) return;
    const [{ data: l }, { data: g }] = await Promise.all([
      supabase.from('telegram_links').select('is_active, telegram_username, telegram_first_name, linked_at').eq('user_id', user.id).maybeSingle(),
      supabase.from('telegram_group_links').select('is_active, title, linked_at, partner_user_id, voice_replies_enabled, voice_digest_enabled').eq('owner_user_id', user.id).maybeSingle(),
    ]);
    setLink(l);
    setGroup(g);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLink(); }, [user]);

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
      setCode(data.code);
      setDeepLink(data.deepLink);
      if (data.botUsername) setBotUsername(data.botUsername);
      if (!data.deepLink) {
        setError(`Telegram connector is currently unreachable. Your code is ready — open @${data.botUsername || botUsername} manually and send: /start ${data.code}`);
      }
    } catch (e) {
      toast({ title: 'Could not generate code', description: await describeEdgeError(e, 'Could not generate link code'), variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateGroup = async () => {
    setGeneratingGroup(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', { body: { action: 'generate', scope: 'group' } });
      if (error) throw error;
      setGroupCode(data.code);
      setGroupAddUrl(data.addToGroupUrl);
      if (data.botUsername) setBotUsername(data.botUsername);
    } catch (e) {
      toast({ title: 'Could not generate group code', description: await describeEdgeError(e, 'Could not generate group link code'), variant: 'destructive' });
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

  const updateGroupVoiceSetting = async (column: 'voice_replies_enabled' | 'voice_digest_enabled', value: boolean) => {
    if (!user || !group) return;
    const previous = group;
    setGroup({ ...group, [column]: value });
    const update = column === 'voice_replies_enabled'
      ? { voice_replies_enabled: value, updated_at: new Date().toISOString() }
      : { voice_digest_enabled: value, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('telegram_group_links')
      .update(update)
      .eq('owner_user_id', user.id);
    if (error) {
      setGroup(previous);
      toast({ title: 'Could not update group voice setting', description: await describeEdgeError(error, 'Could not update group voice setting'), variant: 'destructive' });
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const checkDbStatus = async () => {
    setDbChecking(true);
    try {
      // Cast: telegram_status is new; types haven't regenerated yet.
      const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> }).rpc('telegram_status');
      if (error) throw error as Error;
      setDbStatus(data as DbStatusResult);
    } catch (e) {
      toast({ title: 'DB check failed', description: await describeEdgeError(e, 'DB check failed'), variant: 'destructive' });
    } finally {
      setDbChecking(false);
    }
  };

  const runDiagnostics = async (runPoll: boolean) => {
    setDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', { body: { action: 'diagnose', runPoll } });
      // Always stash the raw response so we can see what came back even when
      // the shape is wrong.
      setRawDiagnostics(error ? { supabaseError: String(error) } : data);
      console.log('[telegram-link diagnose] response:', data, 'error:', error);
      if (error) throw error;
      // If the deployed function doesn't yet have the 'diagnose' branch, it
      // will fall through to the generate path and return {code, deepLink}.
      if (!data || !data.botInfo || !data.envVars) {
        const keys = data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data;
        toast({
          title: 'Diagnose endpoint not deployed',
          description: `Response shape unexpected (keys: ${keys}). Expand "Raw response" below to inspect.`,
          variant: 'destructive',
        });
        await fetchLink();
        return;
      }
      setDiagnostics(data as DiagnosticsResult);
      if (runPoll) await fetchLink();
    } catch (e) {
      toast({ title: 'Diagnostics failed', description: await describeEdgeError(e, 'Diagnostics failed'), variant: 'destructive' });
    } finally {
      setDiagnosing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero / intro */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-transparent to-transparent p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Use Dori from Telegram</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Capture tasks, schedule meetings, get reminders and chat with your AI assistant — straight from your Telegram app, on any device. Works 1:1 and in your family group.
            </p>
          </div>
        </div>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-lg border p-3 ${link?.is_active ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <MessageSquare className="w-3.5 h-3.5" /> Personal chat
          </div>
          <div className="text-sm font-medium flex items-center gap-1.5">
            {link?.is_active ? <><CheckCircle2 className="w-4 h-4 text-primary" /> Connected</> : 'Not connected'}
          </div>
        </div>
        <div className={`rounded-lg border p-3 ${group?.is_active ? 'border-primary/40 bg-primary/5' : 'border-border'}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Users className="w-3.5 h-3.5" /> Family group
          </div>
          <div className="text-sm font-medium flex items-center gap-1.5">
            {group?.is_active ? <><CheckCircle2 className="w-4 h-4 text-primary" /> Linked</> : 'Not linked'}
          </div>
        </div>
      </div>

      {/* Personal connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            1:1 Chat with Dori
            {link?.is_active && <Badge variant="secondary" className="ml-auto"><Check className="w-3 h-3 mr-1" />Connected</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {link?.is_active ? (
            <>
              <p className="text-sm text-muted-foreground">
                You're chatting as <span className="font-medium text-foreground">@{link.telegram_username ?? link.telegram_first_name}</span>. Open Telegram and search <span className="font-medium text-foreground">@{botUsername}</span> to start.
              </p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  <ExternalLink className="w-3 h-3" /> Open chat
                </a>
                <Button variant="outline" size="sm" onClick={() => handleUnlink('personal')}>
                  <Unlink className="w-3 h-3 mr-2" /> Disconnect
                </Button>
              </div>
            </>
          ) : code ? (
            <>
              <p className="text-sm text-muted-foreground">
                {deepLink
                  ? 'Tap below to open Telegram and link your account. Code expires in 10 minutes.'
                  : `Open @${botUsername} in Telegram and send: /start ${code}`}
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2 flex-wrap">
                <a
                  href={deepLink ?? `https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
                >
                  <ExternalLink className="w-3 h-3" /> {deepLink ? 'Open Telegram' : 'Open bot in Telegram'}
                </a>
                <Button variant="outline" size="sm" onClick={() => copy(deepLink ? code : `/start ${code}`, deepLink ? 'Code' : 'Command')}>
                  <Copy className="w-3 h-3 mr-2" /> {code}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for Telegram…
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your personal Telegram to chat 1:1 with Dori. Send a message in plain language ("remind me to call dad tomorrow at 5") and it gets added.
              </p>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
                Connect Telegram
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Family group */}
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
        <CardContent className="space-y-4">
          {group?.is_active ? (
            <>
              <p className="text-sm text-muted-foreground">
                Linked to <span className="font-medium text-foreground">{group.title || 'your family group'}</span>. Either of you can write naturally — "buy milk", "dentist Friday 4pm", "@{botUsername} what's on today?" — and it lands in your shared space.
              </p>
              {!group.partner_user_id && (
                <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                  💡 Want your spouse's items in the group too? Invite them in <span className="font-medium text-foreground">Settings → Team</span>, then they should also send <code className="text-[11px] bg-background px-1 py-0.5 rounded">/linkme &lt;their-personal-code&gt;</code> in the group.
                </div>
              )}
              <div className="rounded-md border border-border p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="telegram-group-voice-replies" className="text-sm">Voice replies in group</Label>
                    <p className="text-xs text-muted-foreground">Let Dori answer normal group chats with short Telegram voice notes.</p>
                  </div>
                  <Switch
                    id="telegram-group-voice-replies"
                    checked={!!group.voice_replies_enabled}
                    onCheckedChange={(v) => updateGroupVoiceSetting('voice_replies_enabled', v)}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="telegram-group-voice-digest" className="text-sm">Voice morning digest</Label>
                    <p className="text-xs text-muted-foreground">Send a spoken family digest before the text version with details.</p>
                  </div>
                  <Switch
                    id="telegram-group-voice-digest"
                    checked={!!group.voice_digest_enabled}
                    onCheckedChange={(v) => updateGroupVoiceSetting('voice_digest_enabled', v)}
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnlink('group')}>
                <Unlink className="w-3 h-3 mr-2" /> Disconnect group
              </Button>
            </>
          ) : groupCode ? (
            <>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">1</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-foreground">Add the bot to your family Telegram group.</p>
                    {groupAddUrl && (
                      <a
                        href={groupAddUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
                      >
                        <ExternalLink className="w-3 h-3" /> Add @{botUsername} to group
                      </a>
                    )}
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">2</span>
                  <div className="flex-1 space-y-2">
                    <p className="text-foreground">In that group, send this command:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono">/linkfamily {groupCode}</code>
                      <Button variant="outline" size="sm" onClick={() => copy(`/linkfamily ${groupCode}`, 'Command')}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">3</span>
                  <div className="flex-1">
                    <p className="text-foreground">Your partner sends <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">/linkme &lt;their-personal-code&gt;</code> in the same group, so their items also sync.</p>
                  </div>
                </li>
              </ol>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                <Loader2 className="w-3 h-3 animate-spin" /> Waiting for /linkfamily…
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Use Dori with your spouse in one shared Telegram group. Reminders, shopping lists, meetings — all in one chat your whole family already uses.
              </p>
              <Button size="sm" onClick={handleGenerateGroup} disabled={generatingGroup}>
                {generatingGroup ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Users className="w-3 h-3 mr-2" />}
                Connect Family Group
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* What you can do */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            What you can do in Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {[
            { icon: MessageSquare, title: 'Natural language', desc: 'Write "buy milk tomorrow" or "dentist Fri 4pm" — Dori files it correctly.' },
            { icon: Mic, title: 'Voice messages', desc: 'Send a voice note — it gets transcribed and turned into tasks or reminders.' },
            { icon: ImageIcon, title: 'Photos & docs', desc: 'Forward receipts, contracts, or screenshots — Dori scans and saves them.' },
            { icon: Bot, title: 'Ask anything', desc: 'Mention @' + botUsername + ' in groups: "what\'s on today?", "any overdue tasks?"' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Group etiquette */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AtSign className="w-4 h-4 text-primary" />
            How Dori behaves in groups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>To avoid spamming your family chat, Dori only replies in groups when:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>You <strong className="text-foreground">@mention the bot</strong> — e.g. "@{botUsername} what's on today?"</li>
            <li>You start with <strong className="text-foreground">"Hey Dori"</strong> or <strong className="text-foreground">"Dori, …"</strong></li>
            <li>You reply directly to one of Dori's messages</li>
            <li>The message clearly contains an action (buy, remind, schedule, meeting, tomorrow…)</li>
            <li>You send a slash command like <code className="text-xs bg-muted px-1 rounded">/linkme</code></li>
          </ul>
          <p className="pt-1">Normal family conversation is left alone.</p>
        </CardContent>
      </Card>

      {/* Commands */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4 text-primary" />
            Commands cheat sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            { cmd: '/start', desc: 'Greet Dori and see your linking status' },
            { cmd: '/linkme <code>', desc: 'Link your personal Telegram to your account' },
            { cmd: '/linkfamily <code>', desc: 'Link the current group as your family group' },
            { cmd: '/today', desc: 'Get today\'s tasks and events' },
            { cmd: '/help', desc: 'See everything Dori can do' },
          ].map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono shrink-0 min-w-[140px]">{cmd}</code>
              <span className="text-muted-foreground text-xs">{desc}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Diagnostics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" />
            Diagnose
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Not getting a reply from the bot? Run diagnostics to see what's broken, or force a poll cycle to process any queued messages.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => runDiagnostics(false)} disabled={diagnosing}>
              {diagnosing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Activity className="w-3 h-3 mr-2" />}
              Run diagnostics
            </Button>
            <Button size="sm" variant="outline" onClick={() => runDiagnostics(true)} disabled={diagnosing}>
              {diagnosing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-2" />}
              Poll now
            </Button>
            <Button size="sm" variant="outline" onClick={checkDbStatus} disabled={dbChecking}>
              {dbChecking ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Activity className="w-3 h-3 mr-2" />}
              Check DB state
            </Button>
          </div>

          {dbStatus && (
            <div className="space-y-2 pt-2 border-t border-border text-sm">
              <p className="text-xs font-medium text-muted-foreground">Database state (deploys reliably via migration):</p>
              <DiagnosticRow
                label="Cron job scheduled"
                ok={dbStatus.cron_job_exists === true}
                detail={dbStatus.cron_job_exists === true
                  ? 'poll-telegram-updates is in cron.job'
                  : dbStatus.cron_job_exists === false
                    ? 'NOT scheduled — migration 20260421090000 has not run'
                    : 'unable to check (cron schema inaccessible)'}
              />
              <DiagnosticRow
                label="Cron is ticking"
                ok={dbStatus.bot_state.last_tick_seconds !== null && dbStatus.bot_state.last_tick_seconds < 180}
                detail={dbStatus.bot_state.updated_at
                  ? `last tick ${dbStatus.bot_state.last_tick_seconds}s ago (offset ${dbStatus.bot_state.update_offset})`
                  : 'bot_state never updated — cron has never successfully run'}
              />
              <DiagnosticRow
                label="Personal link"
                ok={dbStatus.link?.is_active === true}
                detail={dbStatus.link?.is_active
                  ? `chat_id ${dbStatus.link.chat_id} @${dbStatus.link.telegram_username ?? '—'}`
                  : dbStatus.link
                    ? 'row exists, is_active=false'
                    : 'no link row'}
              />
              <p className="text-xs text-muted-foreground pt-1">Checked {new Date(dbStatus.checked_at).toLocaleTimeString()}</p>
            </div>
          )}

          {diagnostics && (
            <div className="space-y-2 pt-2 border-t border-border text-sm">
              <DiagnosticRow
                label="Bot token valid (getMe)"
                ok={diagnostics.botInfo.ok}
                detail={diagnostics.botInfo.ok
                  ? `@${diagnostics.botInfo.username} (${diagnostics.botInfo.first_name})`
                  : diagnostics.botInfo.error ?? 'failed'}
              />
              <DiagnosticRow
                label="GEMINI_API_KEY set"
                ok={diagnostics.envVars.GEMINI_API_KEY}
                detail={diagnostics.envVars.GEMINI_API_KEY ? 'yes' : 'missing — set in Edge Function secrets'}
              />
              <DiagnosticRow
                label="TELEGRAM_API_KEY set"
                ok={diagnostics.envVars.TELEGRAM_API_KEY}
                detail={diagnostics.envVars.TELEGRAM_API_KEY ? 'yes' : 'missing — set in Edge Function secrets'}
              />
              <DiagnosticRow
                label="Cron is running"
                ok={diagnostics.botState?.lastTickSeconds !== null && diagnostics.botState !== null && diagnostics.botState.lastTickSeconds < 180}
                detail={diagnostics.botState?.updated_at
                  ? `last tick ${diagnostics.botState.lastTickSeconds}s ago (offset ${diagnostics.botState.update_offset})`
                  : 'no bot_state row — migrations may not have run'}
              />
              <DiagnosticRow
                label="Personal link active"
                ok={diagnostics.link?.is_active === true}
                detail={diagnostics.link?.is_active
                  ? `chat_id ${diagnostics.link.chat_id} @${diagnostics.link.telegram_username ?? '—'}`
                  : diagnostics.link ? 'row exists but is_active=false (code not consumed yet)' : 'no link row — click Connect Telegram'}
              />
              {diagnostics.group && (
                <DiagnosticRow
                  label="Family group link"
                  ok={diagnostics.group.is_active === true}
                  detail={diagnostics.group.is_active
                    ? `chat_id ${diagnostics.group.chat_id} (${diagnostics.group.title ?? 'untitled'})`
                    : 'row exists but is_active=false'}
                />
              )}
              {diagnostics.pollResult && (
                <DiagnosticRow
                  label="Manual poll"
                  ok={diagnostics.pollResult.ok}
                  detail={diagnostics.pollResult.ok
                    ? `ok (${JSON.stringify(diagnostics.pollResult.body).slice(0, 100)})`
                    : `http ${diagnostics.pollResult.status ?? '?'}: ${diagnostics.pollResult.error ?? JSON.stringify(diagnostics.pollResult.body).slice(0, 100)}`}
                />
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Checked {new Date(diagnostics.timestamp).toLocaleTimeString()}
                {diagnostics.version && <span className="ml-2 opacity-60">(backend {diagnostics.version})</span>}
              </p>
            </div>
          )}

          {rawDiagnostics !== null && (
            <details className="pt-2 border-t border-border">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">Raw response (click to expand)</summary>
              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all bg-muted/40 rounded p-2 mt-2 max-h-64 overflow-auto">
                {JSON.stringify(rawDiagnostics, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="w-4 h-4 text-primary" />
            Troubleshooting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="no-reply">
              <AccordionTrigger className="text-sm">The bot doesn't reply in my group</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>1. Make sure the group is linked — generate a fresh code above and send <code className="text-xs bg-muted px-1 rounded">/linkfamily &lt;code&gt;</code>.</p>
                <p>2. @mention the bot or start your message with "Hey Dori" so it knows you're talking to it.</p>
                <p>3. If you're an admin, you can give the bot full read access in BotFather (<code className="text-xs bg-muted px-1 rounded">/setprivacy → Disable</code>) so it can pick up keywords without a mention.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="link-fail">
              <AccordionTrigger className="text-sm">"This chat isn't linked yet" message</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Your code may have expired (10 min lifetime). Generate a fresh one in this panel and try again. Each user must link their <em>personal</em> code separately, even inside a group.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="lost-code">
              <AccordionTrigger className="text-sm">I lost my linking code</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                Just click "Connect Telegram" or "Connect Family Group" again — a new code is generated instantly. Old codes auto-expire.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="privacy">
              <AccordionTrigger className="text-sm">Is my data safe?</AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-2">
                <p>Yes. Messages are processed only to fulfil your request — tasks, reminders and shared family items are stored in your private space with strict row-level security.</p>
                <p>You can disconnect either Telegram link at any time using the buttons above.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Privacy footer */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border pt-4">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" />
        <p>Dori only reads messages you send to it directly or in linked groups, and only acts on items addressed to it. You can disconnect at any time.</p>
      </div>
    </div>
  );
}

function DiagnosticRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok
        ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground break-words">{detail}</div>
      </div>
    </div>
  );
}
