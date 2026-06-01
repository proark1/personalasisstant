import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail, Sparkles, X, Plus, RefreshCw, Calendar, CheckSquare,
  FileText, Receipt, Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Suggestion {
  id: string;
  email_id: string;
  category: string;
  suggested_action: string;
  reasoning: string | null;
  suggested_payload: any;
}

const ACTION_LABEL: Record<string, string> = {
  create_contract: 'Create contract',
  create_event: 'Add to calendar',
  create_task: 'Create task',
  create_note: 'Save as note',
};

const ACTION_ICON: Record<string, typeof Plus> = {
  create_contract: Receipt,
  create_event: Calendar,
  create_task: CheckSquare,
  create_note: FileText,
};

const CATEGORY_COLOR: Record<string, string> = {
  bill: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  meeting_request: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  family_logistics: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  travel: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  shopping: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  work: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  personal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  newsletter: 'bg-muted text-muted-foreground',
  note: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  other: 'bg-muted text-muted-foreground',
};

export function EmailActionPipelineCard({
  variant = 'card',
  hideWhenEmpty = false,
}: { variant?: 'card' | 'list'; hideWhenEmpty?: boolean } = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanLimit, setScanLimit] = useState('25');
  const [scanning, setScanning] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('email_classifications')
      .select('id, email_id, category, suggested_action, reasoning, suggested_payload')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .neq('suggested_action', 'none')
      .order('created_at', { ascending: false })
      .limit(variant === 'list' ? 100 : 20);
    setItems((data ?? []) as Suggestion[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const runClassifier = async (limit = 25, force = false) => {
    if (!user?.id) return;
    setScanning(true);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-classifier', {
        body: { user_id: user.id, limit, force },
      });
      if (error) throw error;
      const n = (data as any)?.classified ?? 0;
      toast.success(n > 0 ? `Found ${n} new suggestion${n === 1 ? '' : 's'}` : 'No new actions found');
      await load();
    } catch (e) {
      toast.error(await describeEdgeError(e, 'Scan failed'));
    } finally {
      setScanning(false);
      setLoading(false);
      setScanOpen(false);
    }
  };

  const dismiss = async (id: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('email_classifications').update({ status: 'dismissed', dismissed_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
    if (error) { toast.error('Could not dismiss'); return; }
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const apply = async (item: Suggestion, overrideAction?: string) => {
    if (!user?.id) return;
    setApplyingId(item.id);
    try {
      const p = item.suggested_payload || {};
      const titleFromEmail = p.subject || p.title || 'From email';
      let createdLabel = 'Applied';
      const action = overrideAction || item.suggested_action;

      if (action === 'create_task') {
        const { error } = await supabase.from('tasks').insert({
          user_id: user.id,
          title: p.title || titleFromEmail,
          description: item.reasoning || `From: ${p.from_name || p.from || ''}`,
          category: 'personal',
          priority: 'medium',
          due_date: p.due_iso || null,
        });
        if (error) throw error;
        createdLabel = 'Task created';
      } else if (action === 'create_event') {
        const start = p.start_iso ? new Date(p.start_iso) : null;
        if (!start || isNaN(start.getTime())) {
          // Default to tomorrow 9am if no date detected
          const fallback = new Date();
          fallback.setDate(fallback.getDate() + 1);
          fallback.setHours(9, 0, 0, 0);
          const end = new Date(fallback.getTime() + 60 * 60 * 1000);
          const { error } = await supabase.from('events').insert({
            user_id: user.id,
            title: p.title || titleFromEmail,
            description: item.reasoning || '',
            start_time: fallback.toISOString(),
            end_time: end.toISOString(),
            location: p.location || null,
            category: 'personal',
            created_via: 'email_suggestion',
          });
          if (error) throw error;
          createdLabel = 'Event added (tomorrow 9am — please review)';
        } else {
          const end = new Date(start.getTime() + 60 * 60 * 1000);
          const { error } = await supabase.from('events').insert({
            user_id: user.id,
            title: p.title || titleFromEmail,
            description: item.reasoning || '',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            location: p.location || null,
            category: 'personal',
            created_via: 'email_suggestion',
          });
          if (error) throw error;
          createdLabel = 'Event added';
        }
      } else if (action === 'create_note') {
        const { error } = await supabase.from('notes').insert({
          user_id: user.id,
          title: p.title || titleFromEmail,
          content: `${item.reasoning || ''}\n\nFrom: ${p.from_name || p.from || ''}\nSubject: ${p.subject || ''}`.trim(),
          created_via: 'email_suggestion',
        });
        if (error) throw error;
        createdLabel = 'Note saved';
      } else if (action === 'create_contract') {
        // Contracts have a richer flow — defer to email hub but mark applied
        toast.info('Open the email in Email Hub to confirm contract details');
        createdLabel = 'Marked for review';
      }

      await supabase.from('email_classifications')
        .update({ status: 'applied', applied_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', user.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success(createdLabel);
    } catch (e) {
      console.error(e);
      toast.error('Could not apply suggestion');
    } finally {
      setApplyingId(null);
    }
  };

  const ScanDialog = (
    <Dialog open={scanOpen} onOpenChange={setScanOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Scan emails for actions
          </DialogTitle>
          <DialogDescription>
            Dori will read your most recent emails and suggest tasks, events, contracts, or notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-xs">How many recent emails?</Label>
          <Select value={scanLimit} onValueChange={setScanLimit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">Last 10</SelectItem>
              <SelectItem value="25">Last 25</SelectItem>
              <SelectItem value="50">Last 50</SelectItem>
              <SelectItem value="100">Last 100</SelectItem>
              <SelectItem value="200">Last 200</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setScanOpen(false)} disabled={scanning}>Cancel</Button>
          <Button onClick={() => runClassifier(parseInt(scanLimit, 10), true)} disabled={scanning}>
            {scanning ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
            Scan now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!items.length) {
    if (hideWhenEmpty && variant === 'list') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">No pending email actions.</p>
            <Button size="sm" variant="outline" onClick={() => setScanOpen(true)} disabled={loading}>
              <Sparkles className="w-3 h-3 mr-1" />
              Scan emails
            </Button>
          </div>
          {ScanDialog}
        </div>
      );
    }
    return (
      <>
        <Card className="p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <Mail className="w-4 h-4 shrink-0" />
              <span className="truncate">No email suggestions pending</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setScanOpen(true)} disabled={loading}>
              <Sparkles className="w-3 h-3 mr-1" />
              Scan emails
            </Button>
          </div>
        </Card>
        {ScanDialog}
      </>
    );
  }

  // List variant — used inside the Email panel "Actions" tab
  if (variant === 'list') {
    const ALL_ACTIONS: Array<{ key: string; label: string; Icon: typeof Plus }> = [
      { key: 'create_task', label: 'Task', Icon: CheckSquare },
      { key: 'create_event', label: 'Event', Icon: Calendar },
      { key: 'create_note', label: 'Note', Icon: FileText },
      { key: 'create_contract', label: 'Contract', Icon: Receipt },
    ];
    return (
      <div className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
        <div className="flex min-w-0 max-w-full items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm truncate min-w-0 max-w-full">{items.length} email action{items.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setScanOpen(true)} disabled={loading}>
              <Sparkles className="w-3 h-3 mr-1" />
              Scan
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => runClassifier(25, false)} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {items.map(item => {
          const catClass = CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR.other;
          const isApplying = applyingId === item.id;
          const suggestedKey = item.suggested_action;
          return (
              <Card key={item.id} className="w-full min-w-0 max-w-full space-y-2 overflow-hidden p-3 [contain:layout]">
              <div className="flex min-w-0 max-w-full items-start gap-2">
                <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0 max-w-full">
                    <Badge variant="outline" className={`text-[10px] max-w-full truncate ${catClass}`}>
                      {item.category.replace('_', ' ')}
                    </Badge>
                      <span className="block min-w-0 max-w-full text-xs font-medium whitespace-normal break-words [overflow-wrap:anywhere] line-clamp-2">
                      {item.suggested_payload?.subject ?? 'Email'}
                    </span>
                  </div>
                  {item.reasoning && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 [overflow-wrap:anywhere] break-words max-w-full">{item.reasoning}</p>
                  )}
                </div>
                  <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground hover:text-destructive whitespace-normal"
                  onClick={() => dismiss(item.id)} disabled={isApplying} title="Dismiss — won't show again">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
               <div className="grid w-full min-w-0 max-w-full grid-cols-2 gap-1.5 overflow-hidden sm:flex sm:flex-wrap">
                {ALL_ACTIONS.map(({ key, label, Icon }) => {
                  const isSuggested = key === suggestedKey;
                  return (
                    <Button
                      key={key}
                      size="sm"
                      variant={isSuggested ? 'default' : 'outline'}
                       className="h-auto min-h-0 w-full min-w-0 max-w-full shrink justify-start px-2 py-1.5 text-[11px] whitespace-normal"
                      onClick={() => apply(item, key)}
                      disabled={isApplying}
                    >
                      {isApplying
                        ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        : <Icon className="w-3 h-3 mr-1" />}
                       <span className="min-w-0 whitespace-normal break-words text-left leading-tight">{label}</span>
                    </Button>
                  );
                })}
              </div>
            </Card>
          );
        })}
        {ScanDialog}
      </div>
    );
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold text-sm truncate">Email actions ({items.length})</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setScanOpen(true)} disabled={loading}>
              <Sparkles className="w-3 h-3 mr-1" />
              Scan
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => runClassifier(25, false)} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {items.map(item => {
            const Icon = ACTION_ICON[item.suggested_action] ?? Plus;
            const catClass = CATEGORY_COLOR[item.category] ?? CATEGORY_COLOR.other;
            const isApplying = applyingId === item.id;
            return (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${catClass}`}>
                      {item.category.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs font-medium truncate">
                      {item.suggested_payload?.subject ?? 'Email'}
                    </span>
                  </div>
                  {item.reasoning && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{item.reasoning}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="default" className="h-7 text-[11px]"
                    onClick={() => apply(item)} disabled={isApplying}>
                    {isApplying
                      ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      : <Icon className="w-3 h-3 mr-1" />}
                    {ACTION_LABEL[item.suggested_action] ?? 'Apply'}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => dismiss(item.id)} disabled={isApplying}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {ScanDialog}
    </>
  );
}
