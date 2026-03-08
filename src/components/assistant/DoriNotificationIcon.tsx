import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, X, Bell, Check, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProactiveReminders, ProactiveReminder } from '@/hooks/useProactiveReminders';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Map entity types to routes
const getEntityRoute = (reminder: ProactiveReminder): string | null => {
  const entityType = reminder.trigger_entity_type;
  const entityId = reminder.trigger_entity_id;
  
  if (!entityType) return null;
  
  switch (entityType) {
    case 'task':
      return '/?tab=tasks';
    case 'event':
      return '/?tab=calendar';
    case 'habit':
      return '/?tab=habits';
    case 'contact':
      return '/?tab=contacts';
    case 'health':
      return '/?tab=health';
    case 'contract':
      return '/contracts';
    default:
      return null;
  }
};

const getActionLabel = (reminder: ProactiveReminder): string => {
  const type = reminder.reminder_type?.toLowerCase() || '';
  if (type.includes('habit')) return 'Track';
  if (type.includes('task')) return 'View Task';
  if (type.includes('checkin')) return 'Fill In';
  if (type.includes('health')) return 'Log';
  if (type.includes('contact')) return 'Reach Out';
  return 'View';
};

export function DoriNotificationIcon() {
  const navigate = useNavigate();
  const { reminders, unreadCount, markAsRead, dismissReminder, snoozeReminder, completeReminder } = useProactiveReminders();
  const [open, setOpen] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && reminders.length > 0) {
      reminders.slice(0, 3).forEach(r => {
        if (!r.read_at) markAsRead(r.id);
      });
    }
  };

  const handleDismiss = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    dismissReminder(reminderId);
    toast.success('Reminder dismissed');
  };

  const handleComplete = (e: React.MouseEvent, reminder: ProactiveReminder) => {
    e.stopPropagation();
    completeReminder(reminder.id);
    toast.success('Marked as done!');
  };

  const handleSnooze = (e: React.MouseEvent, reminder: ProactiveReminder) => {
    e.stopPropagation();
    snoozeReminder(reminder.id, 1); // Snooze for 1 hour
    toast.success('Snoozed for 1 hour');
  };

  const handleAction = (e: React.MouseEvent, reminder: ProactiveReminder) => {
    e.stopPropagation();
    const route = getEntityRoute(reminder);
    if (route) {
      setOpen(false);
      navigate(route);
      markAsRead(reminder.id);
    } else {
      // If no specific route, mark as complete
      completeReminder(reminder.id);
      toast.success('Marked as done!');
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          <motion.div
            animate={unreadCount > 0 ? {
              scale: [1, 1.15, 1],
            } : {}}
            transition={{
              repeat: unreadCount > 0 ? Infinity : 0,
              duration: 2,
              repeatDelay: 4,
            }}
          >
            <Sparkles className={cn(
              "w-5 h-5 transition-colors",
              unreadCount > 0 ? "text-primary" : "text-muted-foreground"
            )} />
          </motion.div>
          
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive"
            />
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Dori has something to say</span>
          </div>
        </div>
        
        <ScrollArea className="max-h-80">
          <CardContent className="p-2 space-y-2">
            {reminders.slice(0, 5).map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-3 rounded-lg transition-colors",
                  reminder.read_at ? "bg-muted/30" : "bg-primary/10 border border-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{reminder.title}</span>
                      {reminder.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {reminder.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {format(new Date(reminder.scheduled_for), 'h:mm a')}
                    </p>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => handleAction(e, reminder)}
                      >
                        {getEntityRoute(reminder) ? (
                          <>
                            <ExternalLink className="w-3 h-3" />
                            {getActionLabel(reminder)}
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            Done
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={(e) => handleSnooze(e, reminder)}
                      >
                        <Clock className="w-3 h-3" />
                        Later
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => handleComplete(e, reminder)}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => handleDismiss(e, reminder.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
            {reminders.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No messages from Dori
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
