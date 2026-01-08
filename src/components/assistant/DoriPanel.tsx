import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from '@/types/flux';
import { Contact } from '@/hooks/useContacts';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { findRelevantContacts, ContactSuggestion } from '@/lib/contactSuggestions';
import { useIsMobile } from '@/hooks/use-mobile';
import { ConversationHistoryPanel } from './ConversationHistoryPanel';
import { AudioVisualizer } from '@/components/ghost/AudioVisualizer';
import { Send, User, Bot, Mic, MicOff, MessageSquare, Users, X, History } from 'lucide-react';
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

type Mode = 'text' | 'voice';

export function DoriPanel({
  messages,
  onSendMessage,
  isProcessing,
  onVoiceMode,
  contacts = EMPTY_CONTACTS,
}: DoriPanelProps) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>('voice');
  const [showHistory, setShowHistory] = useState(false);
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

  // Auto-trigger voice mode on mount
  useEffect(() => {
    onVoiceMode();
  }, []);

  // Handle final transcripts from voice recognition
  useEffect(() => {
    if (!transcript || isListening) return;
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

  const handleModeSwitch = (newMode: Mode) => {
    if (newMode === 'voice') {
      onVoiceMode();
    }
    setMode(newMode);
  };

  // Show conversation history panel
  if (showHistory) {
    return <ConversationHistoryPanel onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2">
          <img src={doriFish} alt="Dori" className="w-10 h-10 object-contain" />
          <h3 className="font-semibold text-sm">Dori</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {/* History Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowHistory(true)}
          >
            <History className="w-4 h-4" />
          </Button>

          {/* Voice Mode Button - Only show when in text mode */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7"
            onClick={() => handleModeSwitch('voice')}
          >
            <Mic className="w-3.5 h-3.5" />
            {!isMobile && <span className="text-xs">Voice Mode</span>}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center relative">
            {/* Audio Visualizer Background */}
            <div className="absolute inset-0 flex items-center justify-center">
              <AudioVisualizer isActive={true} isSpeaking={false} isListening={false} />
            </div>
            
            {/* Content overlay */}
            <div className="relative z-10">
              <h3 className="text-lg font-medium mb-2">Hi, I'm Dori!</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your personal assistant. Ask me to manage tasks, schedule events, brainstorm ideas, or search the web.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {['Add a task', 'Schedule meeting', 'Search latest news'].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-background/80 backdrop-blur-sm"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
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
                <img src={doriFish} alt="Dori" className="w-8 h-8 object-contain shrink-0" />
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
          <div className="flex gap-3 animate-fade-in">
            <img src={doriFish} alt="Dori" className="w-8 h-8 object-contain shrink-0" />
            <div className="glass-panel rounded-xl px-4 py-3">
              <div className="flex gap-1">
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
            placeholder={isListening ? "Listening..." : "Ask Dori anything..."}
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
