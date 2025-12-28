import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Pin, 
  Star, 
  Clock, 
  Calendar,
  MessageCircle,
  X,
  Send
} from 'lucide-react';
import { useMessageFeatures, ScheduledMessage } from '@/hooks/useMessageFeatures';
import { format } from 'date-fns';

interface SavedMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessageSelect?: (messageId: string) => void;
}

export function SavedMessagesDialog({
  open,
  onOpenChange,
  onMessageSelect,
}: SavedMessagesDialogProps) {
  const [activeTab, setActiveTab] = useState<'starred' | 'scheduled'>('starred');
  const { 
    starredMessages, 
    scheduledMessages,
    unstarMessage,
    cancelScheduledMessage 
  } = useMessageFeatures();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved Messages</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="starred" className="gap-2">
              <Star className="w-4 h-4" />
              Starred ({starredMessages.length})
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Clock className="w-4 h-4" />
              Scheduled ({scheduledMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="starred" className="mt-4">
            <ScrollArea className="h-[300px]">
              {starredMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No starred messages</p>
                  <p className="text-sm">Star important messages to find them here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {starredMessages.map((msg) => (
                    <Card key={msg.id} className="cursor-pointer hover:bg-accent/50">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div 
                            className="flex-1"
                            onClick={() => onMessageSelect?.(msg.messageId)}
                          >
                            <Badge variant="secondary" className="mb-2">
                              {msg.messageType}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {format(msg.createdAt, 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => unstarMessage(msg.messageId, msg.messageType)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="scheduled" className="mt-4">
            <ScrollArea className="h-[300px]">
              {scheduledMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>No scheduled messages</p>
                  <p className="text-sm">Schedule messages to send later</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledMessages.map((msg) => (
                    <Card key={msg.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm line-clamp-2 mb-2">{msg.content}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(msg.scheduledFor, 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => cancelScheduledMessage(msg.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
