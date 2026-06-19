import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard, GlassCardContent } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Mic, X, Send, Inbox, Brain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBrainDump } from "@/hooks/useBrainDump";
import { BrainDumpInbox } from "./BrainDumpInbox";
import { supabase } from "@/integrations/supabase/client";
import { describeEdgeError } from "@/lib/edgeError";
import { toast } from "sonner";

interface BrainDumpFABProps {
  className?: string;
  collapsed?: boolean;
}

export function BrainDumpFAB({ className, collapsed: _collapsed = false }: BrainDumpFABProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isMountedRef = useRef(true);

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
    setText("");
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setIsExpanded(false);
      setText("");
    }
  };

  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // iOS Safari doesn't support audio/webm in MediaRecorder; fall back to
      // audio/mp4 (which the platform accepts) so iPhone users aren't locked
      // out of voice capture.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const recorderStream = stream;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        recorderStream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        audioChunksRef.current = [];
        if (blob.size === 0) return;
        await transcribeAndAppend(blob);
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err) {
      // If MediaRecorder construction fails AFTER getUserMedia succeeded, the
      // mic stream stays open until the page is reloaded. Stop it explicitly.
      stream?.getTracks().forEach((t) => t.stop());
      console.error("mic error", err);
      toast.error("Microphone access denied or unsupported");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const transcribeAndAppend = async (blob: Blob) => {
    if (isMountedRef.current) setIsTranscribing(true);
    try {
      // voice-to-text expects a base64-encoded audio payload (see NotesPanel
      // for the same pattern). Decoded server-side with the chunk-aware
      // helper to avoid the 32 KB atob() limit on long clips.
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("voice-to-text", {
        body: { audio: base64Audio },
      });
      // The recorder's onstop fires from the unmount cleanup too, so a
      // transcription request can resolve after this component is gone.
      // Guard every state update against that to silence the React warning
      // and avoid wasted re-renders.
      if (!isMountedRef.current) return;
      if (error) throw error;
      if (data?.text) {
        setText((prev) => (prev ? `${prev} ${data.text}` : data.text));
      } else {
        toast.error("No speech detected");
      }
    } catch (err) {
      console.error("transcribe error", err);
      if (isMountedRef.current)
        toast.error(await describeEdgeError(err, "Could not transcribe audio"));
    } finally {
      if (isMountedRef.current) setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  useEffect(() => {
    return () => {
      // Stop the recorder if the component unmounts mid-recording so we don't
      // leak a live MediaStream + microphone access. Mark unmounted so any
      // in-flight transcription doesn't try to setState after teardown.
      isMountedRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Check if we're in menu mode (not floating)
  const isMenuMode = className?.includes("static");

  if (isInboxOpen) {
    return <BrainDumpInbox isOpen={isInboxOpen} onClose={() => setIsInboxOpen(false)} />;
  }

  // Menu mode: render as a simple button that opens expanded input inline
  if (isMenuMode) {
    return (
      <div className={cn("relative", className)}>
        {isExpanded && (
          <GlassCard className="absolute top-full right-0 mt-2 w-72 shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
            <GlassCardContent className="p-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => {
                    setIsExpanded(false);
                    setText("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>

                <Input
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Quick thought..."
                  className="flex-1 h-8 text-sm"
                />

                <Button
                  size="icon"
                  className="shrink-0 h-8 w-8"
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
              <p className="text-xs text-muted-foreground mt-2 px-1">AI will categorize this 🧠</p>
            </GlassCardContent>
          </GlassCard>
        )}

        <div className="flex items-center gap-1">
          {unprocessedCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              onClick={() => setIsInboxOpen(true)}
            >
              <Inbox className="w-4 h-4" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              >
                {unprocessedCount}
              </Badge>
            </Button>
          )}

          <Button
            variant={isExpanded ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <Brain className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Original floating FAB mode
  return (
    <div className={cn("fixed bottom-20 right-4 z-40", className)}>
      {/* Expanded Input */}
      {isExpanded && (
        <GlassCard className="mb-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200">
          <GlassCardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => {
                  setIsExpanded(false);
                  setText("");
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
                className={cn("shrink-0", isRecording && "text-destructive animate-pulse")}
                onClick={toggleRecording}
                disabled={isTranscribing}
                aria-label={isRecording ? "Stop recording" : "Start voice capture"}
              >
                {isTranscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
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
          </GlassCardContent>
        </GlassCard>
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
              : "bg-gradient-to-br from-primary to-accent",
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Brain className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
