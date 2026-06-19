import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

interface CustomizableCardProps {
  id: string;
  /** Human label shown on the hide/show control. */
  label: string;
  customizing: boolean;
  hidden: boolean;
  onToggle: (id: string) => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a dashboard insight card so the user can hide/show it in "customize"
 * mode. When not customizing, a hidden card renders nothing. When
 * customizing, hidden cards stay visible but dimmed with a "Show" affordance
 * so they can be brought back.
 */
export function CustomizableCard({
  id,
  label,
  customizing,
  hidden,
  onToggle,
  className,
  children,
}: CustomizableCardProps) {
  if (hidden && !customizing) return null;

  if (!customizing) return <div className={className}>{children}</div>;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn("transition-opacity", hidden && "opacity-40 pointer-events-none select-none")}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-pressed={!hidden}
        aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        {hidden ? "Show" : "Hide"}
      </button>
    </div>
  );
}
