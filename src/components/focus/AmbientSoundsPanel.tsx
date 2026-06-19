import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAmbientSounds, AMBIENT_SOUNDS } from "@/hooks/useAmbientSounds";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AmbientSoundsPanelProps {
  className?: string;
}

export function AmbientSoundsPanel({ className }: AmbientSoundsPanelProps) {
  const { activeSound, isPlaying, volume, toggleSound, setVolume, stopSound } = useAmbientSounds();

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Ambient Sounds</h4>
        {isPlaying && (
          <Button variant="ghost" size="sm" onClick={stopSound} className="h-7 text-xs">
            <VolumeX className="w-3 h-3 mr-1" />
            Stop
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {AMBIENT_SOUNDS.map((sound) => (
          <Button
            key={sound.id}
            variant={activeSound === sound.id && isPlaying ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-auto py-3 flex-col gap-1",
              activeSound === sound.id && isPlaying && "ring-2 ring-primary ring-offset-2",
            )}
            onClick={() => toggleSound(sound.id)}
          >
            <span className="text-lg">{sound.icon}</span>
            <span className="text-xs">{sound.name}</span>
          </Button>
        ))}
      </div>

      {isPlaying && (
        <div className="flex items-center gap-3 pt-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            onValueChange={([val]) => setVolume(val / 100)}
            max={100}
            step={5}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}
