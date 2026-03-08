import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PanelSkeletonVariant = "list" | "grid" | "cards";

interface PanelSkeletonProps {
  variant?: PanelSkeletonVariant;
  count?: number;
  className?: string;
}

function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl border border-border bg-card",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function GridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "p-4 rounded-xl border border-border bg-card space-y-3",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
        >
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "p-4 rounded-xl border border-border bg-card space-y-3",
            "animate-fade-in"
          )}
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ variant = "list", count = 4, className }: PanelSkeletonProps) {
  return (
    <div className={className}>
      {variant === "list" && <ListSkeleton count={count} />}
      {variant === "grid" && <GridSkeleton count={count} />}
      {variant === "cards" && <CardsSkeleton count={count} />}
    </div>
  );
}
