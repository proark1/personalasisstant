import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, Send } from 'lucide-react';
import { useChatAI } from '@/hooks/useChatAI';
import { motion, AnimatePresence } from 'framer-motion';

interface SmartReplySuggestionsProps {
  messages: { role: 'user' | 'assistant'; content: string }[];
  lastMessage: string;
  onSelectReply: (reply: string) => void;
  visible: boolean;
}

export function SmartReplySuggestions({
  messages,
  lastMessage,
  onSelectReply,
  visible,
}: SmartReplySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const { getSmartReplies, loading } = useChatAI();

  useEffect(() => {
    if (visible && lastMessage && !dismissed) {
      const fetchSuggestions = async () => {
        const replies = await getSmartReplies(messages, lastMessage);
        setSuggestions(replies);
      };
      fetchSuggestions();
    }
  }, [visible, lastMessage, messages, dismissed, getSmartReplies]);

  if (!visible || dismissed || suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="px-4 py-2 border-t border-border bg-accent/30"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            Smart Replies
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setDismissed(true)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {loading ? (
            <Badge variant="secondary" className="animate-pulse">
              Generating suggestions...
            </Badge>
          ) : (
            suggestions.map((reply, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors py-1.5 px-3"
                onClick={() => onSelectReply(reply)}
              >
                {reply}
              </Badge>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
