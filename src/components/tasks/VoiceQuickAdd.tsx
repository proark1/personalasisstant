import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface VoiceQuickAddProps {
  onVoiceCommand: (text: string) => void;
  className?: string;
}

export function VoiceQuickAdd({ onVoiceCommand, className }: VoiceQuickAddProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<{ start(): void; stop(): void; abort(): void } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const result = event.results[current];
      if (!result || result.length === 0) return;
      const transcriptText = result[0].transcript;
      setTranscript(transcriptText);

      if (result.isFinal) {
        setIsListening(false);
        setTranscript('');
        onVoiceCommand(transcriptText);
        toast({
          title: 'Processing...',
          description: `"${transcriptText}"`,
        });
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setTranscript('');
      
      if (event.error !== 'no-speech') {
        toast({
          variant: 'destructive',
          title: 'Voice Error',
          description: 'Could not recognize speech. Please try again.',
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [onVoiceCommand, toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({
        variant: 'destructive',
        title: 'Not Supported',
        description: 'Voice recognition is not supported in this browser.',
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Transcript bubble */}
      {transcript && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-3 py-2 shadow-lg max-w-xs">
          <p className="text-sm text-foreground">{transcript}</p>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-card border-r border-b border-border" />
        </div>
      )}

      {/* Floating mic button */}
      <Button
        onClick={toggleListening}
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-all",
          isListening 
            ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
            : "bg-primary hover:bg-primary/90"
        )}
      >
        {isListening ? (
          <MicOff className="w-6 h-6" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </Button>

      {/* Listening indicator */}
      {isListening && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
          <Loader2 className="w-3 h-3 animate-spin" />
          Listening...
        </div>
      )}
    </div>
  );
}
