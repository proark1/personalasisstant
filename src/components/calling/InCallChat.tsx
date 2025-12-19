import { useState, useRef, useEffect } from 'react';
import { useInCallChat } from '@/hooks/useInCallChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface InCallChatProps {
  sessionId: string | null;
  userId: string;
  userName: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function InCallChat({ sessionId, userId, userName, isOpen, onToggle }: InCallChatProps) {
  const { messages, sendMessage } = useInCallChat(sessionId, userId);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input, userName);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed state - just show toggle button
  if (!isOpen) {
    return (
      <Button
        variant="secondary"
        size="icon"
        className="absolute bottom-4 left-4 z-10 rounded-full w-10 h-10 shadow-lg"
        onClick={onToggle}
      >
        <MessageCircle className="w-5 h-5" />
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
            {messages.length > 9 ? '9+' : messages.length}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="absolute bottom-4 left-4 z-10 w-72 h-80 bg-background/95 backdrop-blur-sm rounded-lg border border-border shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-medium">In-Call Chat</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const isOwn = msg.senderId === userId;
              return (
                <div
                  key={msg.id}
                  className={cn('flex flex-col max-w-[85%]', isOwn ? 'ml-auto items-end' : 'items-start')}
                >
                  {!isOwn && (
                    <span className="text-xs text-muted-foreground mb-0.5">{msg.senderName}</span>
                  )}
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm',
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                    )}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {format(msg.timestamp, 'HH:mm')}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2 p-2 border-t border-border">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="h-8 text-sm"
        />
        <Button 
          size="icon" 
          className="h-8 w-8 shrink-0" 
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
