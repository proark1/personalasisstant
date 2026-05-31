import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Clapperboard, Trash2, CalendarDays } from 'lucide-react';
import { KIND_META, type ContentIdea } from '@/lib/content';

interface Props {
  scheduled: ContentIdea[];
  onOpenScripts: (idea: ContentIdea) => void;
  onUnschedule: (idea: ContentIdea) => void;
}

export function ContentCalendarStrip({ scheduled, onOpenScripts, onUnschedule }: Props) {
  // Group by local date, sorted soonest-first.
  const groups = useMemo(() => {
    const sorted = [...scheduled]
      .filter((i) => i.scheduled_for)
      .sort((a, b) => new Date(a.scheduled_for!).getTime() - new Date(b.scheduled_for!).getTime());
    const map = new Map<string, ContentIdea[]>();
    for (const idea of sorted) {
      const key = new Date(idea.scheduled_for!).toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      const arr = map.get(key) ?? [];
      arr.push(idea);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [scheduled]);

  if (scheduled.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-3">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Nothing scheduled yet. Hit <span className="font-medium">Schedule</span> on an idea to drop it here —
            it'll also show up in your main Calendar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <CalendarClock className="h-3.5 w-3.5" />
        These are real calendar events — find them in your Calendar and on any connected Google/Apple calendar.
      </p>
      {groups.map(([date, items]) => (
        <div key={date} className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground">{date}</h4>
          <div className="space-y-2">
            {items.map((idea) => (
              <Card key={idea.id}>
                <CardContent className="p-3 flex items-start gap-3">
                  <div className="text-xs font-medium text-primary w-14 shrink-0 pt-0.5">
                    {new Date(idea.scheduled_for!).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <span aria-hidden>{KIND_META[idea.kind].emoji}</span>
                        {idea.topic || KIND_META[idea.kind].label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug truncate">{idea.headline}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Scripts" onClick={() => onOpenScripts(idea)}>
                      <Clapperboard className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" title="Unschedule" onClick={() => onUnschedule(idea)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
