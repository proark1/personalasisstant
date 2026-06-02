import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Headphones, Play, Pause, Square, Volume2, Loader2, Sun, Calendar, ListTodo, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefingData {
  weather?: { temp: number; description: string };
  tasks?: { id: string; title: string }[];
  events?: { id: string; title: string; start_time: string }[];
  news?: { headline: string }[];
}

interface AudioBriefingProps {
  briefing?: BriefingData;
  onClose?: () => void;
}

export function AudioBriefing({ briefing, onClose: _onClose }: AudioBriefingProps) {
  const [playing, setPlaying] = useState(false);
  // Reserved for async TTS generation; playback is currently synchronous so this stays false.
  const [loading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const generateBriefingScript = () => {
    if (!briefing) return 'No briefing data available.';

    const parts: string[] = [];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    parts.push(`${greeting}! Here's your daily briefing.`);

    if (briefing.weather) {
      parts.push(`The weather today is ${briefing.weather.description} with a temperature of ${Math.round(briefing.weather.temp)} degrees.`);
    }

    if (briefing.tasks && briefing.tasks.length > 0) {
      parts.push(`You have ${briefing.tasks.length} tasks today.`);
    }

    if (briefing.events && briefing.events.length > 0) {
      parts.push(`You have ${briefing.events.length} events scheduled.`);
    }

    parts.push("Have a productive day!");
    return parts.join(' ');
  };

  const handlePlay = () => {
    setPlaying(!playing);
    // Audio playback would be implemented with Web Speech API or TTS service
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Headphones className="w-5 h-5 text-primary" />
            Audio Briefing
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            <Volume2 className="w-3 h-3 mr-1" />
            AI Voice
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-3 py-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPlaying(false)}
            disabled={!playing}
            className="w-12 h-12 rounded-full"
          >
            <Square className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            onClick={handlePlay}
            disabled={loading}
            className="w-16 h-16 rounded-full"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : playing ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowTranscript(!showTranscript)}
            className={cn("w-12 h-12 rounded-full", showTranscript && "bg-primary/10")}
          >
            <Sun className="w-5 h-5" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-muted/50">
            <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg font-semibold">{briefing?.events?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Events</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <ListTodo className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-semibold">{briefing?.tasks?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Tasks</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <Cloud className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-semibold">{briefing?.weather?.temp ? `${Math.round(briefing.weather.temp)}°` : '--'}</p>
            <p className="text-xs text-muted-foreground">Weather</p>
          </div>
        </div>

        {showTranscript && (
          <ScrollArea className="h-48 rounded-lg border p-3">
            <p className="text-sm leading-relaxed">{generateBriefingScript()}</p>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
