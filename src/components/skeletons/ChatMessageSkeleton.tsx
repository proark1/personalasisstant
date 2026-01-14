import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ChatMessageSkeletonProps {
  isOwn?: boolean;
  className?: string;
}

export function ChatMessageSkeleton({ isOwn = false, className }: ChatMessageSkeletonProps) {
  return (
    <div className={cn(
      "flex gap-2 animate-slide-up-fade",
      isOwn ? 'justify-end' : 'justify-start',
      className
    )}>
      {!isOwn && <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />}
      <div className={cn("space-y-1.5", isOwn ? 'items-end' : 'items-start')}>
        <Skeleton 
          className={cn("h-12 rounded-2xl", isOwn ? 'w-36' : 'w-52')} 
        />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

export function ChatListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton 
          key={i} 
          isOwn={i % 3 === 0} 
          className={cn("opacity-0", `stagger-${Math.min(i + 1, 5)}`)}
        />
      ))}
    </div>
  );
}
