import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  typingUsers: { id: string; name: string }[];
  className?: string;
}

export function TypingIndicator({ typingUsers, className }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
    } else {
      return `${typingUsers.length} people are typing`;
    }
  };

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <div className="flex gap-0.5">
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}
