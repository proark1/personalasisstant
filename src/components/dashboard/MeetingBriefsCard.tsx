import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface Brief { id: string; event_id: string; brief_text: string; created_at: string; }

export function MeetingBriefsCard() {
  const { user } = useAuth();
  const [briefs, setBriefs] = useState<Brief[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('meeting_briefs')
        .select('id, event_id, brief_text, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(2);
      setBriefs((data ?? []) as Brief[]);
    };
    load();
    const ch = supabase.channel('mb-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meeting_briefs', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  if (!briefs.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Recent meeting briefs</h3>
      </div>
      <div className="space-y-3">
        {briefs.map(b => (
          <div key={b.id} className="p-2 rounded-md bg-muted/40">
            <Badge variant="outline" className="text-[10px] mb-1">
              {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}
            </Badge>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">{b.brief_text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
