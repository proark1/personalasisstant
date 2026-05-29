import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useNextUp } from '@/hooks/useNextUp';
import { useDoriConversation } from '@/contexts/DoriConversationContext';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { ActionCard } from './ActionCard';
import { Mic, Send, Sparkles, Loader2, Calendar, CheckSquare, ArrowRight, X, Maximize2, Square, Headphones } from 'lucide-react';
import doriFish from '@/assets/dori-fish.png';

interface DoriBarProps {
  /** Opens full (realtime) voice mode. */
  onVoiceMode: () => void;
  /** Hide the bar (e.g. when the user is already in the full assistant panel). */
  hidden?: boolean;
}

/**
 * The persistent "Dori spine" — an always-present bar at the bottom of every
 * screen. Ask Dori anything (typed or spoken) from anywhere; the reply and any
 * action cards stream into an inline popover so you never leave your current
 * panel. The mic does inline push-to-talk dictation (Web Speech API) and only
 * falls back to full-screen voice when dictation isn't supported. Backed by
 * DoriConversationContext, so it drives the same 71-tool brain Index owns.
 */
export function DoriBar({ onVoiceMode, hidden }: DoriBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { items } = useNextUp(1);
  const next = items[0];
  const dori = useDoriConversation();
  const { messages, isProcessing, thinkingStatus, actionCards, isOpen, open, close, send } = dori;

  const ask = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    send(trimmed);
    setText('');
  }, [send]);

  // Inline push-to-talk: transcribe speech into the bar and auto-send the final
  // result, so you can talk to Dori without the full-screen voice swap.
  const { isListening, isSupported: voiceSupported, startListening, stopListening } = useVoiceRecognition({
    continuous: false,
    onTranscript: (transcript, isFinal) => {
      setText(transcript);
      if (isFinal && transcript.trim()) ask(transcript);
    },
  });

  const handleMic = () => {
    // No Web Speech API (e.g. some browsers) → fall back to full voice mode.
    if (!voiceSupported) { onVoiceMode(); return; }
    if (isListening) stopListening();
    else { setText(''); startListening(); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(text);
    }
  };

  const openNext = () => {
    if (!next) return;
    window.dispatchEvent(new CustomEvent('dori:open-entity', { detail: { type: next.type, id: next.id } }));
  };

  // Expand the inline conversation into the full assistant panel.
  const expand = () => {
    window.dispatchEvent(new CustomEvent('dori:open-assistant'));
    close();
  };

  // Keep the popover pinned to the latest message / thinking state.
  useEffect(() => {
    const el = scrollRef.current;
    if (isOpen && el) el.scrollTop = el.scrollHeight;
  }, [isOpen, messages, isProcessing]);

  if (hidden) return null;

  const recent = messages.slice(-6);
  const showPopover = isOpen && (recent.length > 0 || isProcessing);

  return (
    <div className="shrink-0 px-3 md:px-5 pb-3">
      {/* Inline conversation popover */}
      {showPopover && (
        <div className="mb-2 rounded-2xl border border-border bg-card/95 backdrop-blur-lg shadow-lg overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <div className="flex items-center gap-2">
              <img src={doriFish} alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
              <span className="text-sm font-semibold">Dori</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onVoiceMode} aria-label="Full voice mode"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Headphones className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={expand} aria-label="Open full assistant"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={close} aria-label="Close Dori conversation"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[40vh] overflow-y-auto px-3 py-3 space-y-3">
            {recent.map((m, i) => (
              <div key={m.id ?? i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                )}>
                  {m.role === 'assistant'
                    ? <MarkdownRenderer content={m.content} />
                    : <span className="whitespace-pre-wrap">{m.content}</span>}
                </div>
              </div>
            ))}

            {/* Action results after the last assistant turn. */}
            {!isProcessing && actionCards.length > 0 && (
              <div className="space-y-1">
                {actionCards.map((card, i) => <ActionCard key={i} data={card} />)}
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {thinkingStatus || 'Dori is thinking…'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* The bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 backdrop-blur-lg shadow-sm px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => (isOpen ? close() : open())}
          aria-label={isOpen ? 'Hide Dori conversation' : 'Show Dori conversation'}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden"
        >
          {isProcessing
            ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            : <img src={doriFish} alt="" aria-hidden="true" className="w-6 h-6 object-contain" />}
        </button>

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Listening…' : 'Ask Dori anything…'}
          aria-label="Ask Dori anything"
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />

        {/* Proactive "next up" — only when the user isn't mid-typing. */}
        {next && !text && (
          <button
            type="button"
            onClick={openNext}
            className="hidden sm:inline-flex items-center gap-1.5 shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-foreground/80 hover:bg-primary/20 transition-colors max-w-[14rem]"
            aria-label={`Next up: ${next.title}`}
          >
            {next.type === 'event' ? <Calendar className="w-3 h-3 text-primary shrink-0" /> : <CheckSquare className="w-3 h-3 text-primary shrink-0" />}
            <span className="truncate">{next.title}</span>
            <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
          </button>
        )}

        <button
          type="button"
          onClick={handleMic}
          aria-label={isListening ? 'Stop listening' : 'Talk to Dori'}
          aria-pressed={isListening}
          className={cn(
            'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
            isListening
              ? 'bg-destructive/15 text-destructive animate-pulse'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          )}
        >
          {isListening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
        </button>

        {text.trim() ? (
          <button
            type="button"
            onClick={() => ask(text)}
            aria-label="Send to Dori"
            className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <Sparkles className="w-4 h-4 text-primary/40 shrink-0 mr-1" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
