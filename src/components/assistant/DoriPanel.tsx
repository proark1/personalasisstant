import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { findRelevantContacts, ContactSuggestion } from '@/lib/contactSuggestions';
import { ConversationHistoryPanel } from './ConversationHistoryPanel';
import { AudioVisualizer } from '@/components/ghost/AudioVisualizer';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { Send, User, Mic, MicOff, Users, X, History, CheckSquare, Calendar, Search, Bell, Brain, ShoppingCart, BookOpen, Globe } from 'lucide-react';
import { format } from 'date-fns';
import doriFish from '@/assets/dori-fish.png';

const EMPTY_CONTACTS: Contact[] = [];

interface DoriPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isProcessing: boolean;
  onVoiceMode: () => void;
  contacts?: Contact[];
}

function getTimeSuggestions() {
  const hour = new Date().getHours();
  if (hour < 12) return {
    greeting: "Good morning! What shall we tackle today?",
    suggestions: [
      { label: 'Plan my morning', icon: Calendar },
      { label: "What's on my calendar?", icon: Calendar },
      { label: 'Search latest news', icon: Globe },
    ],
  };
  if (hour < 17) return {
    greeting: "Hey! Need help with anything?",
    suggestions: [
      { label: 'Add a task', icon: CheckSquare },
      { label: 'Remind me in 30 min', icon: Bell },
      { label: 'Search something', icon: Search },
    ],
  };
  return {
    greeting: "Good evening! How can I help?",
    suggestions: [
      { label: 'Review my day', icon: Brain },
      { label: "What's left to do?", icon: CheckSquare },
      { label: 'Plan tomorrow', icon: Calendar },
    ],
  };
}

const capabilities = [
  { category: 'Productivity', items: ['Add tasks & events', 'Track habits', 'Manage projects'], icon: CheckSquare },
  { category: 'Life', items: ['Shopping lists', 'Meal planning', 'Contract reminders'], icon: ShoppingCart },
  { category: 'Knowledge', items: ['Web search', 'News & research', 'Remember things'], icon: BookOpen },
  { category: 'Reminders', items: ['Location-based', 'Follow-up nudges', 'Contact check-ins'], icon: Bell },
];

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex gap-3 animate-fade-in">
      <img src={doriFish} alt="Dori" className="w-8 h-8 object-contain shrink-0" />
      <div className="glass-panel rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{elapsed}s</span>
        </div>
      </div>
    </div>
  );
}

export function DoriPanel({
  messages, onSendMessage, isProcessing, onVoiceMode, contacts = EMPTY_CONTACTS,
}: DoriPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [input, setInput] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastFinalTranscriptRef = useRef<string>('');

  const timeSuggestions = useMemo(() => getTimeSuggestions(), []);

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceRecognition({ continuous: false });

  useEffect(() => {
    if (!transcript || isListening) return;
    if (lastFinalTranscriptRef.current === transcript) return;
    lastFinalTranscriptRef.current = transcript;
    setInput((prev) => prev + (prev ? ' ' : '') + transcript);
  }, [transcript, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'; // max 3 lines ~96px
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input.trim());
      setInput('');
      setContactSuggestions([]);
      setDismissedSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (input.length > 5 && contacts.length > 0 && !dismissedSuggestions) {
      setContactSuggestions(findRelevantContacts(input, contacts));
    } else {
      setContactSuggestions([]);
    }
  }, [input, contacts, dismissedSuggestions]);

  const toggleVoiceInput = () => {
    if (isListening) stopListening();
    else { lastFinalTranscriptRef.current = ''; startListening(); }
  };

  if (showHistory) return <ConversationHistoryPanel onClose={() => setShowHistory(false)} />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Dori</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(true)}>
            <History className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={onVoiceMode}>
            <Mic className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col justify-end text-center relative pb-0">
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <AudioVisualizer isActive={true} isSpeaking={false} isListening={false} />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <img src={doriFish} alt="Dori" className="w-16 h-16 object-contain mb-2 drop-shadow-lg animate-[bounce_3s_ease-in-out_infinite]" />
              <h3 className="text-base font-semibold mb-0.5">{timeSuggestions.greeting}</h3>
              <p className="text-xs text-muted-foreground max-w-xs mb-3">
                Powered by web search, memory, and your life data.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {timeSuggestions.suggestions.map((s) => (
                  <Button key={s.label} variant="outline" size="sm" className="text-xs bg-background/80 backdrop-blur-sm gap-1.5" onClick={() => setInput(s.label)}>
                    <s.icon className="w-3 h-3" />{s.label}
                  </Button>
                ))}
              </div>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2" onClick={() => setShowCapabilities(!showCapabilities)}>
                {showCapabilities ? 'Hide capabilities' : 'What can Dori do?'}
              </button>
              {showCapabilities && (
                <div className="grid grid-cols-2 gap-2 mt-3 text-left max-w-xs">
                  {capabilities.map((cap) => (
                    <div key={cap.category} className="p-2 rounded-lg border border-border/50 bg-background/80">
                      <div className="flex items-center gap-1.5 mb-1">
                        <cap.icon className="w-3 h-3 text-primary" />
                        <span className="text-xs font-medium">{cap.category}</span>
                      </div>
                      {cap.items.map((item) => (
                        <button key={item} className="block text-[10px] text-muted-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => setInput(item)}>
                          • {item}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn("flex gap-3 animate-fade-in", message.role === 'user' ? 'justify-end' : 'justify-start')}>
              {message.role === 'assistant' && <img src={doriFish} alt="Dori" className="w-8 h-8 object-contain shrink-0" />}
              <div className={cn("max-w-[80%] rounded-xl px-4 py-3", message.role === 'user' ? "bg-primary text-primary-foreground" : "glass-panel")}>
                {message.role === 'assistant' ? <MarkdownRenderer content={message.content} /> : <p className="text-sm whitespace-pre-wrap">{message.content}</p>}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Sources:</p>
                    <div className="flex flex-wrap gap-1">
                      {message.sources.map((source, i) => (
                        <a key={i} href={source} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-2 hover:text-primary/80">[{i + 1}]</a>
                      ))}
                    </div>
                  </div>
                )}
                <span className="text-[10px] text-muted-foreground mt-1 block">{format(message.timestamp, 'HH:mm')}</span>
              </div>
              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isProcessing && <ThinkingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Contact Suggestions */}
      {contactSuggestions.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3 h-3" /><span>Relevant contacts</span>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setContactSuggestions([]); setDismissedSuggestions(true); }}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {contactSuggestions.map((suggestion) => (
              <div key={suggestion.contact.id} className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border text-xs">
                <span className="font-medium">{suggestion.contact.name}</span>
                {suggestion.contact.role && <Badge variant="secondary" className="text-[10px] px-1 py-0">{suggestion.contact.role}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Voice transcript */}
      {isListening && transcript && (
        <div className="px-4 py-2 bg-primary/10 text-sm text-primary">
          <Mic className="w-3 h-3 inline mr-2 animate-pulse" />{transcript}...
        </div>
      )}

      {/* Input — expandable textarea */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-border pb-safe">
        <div className="relative flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Ask Dori anything..."}
            disabled={isProcessing || isListening}
            rows={1}
            className={cn(
              "flex-1 bg-transparent text-sm resize-none outline-none",
              "placeholder:text-muted-foreground",
              "min-h-[24px] max-h-[96px]",
              "disabled:opacity-50"
            )}
          />
          <div className="flex items-center gap-1 shrink-0 pb-0.5">
            {isSupported && (
              <Button
                type="button"
                variant={isListening ? "default" : "ghost"}
                size="icon"
                className={cn("h-7 w-7", isListening && "animate-pulse bg-primary")}
                onClick={toggleVoiceInput}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </Button>
            )}
            <Button type="submit" size="icon" className="h-7 w-7" disabled={!input.trim() || isProcessing}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
