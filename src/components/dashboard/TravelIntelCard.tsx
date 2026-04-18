import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plane, Users, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface Trip {
  id: string;
  destination: string;
  destination_country: string | null;
  start_date: string;
  end_date: string;
  contacts_in_destination: any[];
}

export function TravelIntelCard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from('detected_trips')
        .select('id, destination, destination_country, start_date, end_date, contacts_in_destination')
        .eq('user_id', user.id)
        .gte('end_date', new Date().toISOString().slice(0, 10))
        .order('start_date')
        .limit(3);
      setTrips((data ?? []) as Trip[]);
    };
    load();
  }, [user?.id]);

  const dismiss = async (id: string) => {
    await supabase.from('detected_trips').update({ status: 'dismissed' }).eq('id', id);
    setTrips(prev => prev.filter(t => t.id !== id));
  };

  if (!trips.length) return null;

  return (
    <Card className="p-4 border-l-4 border-l-primary">
      <div className="flex items-center gap-2 mb-3">
        <Plane className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Upcoming travel ({trips.length})</h3>
      </div>
      <div className="space-y-2">
        {trips.map(t => (
          <div key={t.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium truncate">
                  {t.destination}{t.destination_country ? `, ${t.destination_country}` : ''}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  {format(new Date(t.start_date), 'MMM d')} – {format(new Date(t.end_date), 'MMM d')}
                </Badge>
              </div>
              {t.contacts_in_destination?.length > 0 && (
                <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{t.contacts_in_destination.length} contact{t.contacts_in_destination.length > 1 ? 's' : ''} in {t.destination}</span>
                </div>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => dismiss(t.id)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
