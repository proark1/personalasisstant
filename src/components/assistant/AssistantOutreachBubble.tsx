import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Volume2, VolumeX, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProactiveReminders } from '@/hooks/useProactiveReminders';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useProactiveSettings } from '@/hooks/useProactiveSettings';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function AssistantOutreachBubble() {
  const { reminders, unreadCount, markAsRead, dismissReminder } = useProactiveReminders();
  const { settings } = useProactiveSettings();
  const { speak, stop, isSpeaking } = useTextToSpeech({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Get unread reminders only
  const unreadReminders = reminders.filter(r => !r.read_at);

  // Auto-speak newest reminder when voice is enabled
  useEffect(() => {
    if (voiceEnabled && settings?.voice_proactive_enabled && unreadReminders.length > 0 && !isSpeaking) {
      const newest = unreadReminders[0];
      speak(`${newest.title}. ${newest.message}`, 'supportive');
    }
  }, [unreadReminders.length, voiceEnabled, settings?.voice_proactive_enabled]);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && unreadReminders.length > 0) {
      // Mark first few as read when expanding
      unreadReminders.slice(0, 3).forEach(r => markAsRead(r.id));
    }
  };

  const handleSpeakReminder = (reminder: typeof reminders[0]) => {
    if (isSpeaking) {
      stop();
    } else {
      speak(`${reminder.title}. ${reminder.message}`, 'supportive');
    }
  };

  const handleDismiss = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    dismissReminder(reminderId);
  };

  if (unreadCount === 0 && !isExpanded) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-3"
          >
            <Card className="w-80 max-w-[calc(100vw-2rem)] glass-panel-solid shadow-xl">
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Dori has something for you</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                  >
                    {voiceEnabled ? (
                      <Volume2 className="w-4 h-4 text-primary" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsExpanded(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="max-h-72">
                <CardContent className="p-2 space-y-2">
                  {reminders.slice(0, 5).map((reminder) => (
                    <motion.div
                      key={reminder.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-3 rounded-lg transition-colors cursor-pointer",
                        reminder.read_at ? "bg-muted/30" : "bg-primary/10 border border-primary/20"
                      )}
                      onClick={() => handleSpeakReminder(reminder)}
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
                      No new reminders
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating bubble */}
      <motion.button
        onClick={handleExpand}
        className={cn(
          "relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          isExpanded && "bg-primary/80"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={unreadCount > 0 && !isExpanded ? {
          scale: [1, 1.1, 1],
        } : {}}
        transition={{
          repeat: unreadCount > 0 && !isExpanded ? Infinity : 0,
          duration: 2,
          repeatDelay: 3,
        }}
      >
        <MessageCircle className="w-6 h-6" />
        
        {/* Unread badge */}
        {unreadCount > 0 && !isExpanded && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
        
        {/* Pulse ring for attention */}
        {unreadCount > 0 && !isExpanded && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{
              scale: [1, 1.3],
              opacity: [0.5, 0],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              repeatDelay: 2,
            }}
          />
        )}
      </motion.button>
    </div>
  );
}
