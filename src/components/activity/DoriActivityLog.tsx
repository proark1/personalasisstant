import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, X, BellOff, Lightbulb, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  useDoriActivityLog,
  type DoriActivityEntry,
  type DoriActivityKind,
} from '@/hooks/useDoriActivityLog';

/** Icon per event_type, falling back to a per-kind default. */
function entryIcon(entry: DoriActivityEntry): React.ElementType {
  switch (entry.type) {
    case 'proactive_action_accepted':
      return Check;
    case 'proactive_action_dismissed':
      return X;
    case 'proactive_action_muted':
      return BellOff;
    case 'proactive_action_shown':
      return Lightbulb;
    default:
      return entry.kind === 'ai' ? Bot : Sparkles;
  }
}

const kindLabel: Record<DoriActivityKind, string> = {
  proactive: 'Suggestion',
  ai: 'Action',
};

const kindColor: Record<DoriActivityKind, string> = {
  proactive: 'bg-primary/15 text-primary',
  ai: 'bg-accent/40 text-foreground',
};

export function DoriActivityLog() {
  const { entries, isLoading, error } = useDoriActivityLog();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-2 opacity-50" />
        <p>Couldn't load assistant activity</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Sparkles className="h-12 w-12 mb-2 opacity-50" />
        <p>No assistant activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4 pr-4">
        {entries.map((entry) => {
          const Icon = entryIcon(entry);
          return (
            <div
              key={entry.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/50 hover:border-border transition-colors"
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kindColor[entry.kind]}`}>
                <Icon className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs px-1.5 py-0">
                    {kindLabel[entry.kind]}
                  </Badge>
                </div>

                <p className="text-sm text-foreground mt-1">{entry.summary}</p>

                <p className="text-xs text-muted-foreground/70 mt-1">
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
