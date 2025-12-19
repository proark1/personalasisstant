import { useState } from 'react';
import { useCallRecordings, CallRecording } from '@/hooks/useCallRecordings';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Play, 
  Pause,
  Download, 
  Trash2,
  Circle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useRef } from 'react';

interface CallRecordingsProps {
  userId: string;
}

export function CallRecordings({ userId }: CallRecordingsProps) {
  const { recordings, loading, refetch, deleteRecording } = useCallRecordings(userId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePlay = (recording: CallRecording) => {
    if (playingId === recording.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(recording.fileUrl);
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.play();
      setPlayingId(recording.id);
    }
  };

  const handleDownload = (recording: CallRecording) => {
    const link = document.createElement('a');
    link.href = recording.fileUrl;
    link.download = `call-recording-${recording.id}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteRecording(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Circle className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No recordings yet</p>
        <p className="text-xs mt-1">Call recordings will appear here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refetch}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {recordings.map(recording => {
            const otherName = recording.callerId === userId 
              ? recording.calleeName 
              : recording.callerName;
            const isPlaying = playingId === recording.id;
            
            return (
              <div 
                key={recording.id} 
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-destructive/10 text-destructive">
                    {getInitials(otherName || 'UN')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{otherName}</span>
                    <Circle className="w-2 h-2 fill-destructive text-destructive shrink-0" />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDuration(recording.durationSeconds)}</span>
                    {recording.fileSizeBytes && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(recording.fileSizeBytes)}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                    {formatDistanceToNow(recording.createdAt, { addSuffix: true })}
                  </span>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => handlePlay(recording)}
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(recording)}
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm(recording.id)}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The recording will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
