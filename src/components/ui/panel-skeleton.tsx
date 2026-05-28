import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type PanelSkeletonVariant = "list" | "grid" | "cards" | "timeline" | "detail";

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

function TimelineSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex gap-3 animate-fade-in"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
        >
          {/* Time rail */}
          <div className="flex flex-col items-center pt-1">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="mt-2 h-2.5 w-2.5 rounded-full" />
            {i < count - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
          </div>
          <div className="flex-1 pb-5">
            <div className="p-3 rounded-xl border border-border bg-card space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in" style={{ animationFillMode: "backwards" }}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function PanelSkeleton({ variant = "list", count = 4, className }: PanelSkeletonProps) {
  return (
    <div className={className}>
      {variant === "list" && <ListSkeleton count={count} />}
      {variant === "grid" && <GridSkeleton count={count} />}
      {variant === "cards" && <CardsSkeleton count={count} />}
      {variant === "timeline" && <TimelineSkeleton count={count} />}
      {variant === "detail" && <DetailSkeleton />}
    </div>
  );
}
