import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckSquare, 
  StickyNote, 
  Calendar, 
  Trash2, 
  ArrowRight,
  Sparkles,
  Loader2,
  Inbox,
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBrainDump, BrainDump } from '@/hooks/useBrainDump';
import { format } from 'date-fns';

interface BrainDumpInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_ICONS = {
  task: CheckSquare,
  note: StickyNote,
  event: Calendar,
  reminder: Calendar,
};

const TYPE_COLORS = {
  task: 'bg-primary/10 text-primary',
  note: 'bg-accent/10 text-accent',
  event: 'bg-warning/10 text-warning',
  reminder: 'bg-secondary/10 text-secondary',
};

export function BrainDumpInbox({ isOpen, onClose }: BrainDumpInboxProps) {
  const { dumps, isLoading, fetchDumps, convertDump, deleteDump } = useBrainDump();
  const [selectedDump, setSelectedDump] = useState<BrainDump | null>(null);
  const [editedTitle, setEditedTitle] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchDumps();
    }
  }, [isOpen, fetchDumps]);

  useEffect(() => {
    if (selectedDump) {
      setEditedTitle(selectedDump.ai_summary || selectedDump.content.slice(0, 50));
    }
  }, [selectedDump]);

  const handleConvert = async (type: 'task' | 'note' | 'event') => {
    if (!selectedDump) return;

    const data: Record<string, unknown> = {
      title: editedTitle || selectedDump.content.slice(0, 100),
      description: selectedDump.content,
    };

    if (type === 'task') {
      data.priority = selectedDump.suggested_priority || 'medium';
      data.category = selectedDump.suggested_category || 'personal';
    }

    if (type === 'event') {
      // Default to tomorrow at 10am
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      data.start_time = tomorrow.toISOString();
      data.end_time = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();
    }

    if (type === 'note') {
      data.content = selectedDump.content;
    }

    const success = await convertDump(selectedDump.id, type, data);
    if (success) {
      setSelectedDump(null);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDump(id);
    if (selectedDump?.id === id) {
      setSelectedDump(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="w-5 h-5" />
            Brain Dump Inbox
            {dumps.length > 0 && (
              <Badge variant="secondary">{dumps.length}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : dumps.length === 0 ? (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your brain dump inbox is empty
            </p>
          </div>
        ) : selectedDump ? (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDump(null)}
            >
              ← Back to list
            </Button>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Original Content</label>
                  <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-lg">
                    {selectedDump.content}
                  </p>
                </div>

                {selectedDump.suggested_type && (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      AI suggests: <Badge variant="outline" className="ml-1 capitalize">
                        {selectedDump.suggested_type}
                      </Badge>
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t space-y-2">
                  <p className="text-sm font-medium">Convert to:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => handleConvert('task')}
                    >
                      <CheckSquare className="w-5 h-5 mb-1" />
                      <span className="text-xs">Task</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => handleConvert('note')}
                    >
                      <StickyNote className="w-5 h-5 mb-1" />
                      <span className="text-xs">Note</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-auto py-3"
                      onClick={() => handleConvert('event')}
                    >
                      <Calendar className="w-5 h-5 mb-1" />
                      <span className="text-xs">Event</span>
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedDump.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2">
              {dumps.map((dump) => {
                const suggestedType = dump.suggested_type as keyof typeof TYPE_ICONS;
                const Icon = suggestedType ? TYPE_ICONS[suggestedType] : Sparkles;
                const colorClass = suggestedType ? TYPE_COLORS[suggestedType] : 'bg-muted text-muted-foreground';

                return (
                  <Card 
                    key={dump.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedDump(dump)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {dump.ai_summary || dump.content.slice(0, 50)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(dump.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
