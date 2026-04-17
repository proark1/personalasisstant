import { useNextUp } from '@/hooks/useNextUp';
import { Calendar, CheckSquare, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCountdown(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `in ${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

export function NextUpStrip() {
  const { items, loading } = useNextUp(2);

  if (loading || items.length === 0) return null;

  return (
    <div className="px-4 py-2 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Clock className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next up</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.type === 'event' ? Calendar : CheckSquare;
          const isImminent = item.minutesUntil <= 15;
          return (
            <div
              key={`${item.type}-${item.id}`}
              className={cn(
                'flex items-center gap-2 text-xs rounded-md px-2 py-1.5 transition-colors',
                isImminent ? 'bg-primary/10 text-foreground' : 'bg-background/60 text-foreground/90'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', isImminent ? 'text-primary' : 'text-muted-foreground')} />
              <span className="font-medium truncate flex-1">{item.title}</span>
              {item.location && (
                <span className="hidden sm:flex items-center gap-0.5 text-muted-foreground text-[10px]">
                  <MapPin className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[100px]">{item.location}</span>
                </span>
              )}
              <span className={cn('text-[10px] font-semibold shrink-0', isImminent ? 'text-primary' : 'text-muted-foreground')}>
                {formatCountdown(item.minutesUntil)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
