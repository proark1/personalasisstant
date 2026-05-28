import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { findRelevantContacts, ContactSuggestion } from '@/lib/contactSuggestions';
import { Send, Sparkles, User, Bot, Search, Mic, MicOff, Maximize2, Minimize2, Users, X, AudioLines } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { format } from 'date-fns';

const EMPTY_CONTACTS: Contact[] = [];

interface ProactiveStats {
  overdueTasks?: number;
  unreadEmails?: number;
  todayEvents?: number;
  pendingTasks?: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isProcessing: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onVoiceMode?: () => void;
  contacts?: Contact[];
  /** Live counts used to surface proactive opener prompts in the empty state. */
  proactiveStats?: ProactiveStats;
}

/**
 * Build opener suggestions tailored to what's actually pending right now, so
 * Dori's empty state nudges the user instead of showing generic examples.
 * Brings a slice of the (previously Telegram-only) proactivity into web chat.
 */
function buildOpenerSuggestions(stats?: ProactiveStats): string[] {
  const out: string[] = [];
  if (stats?.overdueTasks && stats.overdueTasks > 0) out.push('Reschedule my overdue tasks');
  if (stats?.todayEvents && stats.todayEvents > 0) out.push("Prep me for today's meetings");
  if (stats?.unreadEmails && stats.unreadEmails > 0) out.push('Summarize my unread emails');
  if (stats?.pendingTasks && stats.pendingTasks > 0) out.push('What should I focus on next?');
  // Always offer a couple of evergreen actions to round things out.
  for (const s of ['Plan my day', 'Add a task']) {
    if (out.length >= 4) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, 4);
}

export function ChatPanel({
  messages,
  onSendMessage,
  isProcessing,
  isFullscreen = false,
  onToggleFullscreen,
  onVoiceMode,
  contacts = EMPTY_CONTACTS,
  proactiveStats,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFinalTranscriptRef = useRef<string>('');

  // Voice recognition for text input
  const {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
  } = useVoiceRecognition({
    continuous: false,
  });

  // Handle final transcripts from voice recognition (avoid loops on iOS)
  useEffect(() => {
    if (!transcript || isListening) return;

    // Only append each final transcript once.
    if (lastFinalTranscriptRef.current === transcript) return;
    lastFinalTranscriptRef.current = transcript;

    setInput((prev) => prev + (prev ? ' ' : '') + transcript);
  }, [transcript, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
      setContactSuggestions([]);
      setDismissedSuggestions(false);
    }
  };

  // Check for contact suggestions when input changes
  useEffect(() => {
    if (input.length > 5 && contacts.length > 0 && !dismissedSuggestions) {
      const suggestions = findRelevantContacts(input, contacts);
      setContactSuggestions(suggestions);
    } else {
      setContactSuggestions([]);
    }
  }, [input, contacts, dismissedSuggestions]);

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
    } else {
      lastFinalTranscriptRef.current = '';
      startListening();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-medium text-sm">DarAI Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Search className="w-3 h-3" />
            <span>Search Grounded</span>
          </div>
          {onVoiceMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="voice_mode"
                    size="iconSm"
                    onClick={onVoiceMode}
                  >
                    <AudioLines className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Voice Mode</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>

      {/* Messages — aria-live so assistant replies are announced to AT users */}
      <div
        className="flex-1 overflow-y-auto p-4 space-y-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation with Dori"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">How can I help you?</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask me to manage tasks, schedule events, brainstorm ideas, or search the web.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {buildOpenerSuggestions(proactiveStats).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => onSendMessage(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-fade-in",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-3",
                  message.role === 'user' 
                    ? "bg-primary text-primary-foreground" 
                    : "glass-panel"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source, i) => (
                        <span key={i} className="text-xs text-primary underline cursor-pointer">
                          [{i + 1}]
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {format(message.timestamp, 'HH:mm')}
                </span>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isProcessing && (
          <div className="flex gap-3 animate-fade-in" aria-label="Dori is thinking">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div className="glass-panel rounded-xl px-4 py-3">
              <div className="flex gap-1" aria-hidden="true">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Contact Suggestions */}
      {contactSuggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>Relevant contacts</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5"
              onClick={() => {
                setContactSuggestions([]);
                setDismissedSuggestions(true);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contactSuggestions.map((suggestion) => (
              <div 
                key={suggestion.contact.id}
                className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border text-xs"
              >
                <span className="font-medium">{suggestion.contact.name}</span>
                {suggestion.contact.role && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {suggestion.contact.role}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice transcript indicator */}
      {isListening && transcript && (
        <div className="px-4 py-2 bg-primary/10 text-sm text-primary">
          <Mic className="w-3 h-3 inline mr-2 animate-pulse" />
          {transcript}...
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border safe-area-bottom">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Listening..." : "Ask DarAI anything..."}
            className="flex-1 bg-muted border-0"
            disabled={isProcessing || isListening}
          />
          {isSupported && (
            <Button 
              type="button" 
              variant={isListening ? "default" : "outline"}
              size="icon"
              className={cn("shrink-0", isListening && "animate-pulse bg-primary")}
              onClick={toggleVoiceInput}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Button type="submit" size="icon" className="shrink-0" disabled={!input.trim() || isProcessing}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
