import { useState, useRef, useCallback, useEffect } from 'react';
import { useNotes, Note } from '@/hooks/useNotes';
import { NoteEditor } from './NoteEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlassCard } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { PanelShell, staggerItem } from '@/components/ui/panel-shell';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Search, 
  FileText, 
  Pin,
  RefreshCw,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { toast } from 'sonner';

interface NotesPanelProps {
  userId: string;
}

export function NotesPanel({ userId }: NotesPanelProps) {
  const { notes, loading, createNote, updateNote, deleteNote, searchNotes, refetch } = useNotes(userId);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  // Pending id for cross-component note-selection (global search → here).
  // We hold it until the corresponding row appears in `notes`, so the
  // first render after navigation auto-selects without flicker.
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const { t, language } = useLanguage();
  const dateLocale = language === 'de' ? de : enUS;

  // The global-search palette dispatches a `dori:select-note` event when
  // the user picks a note. We capture the id here; the resolution below
  // matches it against the loaded notes once they're available.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id) setPendingSelectId(detail.id);
    };
    window.addEventListener('dori:select-note', onSelect as EventListener);
    return () => window.removeEventListener('dori:select-note', onSelect as EventListener);
  }, []);

  useEffect(() => {
    if (!pendingSelectId) return;
    const match = notes.find((n) => n.id === pendingSelectId);
    if (match) {
      setSelectedNote(match);
      setPendingSelectId(null);
    }
  }, [pendingSelectId, notes]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleCreateNote = async () => {
    const newNote = await createNote();
    if (newNote) {
      setSelectedNote(newNote);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    searchNotes(query);
  };

  const handleNoteUpdate = async (noteId: string, updates: Partial<Pick<Note, 'title' | 'content' | 'linkedItems' | 'tags' | 'isPinned'>>) => {
    await updateNote(noteId, updates);
    // Update selected note if it's the one being edited
    if (selectedNote?.id === noteId) {
      setSelectedNote(prev => prev ? { ...prev, ...updates, updatedAt: new Date() } : null);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    await deleteNote(noteId);
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
  };

  const getPreviewText = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return t('notes.noContent');
    return lines[0].slice(0, 100) + (lines[0].length > 100 ? '...' : '');
  };

  // Voice recording functions
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started... Tap again to stop');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not start recording. Please check microphone permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Call edge function
      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      if (data?.text) {
        // Create a new note with the transcribed text
        const newNote = await createNote();
        if (newNote) {
          await updateNote(newNote.id, { 
            title: `Voice Note - ${new Date().toLocaleString()}`,
            content: data.text 
          });
          setSelectedNote({ ...newNote, title: `Voice Note - ${new Date().toLocaleString()}`, content: data.text });
          toast.success('Voice note created!');
        }
      } else {
        toast.error('No speech detected');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(await describeEdgeError(error, 'Failed to transcribe audio'));
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Show editor if a note is selected
  if (selectedNote) {
    return (
      <NoteEditor
        note={selectedNote}
        onUpdate={handleNoteUpdate}
        onDelete={handleNoteDelete}
        onBack={() => setSelectedNote(null)}
      />
    );
  }

  const searchExtra = (
    <div className="space-y-3">
      {isRecording && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
          <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
          <span className="text-sm text-destructive font-medium">Recording... Tap mic to stop</span>
        </div>
      )}
      {isTranscribing && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-primary font-medium">Transcribing audio...</span>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('notes.searchNotes')}
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );

  return (
    <PanelShell
      icon={FileText}
      title={t('notes.title')}
      loading={loading}
      empty={notes.length === 0}
      emptyIcon={FileText}
      emptyTitle={t('notes.noNotes')}
      emptyDescription={t('notes.createFirst')}
      emptyAction={
        <div className="flex gap-2">
          <Button variant="link" onClick={handleCreateNote}>
            {t('notes.createFirst')}
          </Button>
          <Button variant="outline" size="sm" onClick={toggleRecording} className="gap-1">
            <Mic className="w-4 h-4" />
            Voice Note
          </Button>
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={refetch}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            variant={isRecording ? "destructive" : "outline"}
            size="icon"
            onClick={toggleRecording}
            disabled={isTranscribing}
            title={isRecording ? "Stop recording" : "Create voice note"}
          >
            {isTranscribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
          <Button onClick={handleCreateNote} size="icon" title={t('notes.newNote')}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      }
      headerExtra={searchExtra}
    >
      <ScrollArea className="h-full">
        <div className="space-y-3">
          {notes.map(note => (
            <motion.div key={note.id} variants={staggerItem}>
              <GlassCard
                pressable
                haptic="light"
                className={cn(
                  "p-3 cursor-pointer",
                  note.isPinned && "border-primary/50 bg-primary/5"
                )}
                onClick={() => setSelectedNote(note)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.isPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
                      <h3 className="font-medium text-foreground truncate">{note.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {getPreviewText(note.content)}
                    </p>
                    
                    {note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {note.tags.slice(0, 3).map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{note.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(note.updatedAt, { addSuffix: true, locale: dateLocale })}
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </PanelShell>
  );
}
