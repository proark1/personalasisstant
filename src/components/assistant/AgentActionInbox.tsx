import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShieldCheck, Check, X, Inbox } from 'lucide-react';
import { useAgentActions } from '@/hooks/useAgentActions';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function AgentActionInbox() {
  const [open, setOpen] = useState(false);
  const { actions, count, approve, reject } = useAgentActions();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Dori action inbox">
          <ShieldCheck className="w-4.5 h-4.5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] flex items-center justify-center"
            >
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Dori action inbox
            {count > 0 && <Badge variant="secondary">{count}</Badge>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            High-impact actions Dori wants to take. Approve to commit, reject to discard.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {actions.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
              <Inbox className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">All clear</p>
              <p className="text-xs mt-1">No actions waiting for your approval.</p>
            </div>
          ) : (
            actions.map(action => (
              <div
                key={action.id}
                className={cn(
                  'rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{action.reason}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        {action.actionType.replace(/_/g, ' ')}
                      </Badge>
                      <span>{formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 h-8 gap-1.5"
                    onClick={() => approve(action.id)}
                  >
                    <Check className="w-3.5 h-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 h-8 gap-1.5"
                    onClick={() => reject(action.id)}
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
