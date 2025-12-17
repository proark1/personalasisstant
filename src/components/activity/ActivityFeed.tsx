import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Edit, 
  Plus, 
  Trash2, 
  UserPlus, 
  Share2, 
  MessageSquare,
  Calendar,
  ListTodo
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ActivityItem } from '@/hooks/useActivityFeed';

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading: boolean;
}

const actionIcons: Record<string, React.ElementType> = {
  created: Plus,
  updated: Edit,
  deleted: Trash2,
  completed: CheckCircle2,
  assigned: UserPlus,
  shared: Share2,
  commented: MessageSquare,
};

const actionColors: Record<string, string> = {
  created: 'bg-green-500/20 text-green-400',
  updated: 'bg-blue-500/20 text-blue-400',
  deleted: 'bg-red-500/20 text-red-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  assigned: 'bg-purple-500/20 text-purple-400',
  shared: 'bg-cyan-500/20 text-cyan-400',
  commented: 'bg-yellow-500/20 text-yellow-400',
};

const actionLabels: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  completed: 'completed',
  assigned: 'assigned',
  shared: 'shared',
  commented: 'commented on',
};

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 pr-4">
        {activities.map((activity) => {
          const Icon = actionIcons[activity.action] || Edit;
          const colorClass = actionColors[activity.action] || 'bg-muted text-muted-foreground';
          const TypeIcon = activity.itemType === 'task' ? ListTodo : Calendar;

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:border-border transition-colors"
            >
              <Avatar className="h-8 w-8">
                {activity.actorAvatar && (
                  <AvatarImage src={activity.actorAvatar} alt={activity.actorName} />
                )}
                <AvatarFallback className="text-xs">
                  {activity.actorName?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">
                    {activity.actorName}
                  </span>
                  <Badge variant="outline" className={`${colorClass} text-xs px-1.5 py-0`}>
                    <Icon className="h-3 w-3 mr-1" />
                    {actionLabels[activity.action]}
                  </Badge>
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    <TypeIcon className="h-3 w-3 mr-1" />
                    {activity.itemType}
                  </Badge>
                </div>

                {activity.itemTitle && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    "{activity.itemTitle}"
                  </p>
                )}

                {activity.details?.assignee && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned to: {activity.details.assignee}
                  </p>
                )}

                <p className="text-xs text-muted-foreground/70 mt-1">
                  {formatDistanceToNow(activity.createdAt, { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
