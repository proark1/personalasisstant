import { useState } from 'react';
import { GlassCard, GlassCardContent, GlassCardHeader } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFollowUpQueue } from '@/hooks/useFollowUpQueue';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  X,
  ChevronRight,
  Target,
  Flame,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const FOLLOW_UP_ICONS: Record<string, React.ReactNode> = {
  stalled_task: <Clock className="w-4 h-4 text-warning" />,
  post_event: <Calendar className="w-4 h-4 text-primary" />,
  goal_check: <Target className="w-4 h-4 text-success" />,
  habit_reminder: <Flame className="w-4 h-4 text-destructive" />,
  day_prediction: <MessageSquare className="w-4 h-4 text-primary" />,
};

export function FollowUpCard() {
  const { t } = useLanguage();
  const { dueFollowUps, completeFollowUp, dismissFollowUp, snoozeFollowUp, loading } = useFollowUpQueue();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getFollowUpLabel = (type: string) => {
    const labels: Record<string, string> = {
      stalled_task: t('followUp.taskCheckin'),
      post_event: t('followUp.eventFollowup'),
      goal_check: t('followUp.goalProgress'),
      habit_reminder: t('followUp.habitReminder'),
      day_prediction: t('followUp.dayInsight'),
    };
    return labels[type] || t('followUp.title');
  };

  if (loading) {
    return (
      <GlassCard>
        <GlassCardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-12 bg-muted rounded" />
          </div>
        </GlassCardContent>
      </GlassCard>
    );
  }

  if (dueFollowUps.length === 0) {
    return null;
  }

  return (
    <GlassCard className="border-primary/20">
      <GlassCardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="w-4 h-4 text-primary" />
          {t('followUp.quick')}
          <Badge variant="secondary" className="ml-auto">
            {dueFollowUps.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {dueFollowUps.slice(0, 3).map((followUp) => (
          <div
            key={followUp.id}
            className={cn(
              "p-3 rounded-lg bg-muted/50 transition-all",
              expandedId === followUp.id && "bg-primary/10 ring-1 ring-primary/20"
            )}
          >
            <div 
              className="flex items-start gap-3 cursor-pointer"
              onClick={() => setExpandedId(expandedId === followUp.id ? null : followUp.id)}
            >
              {FOLLOW_UP_ICONS[followUp.follow_up_type] || <MessageSquare className="w-4 h-4" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {getFollowUpLabel(followUp.follow_up_type)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(followUp.check_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {followUp.message_template || `${t('followUp.about')}: ${followUp.context?.title || followUp.entity_type}`}
                </p>
              </div>
              <ChevronRight className={cn(
                "w-4 h-4 text-muted-foreground transition-transform",
                expandedId === followUp.id && "rotate-90"
              )} />
            </div>

            {expandedId === followUp.id && (
              <div className="mt-3 pt-3 border-t space-y-3">
                {followUp.context?.title && (
                  <p className="text-sm font-medium">{followUp.context.title}</p>
                )}
                {followUp.message_template && (
                  <p className="text-sm text-muted-foreground">{followUp.message_template}</p>
                )}
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeFollowUp(followUp.id, 'done');
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    {t('followUp.done')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      snoozeFollowUp(followUp.id, 2);
                    }}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {t('followUp.later')}
                    Later
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissFollowUp(followUp.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {dueFollowUps.length > 3 && (
          <p className="text-xs text-muted-foreground text-center">
            +{dueFollowUps.length - 3} {t('followUp.more')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
