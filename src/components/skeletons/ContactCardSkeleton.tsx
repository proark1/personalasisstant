import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function ContactCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-4 bg-card rounded-xl border border-border",
      "animate-slide-up-fade",
      className
    )}>
      <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-7 w-18 rounded-full" />
    </div>
  );
}

export function ContactListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <ContactCardSkeleton 
          key={i}
          className={cn("opacity-0", `stagger-${Math.min(i + 1, 5)}`)}
        />
      ))}
    </div>
  );
}
