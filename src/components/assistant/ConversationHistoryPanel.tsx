import { useState, useEffect } from 'react';
import { useAssistantConversations, AssistantConversation, AssistantMessage } from '@/hooks/useAssistantConversations';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { 
  History, 
  MessageSquare, 
  Lightbulb, 
  ChevronLeft, 
  Trash2, 
  User, 
  Bot,
  Loader2,
  RefreshCw
} from 'lucide-react';

interface ConversationHistoryPanelProps {
  onClose?: () => void;
}

export function ConversationHistoryPanel({ onClose }: ConversationHistoryPanelProps) {
  const { 
    conversations, 
    loading, 
    fetchConversations, 
    fetchMessages, 
    deleteConversation 
  } = useAssistantConversations();
  
  const [selectedConversation, setSelectedConversation] = useState<AssistantConversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = async (conversation: AssistantConversation) => {
    setSelectedConversation(conversation);
    setLoadingMessages(true);
    const msgs = await fetchMessages(conversation.id);
    setMessages(msgs);
    setLoadingMessages(false);
  };

  const handleBack = () => {
    setSelectedConversation(null);
    setMessages([]);
  };

  const handleDelete = async (conversationId: string) => {
    await deleteConversation(conversationId);
    if (selectedConversation?.id === conversationId) {
      handleBack();
    }
  };

  // Show conversation detail view
  if (selectedConversation) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="h-14 px-4 flex items-center gap-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">
              {selectedConversation.title || 'Conversation'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(selectedConversation.started_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
          {selectedConversation.is_startup_brainstorm && (
            <Badge variant="secondary" className="shrink-0">
              <Lightbulb className="w-3 h-3 mr-1" />
              Startup
            </Badge>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No messages recorded</p>
              <p className="text-xs text-muted-foreground mt-1">
                This conversation may not have been saved properly
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
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
                    <span className="text-[10px] text-muted-foreground mt-1 block opacity-70">
                      {format(new Date(message.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary if available */}
        {selectedConversation.summary && (
          <div className="p-4 border-t border-border bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{selectedConversation.summary}</p>
          </div>
        )}
      </div>
    );
  }

  // Show conversation list view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <History className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-medium text-sm">Conversation History</h3>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fetchConversations()}
          className="h-8 w-8"
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Conversation List */}
      <ScrollArea className="flex-1">
        {loading && conversations.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium mb-1">No conversations yet</h4>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Start talking to the AI assistant and your conversations will appear here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleSelectConversation(conversation)}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  conversation.is_startup_brainstorm 
                    ? "bg-amber-500/20" 
                    : "bg-primary/20"
                )}>
                  {conversation.is_startup_brainstorm ? (
                    <Lightbulb className="w-5 h-5 text-amber-500" />
                  ) : (
                    <MessageSquare className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">
                      {conversation.title || 'Voice Chat'}
                    </h4>
                    {conversation.is_startup_brainstorm && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Startup
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {conversation.summary || format(new Date(conversation.started_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(conversation.id);
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}