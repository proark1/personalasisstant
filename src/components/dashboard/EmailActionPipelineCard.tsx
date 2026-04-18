import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Sparkles, X, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
};

export function EmailActionPipelineCard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('email_classifications')
      .select('id, email_id, category, suggested_action, reasoning, suggested_payload')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .neq('suggested_action', 'none')
      .order('created_at', { ascending: false })
      .limit(5);
    setItems((data ?? []) as Suggestion[]);
  };

  useEffect(() => { load(); }, [user?.id]);

  const runClassifier = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('email-classifier', { body: { user_id: user.id } });
      if (error) throw error;
      toast.success('Classified recent emails');
      await load();
    } catch (e) {
      toast.error('Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const dismiss = async (id: string) => {
    await supabase.from('email_classifications').update({ status: 'dismissed', dismissed_at: new Date().toISOString() }).eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const apply = async (item: Suggestion) => {
    // Mark applied; actual creation flow is left to user via deep-link to email panel
    await supabase.from('email_classifications').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    toast.success('Marked applied — open Email Hub to finalise');
  };

  if (!items.length) {
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>No email suggestions pending</span>
          </div>
          <Button size="sm" variant="ghost" onClick={runClassifier} disabled={loading}>
            <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Scan
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Email actions ({items.length})</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={runClassifier} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px]">{item.category.replace('_', ' ')}</Badge>
                <span className="text-xs font-medium truncate">{item.suggested_payload?.subject ?? 'Email'}</span>
              </div>
              {item.reasoning && <p className="text-[11px] text-muted-foreground">{item.reasoning}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="default" className="h-7 text-[11px]" onClick={() => apply(item)}>
                <Plus className="w-3 h-3 mr-1" />
                {ACTION_LABEL[item.suggested_action] ?? 'Apply'}
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => dismiss(item.id)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
