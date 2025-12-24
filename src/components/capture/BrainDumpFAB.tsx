import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mic, X, Send, Inbox, Brain, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrainDump } from '@/hooks/useBrainDump';
import { BrainDumpInbox } from './BrainDumpInbox';

interface BrainDumpFABProps {
  className?: string;
}

export function BrainDumpFAB({ className }: BrainDumpFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { addDump, unprocessedCount, isProcessing, fetchDumps } = useBrainDump();

  useEffect(() => {
    fetchDumps();
  }, [fetchDumps]);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    
    await addDump(text);
    setText('');
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsExpanded(false);
      setText('');
    }
  };

  const toggleRecording = () => {
    // Voice recording would use the existing voice-to-text functionality
    setIsRecording(!isRecording);
    // TODO: Integrate with useVoiceRecorder hook
  };

  if (isInboxOpen) {
    return (
      <BrainDumpInbox
        isOpen={isInboxOpen}
        onClose={() => setIsInboxOpen(false)}
      />
    );
  }

  return (
    <div className={cn("fixed bottom-20 right-4 z-40", className)}>
      {/* Expanded Input */}
      {isExpanded && (
        <Card className="mb-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setIsExpanded(false);
                  setText('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
              
              <Input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Quick thought, task, anything..."
                className="flex-1"
              />
              
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "shrink-0",
                  isRecording && "text-destructive animate-pulse"
                )}
                onClick={toggleRecording}
              >
                <Mic className="w-4 h-4" />
              </Button>
              
              <Button
                size="icon"
                className="shrink-0"
                onClick={handleSubmit}
                disabled={!text.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 px-1">
              AI will categorize this for you 🧠
            </p>
          </CardContent>
        </Card>
      )}

      {/* FAB Buttons */}
      <div className="flex items-center gap-2">
        {/* Inbox Button */}
        {unprocessedCount > 0 && (
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-background relative"
            onClick={() => setIsInboxOpen(true)}
          >
            <Inbox className="w-5 h-5" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unprocessedCount}
            </Badge>
          </Button>
        )}

        {/* Main Brain Dump Button */}
        <Button
          size="icon"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg transition-all",
            isExpanded 
              ? "bg-muted text-muted-foreground" 
              : "bg-gradient-to-br from-primary to-accent"
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Brain className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
