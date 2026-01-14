import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function TaskCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 bg-card rounded-xl border border-border",
      "animate-slide-up-fade",
      className
    )}>
      <Skeleton className="h-6 w-6 rounded-md flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-9 rounded-lg" />
    </div>
  );
}

export function TaskListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton 
          key={i} 
          className={cn("opacity-0 animate-slide-up-fade", `stagger-${Math.min(i + 1, 5)}`)}
        />
      ))}
    </div>
  );
}
