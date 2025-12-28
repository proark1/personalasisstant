import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, MessageCircle } from 'lucide-react';
import { useMessageFeatures } from '@/hooks/useMessageFeatures';
import { format } from 'date-fns';

interface MessageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatPartnerId?: string;
  onMessageSelect?: (messageId: string) => void;
}

export function MessageSearchDialog({ 
  open, 
  onOpenChange, 
  chatPartnerId,
  onMessageSelect 
}: MessageSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { searchMessages } = useMessageFeatures();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const data = await searchMessages(query, chatPartnerId);
    setResults(data);
    setSearching(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Messages
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Search messages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        <ScrollArea className="h-[300px] mt-4">
          {results.length === 0 && query && !searching && (
            <p className="text-center text-muted-foreground py-8">No messages found</p>
          )}
          
          {results.map((message) => (
            <div
              key={message.id}
              className="p-3 border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={() => {
                onMessageSelect?.(message.id);
                onOpenChange(false);
              }}
            >
              <div className="flex items-start gap-2">
                <MessageCircle className="w-4 h-4 mt-1 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-clamp-2">{message.content}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>

        {results.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {results.length} message{results.length !== 1 ? 's' : ''} found
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
