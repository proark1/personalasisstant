import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuSeparator,
  ContextMenuTrigger 
} from '@/components/ui/context-menu';
import { 
  Pin, 
  Star, 
  Reply, 
  Copy, 
  Edit2, 
  Trash2, 
  Forward,
  Languages,
  StarOff,
  PinOff
} from 'lucide-react';
import { useMessageFeatures } from '@/hooks/useMessageFeatures';
import { toast } from 'sonner';

interface MessageContextMenuProps {
  children: React.ReactNode;
  messageId: string;
  messageContent: string;
  messageType: 'direct' | 'group';
  chatId: string;
  isOwnMessage: boolean;
  isPinned?: boolean;
  isStarred?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onForward?: () => void;
  onTranslate?: () => void;
}

export function MessageContextMenu({
  children,
  messageId,
  messageContent,
  messageType,
  chatId,
  isOwnMessage,
  isPinned,
  isStarred,
  onReply,
  onEdit,
  onForward,
  onTranslate,
}: MessageContextMenuProps) {
  const { 
    pinMessage, 
    unpinMessage, 
    starMessage, 
    unstarMessage,
    deleteMessage 
  } = useMessageFeatures();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(messageContent);
    toast.success('Message copied to clipboard');
  };

  const handlePin = async () => {
    if (isPinned) {
      await unpinMessage(messageId, messageType, chatId);
    } else {
      await pinMessage(messageId, messageType, chatId);
    }
  };

  const handleStar = async () => {
    if (isStarred) {
      await unstarMessage(messageId, messageType);
    } else {
      await starMessage(messageId, messageType);
    }
  };

  const handleDelete = async () => {
    await deleteMessage(messageId, messageType);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onReply}>
          <Reply className="w-4 h-4 mr-2" />
          Reply
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="w-4 h-4 mr-2" />
          Copy
        </ContextMenuItem>

        <ContextMenuItem onClick={onForward}>
          <Forward className="w-4 h-4 mr-2" />
          Forward
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handlePin}>
          {isPinned ? (
            <>
              <PinOff className="w-4 h-4 mr-2" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="w-4 h-4 mr-2" />
              Pin
            </>
          )}
        </ContextMenuItem>

        <ContextMenuItem onClick={handleStar}>
          {isStarred ? (
            <>
              <StarOff className="w-4 h-4 mr-2" />
              Unstar
            </>
          ) : (
            <>
              <Star className="w-4 h-4 mr-2" />
              Star
            </>
          )}
        </ContextMenuItem>

        <ContextMenuItem onClick={onTranslate}>
          <Languages className="w-4 h-4 mr-2" />
          Translate
        </ContextMenuItem>

        {isOwnMessage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit
            </ContextMenuItem>
            <ContextMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
