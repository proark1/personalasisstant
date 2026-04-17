import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { findRelevantContacts, ContactSuggestion } from '@/lib/contactSuggestions';
import { ConversationHistoryPanel } from './ConversationHistoryPanel';
import { NextUpStrip } from './NextUpStrip';
import { AudioVisualizer } from '@/components/ghost/AudioVisualizer';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { ActionCard, ActionCardData } from './ActionCard';
import { Send, User, Mic, MicOff, Users, X, History, CheckSquare, Calendar, Search, Bell, Brain, ShoppingCart, BookOpen, Globe, ImagePlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import doriFish from '@/assets/dori-fish.png';

const EMPTY_CONTACTS: Contact[] = [];

export interface DoriStats {
  overdueTasks?: number;
  unreadEmails?: number;
  habitsAtRisk?: number;
  todayEvents?: number;
  pendingTasks?: number;
}

interface DoriPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, imageUrl?: string) => void;
  isProcessing: boolean;
  onVoiceMode: () => void;
  contacts?: Contact[];
  thinkingStatus?: string;
  actionCards?: ActionCardData[];
  stats?: DoriStats;
}

function getTimeSuggestions(stats?: DoriStats) {
  const hour = new Date().getHours();
  const suggestions: { label: string; icon: React.ElementType }[] = [];

  // Data-driven suggestions first
  if (stats?.overdueTasks && stats.overdueTasks > 0) {
    suggestions.push({ label: `I have ${stats.overdueTasks} overdue task${stats.overdueTasks > 1 ? 's' : ''}`, icon: CheckSquare });
  }
  if (stats?.unreadEmails && stats.unreadEmails > 0) {
    suggestions.push({ label: `Check my ${stats.unreadEmails} unread emails`, icon: Bell });
  }
  if (stats?.todayEvents && stats.todayEvents > 0) {
    suggestions.push({ label: "What's on my calendar today?", icon: Calendar });
  }

  // Fill remaining with time-based defaults
  if (hour < 12) {
    if (suggestions.length < 3) suggestions.push({ label: 'Plan my morning', icon: Calendar });
    if (suggestions.length < 3) suggestions.push({ label: 'Search latest news', icon: Globe });
  } else if (hour < 17) {
    if (suggestions.length < 3) suggestions.push({ label: 'How are my habits?', icon: Brain });
    if (suggestions.length < 3) suggestions.push({ label: 'Search something', icon: Search });
  } else {
    if (suggestions.length < 3) suggestions.push({ label: 'Review my day', icon: Brain });
    if (suggestions.length < 3) suggestions.push({ label: 'Plan tomorrow', icon: Calendar });
  }

  const greeting = hour < 12 ? "Good morning! What shall we tackle today?"
    : hour < 17 ? "Hey! Need help with anything?"
    : "Good evening! How can I help?";

  return { greeting, suggestions: suggestions.slice(0, 3) };
}

const capabilities = [
  { category: 'Productivity', items: ['Add tasks & events', 'Track habits', 'Manage projects'], icon: CheckSquare },
  { category: 'Life', items: ['Shopping lists', 'Meal planning', 'Contract reminders'], icon: ShoppingCart },
  { category: 'Knowledge', items: ['Web search', 'News & research', 'Remember things'], icon: BookOpen },
  { category: 'Reminders', items: ['Location-based', 'Follow-up nudges', 'Contact check-ins'], icon: Bell },
];

function ThinkingIndicator({ status }: { status?: string }) {
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
          {status ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">{status}</span>
            </>
          ) : (
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums">{elapsed}s</span>
        </div>
      </div>
    </div>
  );
}

export function DoriPanel({
  messages, onSendMessage, isProcessing, onVoiceMode, contacts = EMPTY_CONTACTS,
  thinkingStatus, actionCards, stats,
}: DoriPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [input, setInput] = useState('');
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const lastFinalTranscriptRef = useRef<string>('');

  const timeSuggestions = useMemo(() => getTimeSuggestions(stats), [stats]);

  const { isListening, isSupported, transcript, startListening, stopListening } = useVoiceRecognition({ continuous: false });

  useEffect(() => {
    if (!transcript || isListening) return;
    if (lastFinalTranscriptRef.current === transcript) return;
    lastFinalTranscriptRef.current = transcript;
    setInput((prev) => prev + (prev ? ' ' : '') + transcript);
  }, [transcript, isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, actionCards]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 96) + 'px';
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || pendingImage) && !isProcessing) {
      onSendMessage(input.trim(), pendingImage || undefined);
      setInput('');
      setPendingImage(null);
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB limit

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        setPendingImage(reader.result as string);
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
    }
    // Reset input so user can select same file again
    e.target.value = '';
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

      {/* Next-up live strip */}
      <NextUpStrip />

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
          messages.map((message, idx) => (
            <div key={message.id}>
              <div className={cn("flex gap-3 animate-fade-in", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                {message.role === 'assistant' && <img src={doriFish} alt="Dori" className="w-8 h-8 object-contain shrink-0" />}
                <div className={cn("max-w-[80%] rounded-xl px-4 py-3", message.role === 'user' ? "bg-primary text-primary-foreground" : "glass-panel")}>
                  {/* Show attached image if present */}
                  {message.role === 'user' && (message as any).imageUrl && (
                    <img src={(message as any).imageUrl} alt="Attached" className="rounded-lg mb-2 max-h-40 object-contain" />
                  )}
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
              {/* Render action cards after the last assistant message */}
              {message.role === 'assistant' && idx === messages.length - 1 && actionCards && actionCards.length > 0 && (
                <div className="ml-11 space-y-1">
                  {actionCards.map((card, i) => (
                    <ActionCard key={i} data={card} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {isProcessing && <ThinkingIndicator status={thinkingStatus} />}
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

      {/* Pending image preview */}
      {pendingImage && (
        <div className="px-4 py-2 border-t border-border">
          <div className="relative inline-block">
            <img src={pendingImage} alt="To send" className="h-16 rounded-lg object-contain" />
            <button className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs" onClick={() => setPendingImage(null)}>
              <X className="w-3 h-3" />
            </button>
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
          {/* Image upload */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => imageInputRef.current?.click()}
            disabled={isProcessing || uploadingImage}
          >
            {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          </Button>

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
            <Button type="submit" size="icon" className="h-7 w-7" disabled={(!input.trim() && !pendingImage) || isProcessing}>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
