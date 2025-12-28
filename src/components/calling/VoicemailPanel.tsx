import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Voicemail as VoicemailIcon, 
  Play, 
  Pause, 
  Trash2, 
  Clock,
  FileText
} from 'lucide-react';
import { useCallFeatures, Voicemail } from '@/hooks/useCallFeatures';
import { format } from 'date-fns';

interface VoicemailPanelProps {
  userId: string;
}

export function VoicemailPanel({ userId }: VoicemailPanelProps) {
  const { voicemails, markVoicemailRead, deleteVoicemail } = useCallFeatures();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const handlePlay = (voicemail: Voicemail) => {
    if (playingId === voicemail.id) {
      audioRef?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef) {
      audioRef.pause();
    }

    const audio = new Audio(voicemail.audioUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    setAudioRef(audio);
    setPlayingId(voicemail.id);

    if (!voicemail.isRead) {
      markVoicemailRead(voicemail.id);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const unreadCount = voicemails.filter(v => !v.isRead).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <VoicemailIcon className="w-5 h-5" />
            Voicemail
          </CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} new</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {voicemails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <VoicemailIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>No voicemails</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {voicemails.map((vm) => (
                <div
                  key={vm.id}
                  className={`p-3 rounded-lg border ${
                    !vm.isRead ? 'bg-accent/50 border-primary/20' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {getInitials(vm.callerName || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{vm.callerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(vm.createdAt, 'MMM d, h:mm a')}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDuration(vm.durationSeconds)}
                      </div>

                      {vm.transcription && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <FileText className="w-3 h-3" />
                            Transcription
                          </div>
                          <p className="line-clamp-2">{vm.transcription}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        <Button
                          size="sm"
                          variant={playingId === vm.id ? "default" : "outline"}
                          onClick={() => handlePlay(vm)}
                        >
                          {playingId === vm.id ? (
                            <>
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Play
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteVoicemail(vm.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
