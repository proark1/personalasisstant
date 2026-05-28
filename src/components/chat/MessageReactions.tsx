import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageReaction {
  emoji: string;
  user_ids: string[];
}

interface MessageReactionsProps {
  reactions: MessageReaction[];
  userId: string;
  onReact: (emoji: string) => void;
  isOwn: boolean;
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

export function MessageReactions({ reactions, userId, onReact, isOwn }: MessageReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleReact = (emoji: string) => {
    onReact(emoji);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onReact(reaction.emoji)}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors',
            reaction.user_ids.includes(userId)
              ? 'bg-primary/20 border border-primary/30'
              : 'bg-muted/50 border border-transparent hover:bg-muted'
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="text-muted-foreground">{reaction.user_ids.length}</span>
        </button>
      ))}
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'inline-flex items-center justify-center w-6 h-6 rounded-full',
              'text-muted-foreground hover:bg-muted hover:text-foreground',
              'transition-colors opacity-0 group-hover:opacity-100'
            )}
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align={isOwn ? 'end' : 'start'}>
          <div className="flex gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
