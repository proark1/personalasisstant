import { useProactiveReminders, ProactiveReminder } from '@/hooks/useProactiveReminders';
import { useLanguage } from '@/contexts/LanguageContext';
import { GlassCard, GlassCardContent, GlassCardHeader } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Bell, 
  X, 
  Clock, 
  Check, 
  FileText, 
  Calendar, 
  Users, 
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ProactiveRemindersCardProps {
  onNavigate?: (type: string, id?: string) => void;
}

export function ProactiveRemindersCard({ onNavigate }: ProactiveRemindersCardProps) {
  const { t } = useLanguage();
  const { 
    reminders, 
    unreadCount, 
    loading, 
    dismissReminder, 
    snoozeReminder, 
    completeReminder,
    markAsRead 
  } = useProactiveReminders();

  if (loading) {
    return (
      <GlassCard className="animate-pulse">
        <GlassCardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="w-4 h-4 text-primary" />
            {t('proactiveReminders.title')}
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="h-24 bg-muted/50 rounded-lg" />
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (reminders.length === 0) {
    return (
      <GlassCard>
        <GlassCardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="w-4 h-4 text-primary" />
            {t('proactiveReminders.title')}
          </div>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('proactiveReminders.allCaughtUp')}</p>
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <GlassCardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain className="w-4 h-4 text-primary" />
            {t('proactiveReminders.title')}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </GlassCardHeader>
      <GlassCardContent>
        <ScrollArea className="max-h-64">
          <div className="space-y-2">
            {reminders.slice(0, 5).map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onDismiss={() => dismissReminder(reminder.id)}
                onSnooze={() => snoozeReminder(reminder.id, 1)}
                onComplete={() => completeReminder(reminder.id)}
                onRead={() => markAsRead(reminder.id)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </ScrollArea>
        {reminders.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            +{reminders.length - 5} {t('proactiveReminders.more')}
          </p>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

function ReminderItem({ 
  reminder, 
  onDismiss, 
  onSnooze, 
  onComplete,
  onRead,
  onNavigate 
}: { 
  reminder: ProactiveReminder;
  onDismiss: () => void;
  onSnooze: () => void;
  onComplete: () => void;
  onRead: () => void;
  onNavigate?: (type: string, id?: string) => void;
}) {
  const isUnread = !reminder.read_at;
  
  const handleClick = () => {
    if (isUnread) onRead();
    if (onNavigate && reminder.trigger_entity_type && reminder.trigger_entity_id) {
      onNavigate(reminder.trigger_entity_type, reminder.trigger_entity_id);
    }
  };

  const getIcon = () => {
    switch (reminder.reminder_type) {
      case 'forgotten_task':
        return <FileText className="w-4 h-4" />;
      case 'contract_renewal':
        return <FileText className="w-4 h-4" />;
      case 'contact_checkin':
        return <Users className="w-4 h-4" />;
      case 'event_prep':
        return <Calendar className="w-4 h-4" />;
      case 'habit_streak':
        return <Zap className="w-4 h-4" />;
      case 'daily_review':
        return <Clock className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = () => {
    switch (reminder.priority) {
      case 'urgent':
        return 'border-l-destructive bg-destructive/5';
      case 'high':
        return 'border-l-warning bg-warning/5';
      case 'medium':
        return 'border-l-primary bg-primary/5';
      default:
        return 'border-l-muted-foreground bg-muted/50';
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border-l-4 transition-colors cursor-pointer hover:bg-accent/50",
        getPriorityColor(),
        isUnread && "ring-1 ring-primary/20"
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-1.5 rounded-full",
          reminder.priority === 'urgent' ? "bg-destructive/20 text-destructive" :
          reminder.priority === 'high' ? "bg-warning/20 text-warning" :
          "bg-primary/20 text-primary"
        )}>
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn(
              "font-medium text-sm truncate",
              isUnread && "font-semibold"
            )}>
              {reminder.title}
            </p>
            {isUnread && (
              <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {reminder.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(reminder.scheduled_for), { addSuffix: true })}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onSnooze();
            }}
            title="Snooze 1 hour"
          >
            <Clock className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-500 hover:text-green-600"
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            title="Mark as done"
          >
            <Check className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
