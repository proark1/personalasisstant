import { useState, useEffect } from "react";
import {
  CheckSquare,
  Calendar,
  FileText,
  User,
  ShoppingCart,
  Briefcase,
  Target,
  Mail,
  Bell,
  AlertTriangle,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trackProactiveOutcome } from "@/lib/telemetry";

export interface ActionCardData {
  type:
    | "task"
    | "event"
    | "note"
    | "contact"
    | "contract"
    | "project"
    | "habit"
    | "email"
    | "reminder"
    | "shopping";
  action: string;
  title: string;
  details?: string;
  /** Whether the underlying mutation actually succeeded. Defaults to success. */
  status?: "success" | "failed";
  /** When present, the action can be undone (deletes the created entity). */
  undo?: { type: string; id: string };
}

const ICONS: Record<string, React.ElementType> = {
  task: CheckSquare,
  event: Calendar,
  note: FileText,
  contact: User,
  contract: Briefcase,
  project: Target,
  habit: Target,
  email: Mail,
  reminder: Bell,
  shopping: ShoppingCart,
};

export function ActionCard({ data }: { data: ActionCardData }) {
  const Icon = ICONS[data.type] || CheckSquare;
  const failed = data.status === "failed";
  const [undone, setUndone] = useState(false);

  // Impression: an action result was surfaced to the user. Fire once on mount.
  useEffect(() => {
    trackProactiveOutcome("dori_action_card", "shown", {
      actionType: data.type,
      status: data.status ?? "success",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUndo = () => {
    if (!data.undo) return;
    window.dispatchEvent(new CustomEvent("dori:undo-action", { detail: data.undo }));
    setUndone(true);
    trackProactiveOutcome("dori_action_card", "dismissed", {
      actionType: data.type,
      undoType: data.undo.type,
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 mt-2 flex items-center gap-3 animate-fade-in",
        failed ? "border-destructive/40 bg-destructive/5" : "border-border/50 bg-muted/30",
        undone && "opacity-60",
      )}
    >
      <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center shrink-0">
        {failed ? (
          <AlertTriangle className="w-4 h-4 text-destructive" />
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-[10px] uppercase font-medium",
              failed ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {undone ? "Undone" : failed ? "Couldn't " + data.action.toLowerCase() : data.action}
          </span>
        </div>
        <p className="text-sm font-medium truncate">{data.title}</p>
        {failed ? (
          <p className="text-xs text-destructive/80 truncate">
            {data.details || "Nothing was saved — please try again."}
          </p>
        ) : (
          data.details && <p className="text-xs text-muted-foreground truncate">{data.details}</p>
        )}
      </div>

      {!failed && data.undo && !undone && (
        <button
          type="button"
          onClick={handleUndo}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Undo: ${data.title}`}
        >
          <Undo2 className="w-3 h-3" />
          Undo
        </button>
      )}
      {!failed && !data.undo && !undone && (
        <div className="text-primary text-xs font-medium">✓</div>
      )}
    </div>
  );
}
