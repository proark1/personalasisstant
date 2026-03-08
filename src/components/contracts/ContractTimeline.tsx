import { Contract } from '@/hooks/useContracts';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/ui/empty-state';
import { motion } from 'framer-motion';
import { staggerItem, staggerContainer } from '@/components/ui/panel-shell';
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
} from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContractTimelineProps {
  contracts: Contract[];
}

interface TimelineEvent {
  id: string;
  contractId: string;
  contractName: string;
  date: Date;
  type: 'cancellation_deadline' | 'renewal' | 'start' | 'end';
  isUrgent: boolean;
  isPast: boolean;
  daysFromNow: number;
}

export function ContractTimeline({ contracts }: ContractTimelineProps) {
  const now = new Date();
  const events: TimelineEvent[] = [];
  
  contracts.forEach(contract => {
    if (!contract.isActive) return;

    if (contract.renewalDate) {
      const daysUntil = differenceInDays(contract.renewalDate, now);
      events.push({
        id: `${contract.id}-renewal`,
        contractId: contract.id,
        contractName: contract.name,
        date: contract.renewalDate,
        type: 'renewal',
        isUrgent: daysUntil >= 0 && daysUntil <= 14,
        isPast: daysUntil < 0,
        daysFromNow: daysUntil
      });

      if (contract.autoRenews) {
        const cancellationDate = addDays(contract.renewalDate, -contract.cancellationNoticeDays);
        const daysToCancellation = differenceInDays(cancellationDate, now);
        events.push({
          id: `${contract.id}-cancellation`,
          contractId: contract.id,
          contractName: contract.name,
          date: cancellationDate,
          type: 'cancellation_deadline',
          isUrgent: daysToCancellation >= 0 && daysToCancellation <= 7,
          isPast: daysToCancellation < 0,
          daysFromNow: daysToCancellation
        });
      }
    }

    if (contract.endDate && (!contract.renewalDate || 
        format(contract.endDate, 'yyyy-MM-dd') !== format(contract.renewalDate, 'yyyy-MM-dd'))) {
      const daysUntil = differenceInDays(contract.endDate, now);
      events.push({
        id: `${contract.id}-end`,
        contractId: contract.id,
        contractName: contract.name,
        date: contract.endDate,
        type: 'end',
        isUrgent: daysUntil >= 0 && daysUntil <= 30,
        isPast: daysUntil < 0,
        daysFromNow: daysUntil
      });
    }
  });

  const sortedEvents = events
    .filter(e => e.daysFromNow >= -30 && e.daysFromNow <= 180)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'cancellation_deadline': return <AlertTriangle className="w-4 h-4" />;
      case 'renewal': return <RefreshCw className="w-4 h-4" />;
      case 'start': return <CheckCircle className="w-4 h-4" />;
      case 'end': return <Clock className="w-4 h-4" />;
    }
  };

  const getEventColor = (event: TimelineEvent) => {
    if (event.isPast) return 'text-muted-foreground';
    if (event.type === 'cancellation_deadline') return 'text-destructive';
    if (event.isUrgent) return 'text-primary';
    return 'text-foreground';
  };

  const getEventLabel = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'cancellation_deadline': return 'Cancel by';
      case 'renewal': return 'Renews';
      case 'start': return 'Starts';
      case 'end': return 'Ends';
    }
  };

  if (sortedEvents.length === 0) {
    return (
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Contract Timeline
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <EmptyState
            icon={Calendar}
            title="No upcoming events"
            description="No contract renewals or deadlines in the next 6 months"
          />
        </GlassCardContent>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Contract Timeline
        </GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
            
            <motion.div 
              className="space-y-4"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {sortedEvents.map((event) => (
                <motion.div
                  key={event.id}
                  variants={staggerItem}
                  className={cn(
                    "relative pl-8",
                    event.isPast && "opacity-50"
                  )}
                >
                  <div className={cn(
                    "absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2",
                    event.type === 'cancellation_deadline' 
                      ? "bg-destructive border-destructive" 
                      : event.isUrgent 
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                  )} />
                  
                  <div className={cn(
                    "p-3 rounded-lg border transition-colors",
                    event.isUrgent && !event.isPast && "border-primary/50 bg-primary/5",
                    event.type === 'cancellation_deadline' && !event.isPast && "border-destructive/50 bg-destructive/5"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className={cn("flex items-center gap-2 text-sm font-medium", getEventColor(event))}>
                          {getEventIcon(event.type)}
                          <span>{getEventLabel(event.type)}</span>
                        </div>
                        <p className="font-medium mt-1 truncate">{event.contractName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(event.date, 'EEEE, MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge 
                        variant={event.isPast ? "outline" : event.isUrgent ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        {event.isPast 
                          ? `${Math.abs(event.daysFromNow)}d ago`
                          : event.daysFromNow === 0 
                            ? 'Today'
                            : `${event.daysFromNow}d`
                        }
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </ScrollArea>
      </GlassCardContent>
    </GlassCard>
  );
}
