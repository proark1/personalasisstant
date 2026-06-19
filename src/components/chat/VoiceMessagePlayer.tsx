import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceMessagePlayerProps {
  url: string;
  duration?: number;
  isOwn: boolean;
}

export function VoiceMessagePlayer({ url, duration = 0, isOwn }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg min-w-[180px]",
        isOwn ? "bg-primary-foreground/10" : "bg-background/50",
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={cn(
          "w-8 h-8 rounded-full flex-shrink-0",
          isOwn ? "hover:bg-primary-foreground/20" : "hover:bg-muted",
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </Button>

      <div className="flex-1 flex flex-col gap-1">
        <div
          className={cn(
            "h-1 rounded-full overflow-hidden",
            isOwn ? "bg-primary-foreground/20" : "bg-muted",
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOwn ? "bg-primary-foreground/60" : "bg-primary",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px]",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}
