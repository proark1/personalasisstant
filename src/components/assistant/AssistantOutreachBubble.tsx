import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  const spokenUrgentIds = useRef<Set<string>>(new Set());
  // Tracks the last reminder we auto-spoke via the manual voice toggle so the
  // effect can depend on `isSpeaking`/`speak` (exhaustive-deps) without
  // re-speaking the same reminder every time speech ends.
  const lastSpokenNewestId = useRef<string | null>(null);

  // Get unread reminders only. Memoized so the effects below can depend on the
  // array itself (not just its length) without re-running on every render.
  const unreadReminders = useMemo(() => reminders.filter(r => !r.read_at), [reminders]);

  // Check if we're in quiet hours
  const isInQuietHours = useCallback((): boolean => {
    if (!settings?.quiet_hours_enabled) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinutes;

    const [startHour, startMin] = (settings.quiet_hours_start || '22:00').split(':').map(Number);
    const [endHour, endMin] = (settings.quiet_hours_end || '07:00').split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime > endTime) {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }, [settings]);

  // Auto-speak urgent reminders when voice alerts enabled
  useEffect(() => {
    if (!settings?.voice_alerts_enabled || isInQuietHours()) return;
    
    const urgentUnread = unreadReminders.filter(
      r => r.priority === 'urgent' && !spokenUrgentIds.current.has(r.id)
    );

    if (urgentUnread.length > 0 && !isSpeaking) {
      const urgent = urgentUnread[0];
      spokenUrgentIds.current.add(urgent.id);
      speak(`Urgent: ${urgent.title}. ${urgent.message}`, 'supportive');
    }
  }, [unreadReminders, settings?.voice_alerts_enabled, isSpeaking, isInQuietHours, speak]);

  // Auto-speak newest reminder when voice is enabled (manual toggle). The
  // `lastSpokenNewestId` ref ensures we speak each newest reminder only once,
  // even though the effect re-runs when `isSpeaking` toggles back to false.
  useEffect(() => {
    if (!voiceEnabled || !settings?.voice_proactive_enabled) {
      // Clear the "already spoken" memory while voice is off so toggling it
      // back on re-announces the current newest reminder.
      lastSpokenNewestId.current = null;
      return;
    }
    const newest = unreadReminders[0];
    if (!newest || isSpeaking) return;
    if (lastSpokenNewestId.current === newest.id) return;
    lastSpokenNewestId.current = newest.id;
    speak(`${newest.title}. ${newest.message}`, 'supportive');
  }, [unreadReminders, voiceEnabled, settings?.voice_proactive_enabled, isSpeaking, speak]);

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
              <ScrollArea className="max-h-72 overflow-y-auto">
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
                          <div className="flex items-center gap-2 mt-2">
                            {reminder.action_type && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Navigate based on action type
                                  const metadata = reminder.metadata || {};
                                  if (reminder.action_type === 'task' && metadata.task_id) {
                                    window.location.href = `/?tab=tasks&task=${metadata.task_id}`;
                                  } else if (reminder.action_type === 'contact' && metadata.contact_id) {
                                    window.location.href = `/?tab=contacts&contact=${metadata.contact_id}`;
                                  } else if (reminder.action_type === 'habit') {
                                    window.location.href = `/?tab=habits`;
                                  } else if (reminder.action_type === 'event') {
                                    window.location.href = `/?tab=calendar`;
                                  } else if (reminder.trigger_entity_type === 'task') {
                                    window.location.href = `/?tab=tasks`;
                                  } else if (reminder.trigger_entity_type === 'contact') {
                                    window.location.href = `/?tab=contacts`;
                                  } else if (reminder.trigger_entity_type === 'habit') {
                                    window.location.href = `/?tab=habits`;
                                  }
                                  dismissReminder(reminder.id);
                                  setIsExpanded(false);
                                }}
                              >
                                {reminder.action_type === 'task' || reminder.trigger_entity_type === 'task' ? 'View Task' : 
                                 reminder.action_type === 'contact' || reminder.trigger_entity_type === 'contact' ? 'View Contact' :
                                 reminder.action_type === 'habit' || reminder.trigger_entity_type === 'habit' ? 'Track Habit' :
                                 reminder.action_type === 'event' ? 'View Event' : 'Take Action'}
                              </Button>
                            )}
                            {!reminder.action_type && reminder.trigger_entity_type && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (reminder.trigger_entity_type === 'task') {
                                    window.location.href = `/?tab=tasks`;
                                  } else if (reminder.trigger_entity_type === 'contact') {
                                    window.location.href = `/?tab=contacts`;
                                  } else if (reminder.trigger_entity_type === 'habit') {
                                    window.location.href = `/?tab=habits`;
                                  }
                                  dismissReminder(reminder.id);
                                  setIsExpanded(false);
                                }}
                              >
                                {reminder.trigger_entity_type === 'task' ? 'View Tasks' : 
                                 reminder.trigger_entity_type === 'contact' ? 'View Contacts' :
                                 reminder.trigger_entity_type === 'habit' ? 'View Habits' : 'Open'}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSpeakReminder(reminder);
                              }}
                            >
                              <Volume2 className="w-3 h-3 mr-1" />
                              Listen
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
