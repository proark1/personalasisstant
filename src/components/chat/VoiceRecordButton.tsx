import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecordButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  formatDuration: (seconds: number) => string;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
}

export function VoiceRecordButton({
  isRecording,
  isProcessing,
  duration,
  formatDuration,
  onStart,
  onStop,
  onCancel,
}: VoiceRecordButtonProps) {
  if (isProcessing) {
    return (
      <Button variant="ghost" size="icon" disabled aria-label="Processing voice recording">
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1 bg-destructive/10 rounded-full">
          <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
          <span className="text-xs font-mono text-destructive">{formatDuration(duration)}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <span className="text-xs">Cancel</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={onStop}
          className="rounded-full"
          aria-label="Stop and send voice recording"
        >
          <Square className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onStart}
      className={cn("transition-colors", "hover:bg-primary/10 hover:text-primary")}
      aria-label="Record voice message"
    >
      <Mic className="w-4 h-4" />
    </Button>
  );
}
