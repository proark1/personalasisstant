import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Inbox, ListChecks, ShieldCheck, Bot as BotIcon, Building2, CalendarRange,
  Sparkles, ChevronRight, Check, X, Play,
} from 'lucide-react';
import { useAssistantHub, type HubItem, type HubItemSource } from '@/hooks/useAssistantHub';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const SOURCE_META: Record<HubItemSource, { label: string; icon: typeof Inbox; tone: string }> = {
  plan:        { label: 'Plan',        icon: ListChecks,  tone: 'text-primary' },
  action:      { label: 'Action',      icon: ShieldCheck, tone: 'text-amber-500' },
  meeting_bot: { label: 'Meeting',     icon: BotIcon,     tone: 'text-emerald-500' },
  bank_reauth: { label: 'Bank',        icon: Building2,   tone: 'text-destructive' },
  schedule:    { label: 'Schedule',    icon: CalendarRange, tone: 'text-violet-500' },
};

// Unified "What needs me?" hub — collapses Plans, Action inbox,
// Meeting bots, schedule drafts, and bank-reauth alerts into one
// sorted list. Replaces the row of 5 separate header sheets with
// a single icon + badge.
//
// Inline actions for the common path (approve next plan step,
// approve/reject single action). Anything more nuanced deep-links
// to the source surface via "Open in X →".
export function AssistantHubSheet() {
  const [open, setOpen] = useState(false);
  const hub = useAssistantHub();
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="What needs me?">
          <Inbox className="w-4.5 h-4.5" />
          {hub.count > 0 && (
            <Badge
              variant="default"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] flex items-center justify-center"
            >
              {hub.count > 9 ? '9+' : hub.count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Inbox className="w-4 h-4 text-primary" />
            What needs me?
            {hub.count > 0 && <Badge variant="secondary">{hub.count}</Badge>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Plans, action approvals, live meeting bots, schedule drafts, and bank re-auth alerts — one list.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {hub.items.length === 0 ? (
            <Empty />
          ) : (
            hub.items.map((item) => (
              <HubRow
                key={item.id}
                item={item}
                hub={hub}
                close={() => setOpen(false)}
                navigate={navigate}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Empty() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
      <Sparkles className="w-10 h-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">Nothing needs you</p>
      <p className="text-xs mt-1 max-w-xs">
        When the assistant has a plan to approve, an action waiting, or a meeting in flight, it'll surface here.
      </p>
    </div>
  );
}

function HubRow({
  item, hub, close, navigate,
}: {
  item: HubItem;
  hub: ReturnType<typeof useAssistantHub>;
  close: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const meta = SOURCE_META[item.source];
  const Icon = meta.icon;
  const ago = formatDistanceToNow(new Date(Date.now() - item.ageMs), { addSuffix: true });

  return (
    <div className="rounded-lg border border-border bg-card p-2.5 space-y-2 animate-fade-in">
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', meta.tone)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-medium uppercase text-muted-foreground">
              {meta.label}
            </span>
            {item.badge && (
              <Badge variant="outline" className="text-[10px]">{item.badge}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{ago}</span>
          </div>
          <p className="text-sm font-medium leading-snug mt-0.5 truncate">{item.title}</p>
          {item.subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.subtitle}</p>
          )}
        </div>
      </div>
      <Actions item={item} hub={hub} close={close} navigate={navigate} />
    </div>
  );
}

function Actions({
  item, hub, close, navigate,
}: {
  item: HubItem;
  hub: ReturnType<typeof useAssistantHub>;
  close: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  // Per-source inline actions. We only do the common path here —
  // anything deeper opens the dedicated detail sheet/page.
  switch (item.source) {
    case 'plan': {
      const planId = item.id.replace(/^plan:/, '');
      const plan = hub.plans.plans.find((p) => p.id === planId);
      if (!plan || !plan.currentStep) return <DeepLink onClick={() => { navigate('/'); close(); }} />;
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1.5"
            disabled={hub.plans.busyPlanId === plan.id}
            onClick={() => hub.plans.executeNext(plan.id)}
          >
            <Play className="w-3 h-3" /> Run next
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            disabled={hub.plans.busyPlanId === plan.id}
            onClick={() => hub.plans.skipStep(plan.id)}
          >
            Skip
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
            disabled={hub.plans.busyPlanId === plan.id}
            onClick={() => hub.plans.abortPlan(plan.id)}
          >
            Abort
          </Button>
        </div>
      );
    }
    case 'action': {
      const actionId = item.id.replace(/^action:/, '');
      return (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs flex-1 gap-1.5"
            onClick={() => hub.actions.approve(actionId)}
          >
            <Check className="w-3 h-3" /> Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs flex-1 gap-1.5"
            onClick={() => hub.actions.reject(actionId)}
          >
            <X className="w-3 h-3" /> Reject
          </Button>
        </div>
      );
    }
    case 'meeting_bot':
      return <DeepLink label="Open meeting copilots" onClick={() => { navigate('/'); close(); }} />;
    case 'bank_reauth':
      return <DeepLink label="Open finance" onClick={() => { navigate('/finance'); close(); }} />;
    case 'schedule':
      return <DeepLink label="Open planner" onClick={() => { navigate('/'); close(); }} />;
    default:
      return null;
  }
}

function DeepLink({ label = 'Open', onClick }: { label?: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 ml-auto" onClick={onClick}>
      {label} <ChevronRight className="w-3 h-3" />
    </Button>
  );
}
