import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  Video, 
  Phone, 
  Clock, 
  Users,
  X,
  ExternalLink
} from 'lucide-react';
import { useCallFeatures, ScheduledCall } from '@/hooks/useCallFeatures';
import { useCall } from '@/components/calling/CallProvider';
import { format, isToday, isTomorrow, differenceInMinutes } from 'date-fns';

interface ScheduledCallsPanelProps {
  userId: string;
}

export function ScheduledCallsPanel({ userId: _userId }: ScheduledCallsPanelProps) {
  const { scheduledCalls, cancelScheduledCall } = useCallFeatures();
  const { startVideoCall, startAudioCall } = useCall();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getTimeLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const canStartCall = (scheduledFor: Date) => {
    const diff = differenceInMinutes(scheduledFor, new Date());
    return diff <= 5 && diff >= -30; // Can start 5 min before until 30 min after
  };

  const handleStartCall = (call: ScheduledCall) => {
    const participantId = call.participantIds[0];
    if (call.callType === 'video') {
      startVideoCall(participantId);
    } else {
      startAudioCall(participantId);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Scheduled Calls
        </CardTitle>
      </CardHeader>
      <CardContent>
        {scheduledCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-20" />
            <p>No scheduled calls</p>
            <p className="text-sm">Schedule calls with your team</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {scheduledCalls.map((call) => (
                <div
                  key={call.id}
                  className="p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {call.callType === 'video' ? (
                        <Video className="w-4 h-4 text-primary" />
                      ) : (
                        <Phone className="w-4 h-4 text-primary" />
                      )}
                      <span className="font-medium">
                        {call.title || `${call.callType === 'video' ? 'Video' : 'Audio'} Call`}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => cancelScheduledCall(call.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {call.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                      {call.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeLabel(call.scheduledFor)} at {format(call.scheduledFor, 'h:mm a')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {call.participantIds.length} participant{call.participantIds.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {call.participants?.slice(0, 3).map((p) => (
                        <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback className="text-xs">
                            {getInitials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {call.participantIds.length > 3 && (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                          +{call.participantIds.length - 3}
                        </div>
                      )}
                    </div>

                    <div className="flex-1" />

                    {canStartCall(call.scheduledFor) && (
                      <Button
                        size="sm"
                        onClick={() => handleStartCall(call)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Join
                      </Button>
                    )}
                  </div>

                  <Badge 
                    variant="outline" 
                    className="mt-2"
                  >
                    {call.durationMinutes} min
                  </Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
