import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  X,
  Clock,
  Coffee,
  Droplets,
  AlertTriangle,
  Brain,
  Play,
  HelpCircle,
  BellOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Nudge } from "@/hooks/useSmartNudges";
import { trackProactiveOutcome, type ProactiveOutcome } from "@/lib/telemetry";

interface NudgeOverlayProps {
  nudge: Nudge | null;
  onDismiss: (nudgeId?: string) => void;
  /** Mute this whole nudge type for good. */
  onMute?: (nudge: Nudge) => void;
  /** Record the user's response for tuning + the proactivity metric. */
  onFeedback?: (nudge: Nudge, outcome: ProactiveOutcome) => void;
}

const NUDGE_ICONS = {
  time_blindness: Clock,
  break_reminder: Coffee,
  transition: AlertTriangle,
  hydration: Droplets,
  task_start: Play,
  stuck_detection: Brain,
};

const NUDGE_COLORS = {
  time_blindness: "border-l-warning",
  break_reminder: "border-l-accent",
  transition: "border-l-destructive",
  hydration: "border-l-primary",
  task_start: "border-l-secondary",
  stuck_detection: "border-l-muted-foreground",
};

export function NudgeOverlay({ nudge, onDismiss, onMute, onFeedback }: NudgeOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  // Impression: record once per nudge id when it's actually shown. useSmartNudges
  // already records accepted/dismissed/muted (surface 'smart_nudge') but never the
  // impression — this fills that gap so acceptance rate = accepted ÷ shown. Match
  // the same surface; dedupe by id to avoid the show/exit effect re-firing.
  const shownNudgeIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (nudge) {
      setIsVisible(true);
      setIsExiting(false);
      setShowWhy(false);
      if (!shownNudgeIds.current.has(nudge.id)) {
        shownNudgeIds.current.add(nudge.id);
        trackProactiveOutcome("smart_nudge", "shown", { nudgeType: nudge.type, nudgeId: nudge.id });
      }
    } else {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsExiting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nudge]);

  // Auto-dismiss low priority nudges after 10 seconds. This is a passive
  // timeout, not an explicit signal, so it doesn't record feedback.
  useEffect(() => {
    if (nudge && nudge.priority === "low") {
      const timer = setTimeout(() => {
        close();
      }, 10000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);

  // Animate out, then clear the active nudge.
  const close = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(nudge?.id);
    }, 300);
  };

  const handleDismiss = () => {
    if (nudge) onFeedback?.(nudge, "dismissed");
    close();
  };

  const handleMute = () => {
    if (nudge) onMute?.(nudge);
  };

  const handleAction = () => {
    if (nudge) onFeedback?.(nudge, "accepted");
    if (nudge?.action?.onClick) {
      nudge.action.onClick();
    }
    close();
  };

  if (!isVisible || !nudge) return null;

  const Icon = NUDGE_ICONS[nudge.type as keyof typeof NUDGE_ICONS];
  const borderColor = NUDGE_COLORS[nudge.type as keyof typeof NUDGE_COLORS];

  return (
    <div
      className={cn(
        "fixed bottom-24 left-4 right-4 z-50 transition-all duration-300 md:left-auto md:right-4 md:max-w-sm",
        isExiting ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0",
      )}
    >
      <Card className={cn("border-l-4 shadow-lg bg-card/95 backdrop-blur-sm", borderColor)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "p-2 rounded-full shrink-0",
                nudge.priority === "high"
                  ? "bg-destructive/10 text-destructive"
                  : nudge.priority === "medium"
                    ? "bg-warning/10 text-warning"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm">{nudge.title}</h4>
                {nudge.dismissable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={handleDismiss}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{nudge.message}</p>

              {/* "Why am I seeing this?" — transparency for proactive nudges. */}
              {nudge.reason && showWhy && (
                <p className="text-xs text-muted-foreground/80 mt-2 rounded-md bg-muted/50 p-2">
                  {nudge.reason}
                </p>
              )}

              <div className="flex items-center gap-3 mt-3">
                {nudge.action && (
                  <Button size="sm" onClick={handleAction}>
                    {nudge.action.label}
                  </Button>
                )}
                {nudge.reason && (
                  <button
                    type="button"
                    onClick={() => setShowWhy((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    {showWhy ? "Hide" : "Why this?"}
                  </button>
                )}
                {onMute && (
                  <button
                    type="button"
                    onClick={handleMute}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <BellOff className="w-3.5 h-3.5" />
                    Don't show these
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
