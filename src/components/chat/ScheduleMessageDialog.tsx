import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Send } from 'lucide-react';
import { format } from 'date-fns';
import { useMessageFeatures } from '@/hooks/useMessageFeatures';
import { cn } from '@/lib/utils';

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId?: string;
  recipientName?: string;
  groupId?: string;
  groupName?: string;
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  recipientId,
  recipientName,
  groupId,
  groupName,
}: ScheduleMessageDialogProps) {
  const [content, setContent] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('09:00');
  const [scheduling, setScheduling] = useState(false);
  const { scheduleMessage } = useMessageFeatures();

  const handleSchedule = async () => {
    if (!content.trim() || !date) return;

    setScheduling(true);
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledFor = new Date(date);
    scheduledFor.setHours(hours, minutes, 0, 0);

    await scheduleMessage(content, scheduledFor, recipientId, groupId);
    setScheduling(false);
    setContent('');
    setDate(undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Schedule Message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground text-sm">
              To: {recipientName || groupName || 'Select recipient'}
            </Label>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Type your message..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Time</Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleSchedule} 
            disabled={!content.trim() || !date || scheduling}
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            {scheduling ? 'Scheduling...' : 'Schedule Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
