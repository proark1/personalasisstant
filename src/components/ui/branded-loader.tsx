import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandedLoaderProps {
  /** Optional message shown beneath the mark. */
  message?: string;
  className?: string;
}

/**
 * Full-screen branded loading state. Replaces bare "Loading…" text so the
 * first paint reads as DarAI rather than a blank flash. Respects
 * prefers-reduced-motion via the `animate-*` utilities (Tailwind disables
 * them when the user opts out through the global stylesheet).
 */
export function BrandedLoader({ message = "Getting things ready…", className }: BrandedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-6",
        className,
      )}
    >
      <div className="relative">
        {/* Soft pulsing halo */}
        <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" aria-hidden="true" />
        <div className="relative w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
          <Sparkles className="w-7 h-7 text-primary-foreground animate-pulse" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-semibold text-foreground tracking-tight">DarAI</span>
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
