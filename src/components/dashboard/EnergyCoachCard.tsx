import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Battery, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function EnergyCoachCard() {
  const [suggestion, setSuggestion] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('energy-coach');
      if (error) throw error;
      setSuggestion(data?.suggestion ?? '');
    } catch {
      toast.error('Could not load energy suggestion');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (!suggestion && !loading) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Energy coach</h3>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
        {loading ? 'Analyzing your week…' : suggestion}
      </p>
    </Card>
  );
}
