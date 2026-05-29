import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useNextUp } from '@/hooks/useNextUp';
import { Mic, Send, Sparkles, Loader2, Calendar, CheckSquare, ArrowRight } from 'lucide-react';
import doriFish from '@/assets/dori-fish.png';

interface DoriBarProps {
  /** Reflects whether Dori is currently processing a request. */
  isProcessing?: boolean;
  /** Short status string shown while Dori works (e.g. "Creating task…"). */
  thinkingStatus?: string;
  /** Opens full voice mode. */
  onVoiceMode: () => void;
  /** Hide the bar (e.g. when the user is already in the full assistant panel). */
  hidden?: boolean;
}

/**
 * The persistent "Dori spine" — an always-present bar at the bottom of every
 * screen. You can ask Dori anything from anywhere (it routes to the assistant
 * and runs the full 71-tool brain via the existing `dori:ask` event), reach
 * voice in one tap, and see your next proactive item inline. This is what makes
 * Dori the app's nervous system rather than one panel among many.
 */
export function DoriBar({ isProcessing, thinkingStatus, onVoiceMode, hidden }: DoriBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { items } = useNextUp(1);
  const next = items[0];

  const ask = useCallback((prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    // Reuse the universal Dori input contract: StandardMode listens for this,
    // routes to the assistant panel, and streams the full brain + tool calls.
    window.dispatchEvent(new CustomEvent('dori:ask', { detail: { text: trimmed } }));
    setText('');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(text);
    }
  };

  const openNext = () => {
    if (!next) return;
    window.dispatchEvent(
      new CustomEvent('dori:open-entity', { detail: { type: next.type, id: next.id } }),
    );
  };

  if (hidden) return null;

  return (
    <div className="shrink-0 px-3 md:px-5 pb-3">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 backdrop-blur-lg shadow-sm px-2.5 py-1.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 overflow-hidden">
          {isProcessing
            ? <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
            : <img src={doriFish} alt="" aria-hidden="true" className="w-6 h-6 object-contain" />}
        </div>

        {isProcessing ? (
          <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
            {thinkingStatus || 'Dori is working…'}
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Dori anything…"
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
          </>
        )}

        <button
          type="button"
          onClick={onVoiceMode}
          aria-label="Talk to Dori"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Mic className="w-4 h-4" />
        </button>

        {text.trim() && !isProcessing && (
          <button
            type="button"
            onClick={() => ask(text)}
            aria-label="Send to Dori"
            className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
        {!text.trim() && !isProcessing && (
          <Sparkles className="w-4 h-4 text-primary/40 shrink-0 mr-1" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
