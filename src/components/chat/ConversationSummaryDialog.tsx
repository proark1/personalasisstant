import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, FileText, Copy, Check } from 'lucide-react';
import { useChatAI } from '@/hooks/useChatAI';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  partnerName?: string;
}

export function ConversationSummaryDialog({
  open,
  onOpenChange,
  messages,
  partnerName,
}: ConversationSummaryDialogProps) {
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);
  const { summarizeConversation, loading } = useChatAI();

  const handleSummarize = async () => {
    const result = await summarizeConversation(messages);
    setSummary(result);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    toast.success('Summary copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Conversation Summary
            {partnerName && (
              <span className="text-muted-foreground font-normal">
                with {partnerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {messages.length} messages in this conversation
            </p>
            <Button onClick={handleSummarize} disabled={loading || messages.length === 0}>
              <Sparkles className="w-4 h-4 mr-2" />
              {loading ? 'Generating...' : 'Generate Summary'}
            </Button>
          </div>

          {summary && (
            <div className="p-4 bg-accent/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Summary
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[200px]">
                <p className="text-sm whitespace-pre-wrap">{summary}</p>
              </ScrollArea>
            </div>
          )}

          {!summary && messages.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No messages to summarize</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
