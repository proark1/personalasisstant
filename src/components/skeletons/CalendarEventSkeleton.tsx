import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function CalendarEventSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 bg-card rounded-lg border border-border",
      "animate-slide-up-fade",
      className
    )}>
      <div className="w-1 h-12 rounded-full bg-muted" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function CalendarDaySkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <CalendarEventSkeleton className="stagger-1" />
      <CalendarEventSkeleton className="stagger-2" />
    </div>
  );
}

export function CalendarWeekSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={cn("opacity-0 animate-slide-up-fade", `stagger-${Math.min(i + 1, 5)}`)}>
          <CalendarDaySkeleton />
        </div>
      ))}
    </div>
  );
}
