import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import {
  Volume2,
  VolumeX,
  RefreshCw,
  ListTodo,
  Calendar,
  Mail,
  FileText,
  Users,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const highlightIcons: Record<string, typeof ListTodo> = {
  task: ListTodo,
  calendar: Calendar,
  email: Mail,
  contract: FileText,
  contact: Users,
  habit: Target,
};

const highlightColors: Record<string, string> = {
  task: "bg-primary/10 text-primary",
  calendar: "bg-accent/10 text-accent-foreground",
  email: "bg-amber-500/10 text-amber-600",
  contract: "bg-destructive/10 text-destructive",
  contact: "bg-emerald-500/10 text-emerald-600",
  habit: "bg-indigo-500/10 text-indigo-600",
};

export function DailyBriefingCard() {
  const { briefing, loading, error, refresh } = useDailyBriefing();
  const { speak, stop, isSpeaking, isLoading: ttsLoading } = useTextToSpeech();

  const handlePlayPause = () => {
    if (isSpeaking) {
      stop();
    } else if (briefing?.briefingText) {
      speak(briefing.briefingText);
    }
  };

  if (loading && !briefing) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[70%]" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (error && !briefing) {
    return null; // Silently fail - don't clutter dashboard
  }

  if (!briefing) return null;

  return (
    <GlassCard className="overflow-hidden">
      <GlassCardContent className="p-4 space-y-3">
        {/* Header with play button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Daily Briefing
              </p>
              <p className="text-[10px] text-muted-foreground">by Dori</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePlayPause}
              disabled={ttsLoading}
            >
              {ttsLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSpeaking ? (
                <VolumeX className="w-4 h-4 text-primary" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Briefing text */}
        <p className="text-sm text-foreground/80 leading-relaxed">{briefing.briefingText}</p>

        {/* Highlight chips */}
        {briefing.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {briefing.highlights.map((h, i) => {
              const Icon = highlightIcons[h.type] || ListTodo;
              const colorClass = highlightColors[h.type] || "bg-muted text-muted-foreground";
              return (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-medium",
                    colorClass,
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {h.label}
                </span>
              );
            })}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
