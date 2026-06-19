import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Bot,
  Plus,
  Loader2,
  Inbox,
  Video,
  Square,
  RefreshCcw,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Mic,
} from "lucide-react";
import { useMeetingBots, type MeetingBotRow, type MeetingBotStatus } from "@/hooks/useMeetingBots";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

// Sister panel to PlansPanel + AgentActionInbox: lists meeting copilots
// (rows in `meeting_bots`). The schedule dialog is intentionally simple
// — meeting URL + optional join time + record-video toggle. Auto-task
// creation from action items happens server-side on the bot.done webhook.

export function MeetingBotsPanel() {
  const [open, setOpen] = useState(false);
  const m = useMeetingBots();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Meeting copilots">
          <Bot className="w-4.5 h-4.5" />
          {m.activeCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] flex items-center justify-center"
            >
              {m.activeCount > 9 ? "9+" : m.activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4 text-primary" />
            Meeting copilots
            {m.activeCount > 0 && <Badge variant="secondary">{m.activeCount}</Badge>}
          </SheetTitle>
          <p className="text-xs text-muted-foreground text-left">
            Send a notetaker into Zoom / Google Meet / Teams. Get the transcript, summary, and
            action items back when the call ends.
          </p>
        </SheetHeader>

        <div className="px-4 py-3 border-b border-border">
          <ScheduleDialog onSchedule={m.schedule} />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {m.bots.length === 0 ? (
            <EmptyState />
          ) : (
            m.bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                busy={m.busyId === bot.id}
                onCancel={() => m.cancel(bot.id)}
                onRefresh={() => m.refreshOne(bot.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
      <Inbox className="w-10 h-10 mb-3 opacity-50" />
      <p className="text-sm font-medium">No meeting copilots yet</p>
      <p className="text-xs mt-1 max-w-xs">
        Schedule one above to have it join your next call and take notes.
      </p>
    </div>
  );
}

function ScheduleDialog({
  onSchedule,
}: {
  onSchedule: (args: {
    meetingUrl: string;
    title?: string;
    botName?: string;
    joinAt?: string | null;
    recordVideo?: boolean;
  }) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [botName, setBotName] = useState("Notetaker");
  const [joinAt, setJoinAt] = useState("");
  const [recordVideo, setRecordVideo] = useState(false);

  const reset = () => {
    setMeetingUrl("");
    setTitle("");
    setBotName("Notetaker");
    setJoinAt("");
    setRecordVideo(false);
  };

  const submit = async () => {
    if (!meetingUrl.trim()) return;
    setBusy(true);
    try {
      const res = await onSchedule({
        meetingUrl: meetingUrl.trim(),
        title: title.trim() || undefined,
        botName: botName.trim() || undefined,
        joinAt: joinAt ? new Date(joinAt).toISOString() : null,
        recordVideo,
      });
      if (res) {
        setOpen(false);
        reset();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="w-full gap-2">
          <Plus className="w-4 h-4" /> Send a copilot to a meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule meeting copilot</DialogTitle>
          <DialogDescription>
            Paste the meeting URL — Zoom, Google Meet, or Teams. Leave the start time blank to join
            immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mb-url">Meeting URL</Label>
            <Input
              id="mb-url"
              type="url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-title">Title (optional)</Label>
            <Input
              id="mb-title"
              placeholder="e.g. Weekly product sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-name">Bot display name</Label>
            <Input id="mb-name" value={botName} onChange={(e) => setBotName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mb-joinat">Join at (optional)</Label>
            <Input
              id="mb-joinat"
              type="datetime-local"
              value={joinAt}
              onChange={(e) => setJoinAt(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Record video</Label>
              <p className="text-xs text-muted-foreground">Captures screen sharing too.</p>
            </div>
            <Switch checked={recordVideo} onCheckedChange={setRecordVideo} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !meetingUrl.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BotCardProps {
  bot: MeetingBotRow;
  busy: boolean;
  onCancel: () => void;
  onRefresh: () => void;
}

function BotCard({ bot, busy, onCancel, onRefresh }: BotCardProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  const isActive = ["pending", "scheduled", "joining", "in_call"].includes(bot.status);
  const hasTranscript = bot.transcript.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 animate-fade-in">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={bot.status} />
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(bot.createdAt), { addSuffix: true })}
            </span>
            {bot.tasksCreatedCount > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                {bot.tasksCreatedCount} task{bot.tasksCreatedCount === 1 ? "" : "s"} added
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-snug mt-1">{bot.title || bot.meetingUrl}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{bot.meetingUrl}</p>
          {bot.errorMessage && (
            <p className="text-xs text-destructive mt-1 line-clamp-2">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {bot.errorMessage}
            </p>
          )}
        </div>
      </div>

      {bot.summary && (
        <div className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Summary: </span>
          {bot.summary}
        </div>
      )}

      {bot.actionItems.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Action items
          </p>
          <ul className="space-y-1">
            {bot.actionItems.slice(0, 5).map((it, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                <span>
                  {it.task}
                  {it.assignee && <span className="text-muted-foreground"> · {it.assignee}</span>}
                </span>
              </li>
            ))}
            {bot.actionItems.length > 5 && (
              <li className="text-[10px] text-muted-foreground italic">
                +{bot.actionItems.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}

      {hasTranscript && (
        <Collapsible open={showTranscript} onOpenChange={setShowTranscript}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-full text-[10px] text-muted-foreground gap-1"
            >
              <Mic className="w-3 h-3" />
              {showTranscript ? "Hide" : "Show"} transcript ({bot.transcript.length} entries)
              <ChevronRight
                className={cn(
                  "w-3 h-3 transition-transform ml-auto",
                  showTranscript && "rotate-90",
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 space-y-1 max-h-64 overflow-y-auto">
            {bot.transcript.slice(0, 80).map((e, i) => (
              <div key={i} className="text-[11px] leading-snug">
                <span className="font-medium text-primary">{e.speaker}: </span>
                <span className="text-muted-foreground">{e.text}</span>
              </div>
            ))}
            {bot.transcript.length > 80 && (
              <p className="text-[10px] text-muted-foreground italic">
                Showing first 80 of {bot.transcript.length}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1.5"
          onClick={onRefresh}
          disabled={busy}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
          Refresh
        </Button>
        {isActive && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive ml-auto"
            onClick={onCancel}
            disabled={busy}
          >
            <Square className="w-3 h-3" /> Stop
          </Button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: MeetingBotStatus }) {
  const meta: Record<MeetingBotStatus, { label: string; tone: string; Icon?: typeof Video }> = {
    pending: { label: "Queued", tone: "bg-muted text-muted-foreground" },
    scheduled: { label: "Scheduled", tone: "bg-primary/15 text-primary" },
    joining: { label: "Joining", tone: "bg-amber-500/15 text-amber-600" },
    in_call: { label: "Live", tone: "bg-emerald-500/15 text-emerald-600", Icon: Video },
    call_ended: { label: "Ended", tone: "bg-muted text-muted-foreground" },
    transcript_ready: { label: "Transcribing", tone: "bg-amber-500/15 text-amber-600" },
    analysis_ready: { label: "Analyzing", tone: "bg-amber-500/15 text-amber-600" },
    done: { label: "Done", tone: "bg-emerald-500/15 text-emerald-600" },
    error: { label: "Error", tone: "bg-destructive/15 text-destructive" },
    cancelled: { label: "Cancelled", tone: "bg-muted text-muted-foreground" },
  };
  const m = meta[status] ?? meta.pending;
  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-1",
        m.tone,
      )}
    >
      {m.Icon && <m.Icon className="w-3 h-3" />}
      {m.label}
    </span>
  );
}
