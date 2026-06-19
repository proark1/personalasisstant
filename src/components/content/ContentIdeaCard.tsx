import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ThumbsUp,
  X,
  CalendarPlus,
  Clapperboard,
  ExternalLink,
  CalendarClock,
  Trash2,
  Check,
} from "lucide-react";
import { KIND_META, type ContentIdea } from "@/lib/content";

// Default the schedule picker to tomorrow at 10:00 local time, formatted for
// <input type="datetime-local"> (which wants local time, no timezone suffix).
function defaultWhen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  idea: ContentIdea;
  onLike: () => void;
  onDismiss: () => void;
  onWriteScripts: () => void;
  onSchedule: (whenISO: string, durationMin: number) => void;
  onUnschedule: () => void;
}

export function ContentIdeaCard({
  idea,
  onLike,
  onDismiss,
  onWriteScripts,
  onSchedule,
  onUnschedule,
}: Props) {
  const { t } = useLanguage();
  const [when, setWhen] = useState(defaultWhen);
  const [duration, setDuration] = useState(30);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const meta = KIND_META[idea.kind];
  const liked = idea.status === "liked" || idea.status === "scheduled";
  const scheduled = idea.status === "scheduled";

  const confirmSchedule = () => {
    // datetime-local has no timezone; interpret it as local and send ISO.
    // Guard an empty/invalid value (e.g. the user cleared the field) — otherwise
    // new Date('').toISOString() throws RangeError and crashes the handler.
    const parsed = new Date(when);
    if (Number.isNaN(parsed.getTime())) {
      toast.error(t("content.pickValidDate"));
      return;
    }
    onSchedule(parsed.toISOString(), duration);
    setScheduleOpen(false);
  };

  return (
    <Card
      className={cn(
        "transition-colors",
        scheduled && "border-primary/40",
        idea.status === "dismissed" && "opacity-50",
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={idea.kind === "current" ? "default" : "secondary"} className="gap-1">
            <span aria-hidden>{meta.emoji}</span> {t(`content.kind.${idea.kind}`)}
          </Badge>
          {idea.topic && <Badge variant="outline">{idea.topic}</Badge>}
          {scheduled && idea.scheduled_for && (
            <Badge variant="outline" className="gap-1 text-primary border-primary/40">
              <CalendarClock className="h-3 w-3" />
              {new Date(idea.scheduled_for).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </Badge>
          )}
        </div>

        <h3 className="font-semibold leading-snug">{idea.headline}</h3>

        {idea.hook && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("content.hook")}: </span>
            <span className="italic">“{idea.hook}”</span>
          </p>
        )}
        {idea.summary && <p className="text-sm text-muted-foreground">{idea.summary}</p>}

        {idea.source_url && (
          <a
            href={idea.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {idea.source_title ? idea.source_title.slice(0, 70) : t("content.readSource")}
          </a>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={liked ? "default" : "outline"}
            onClick={onLike}
            className="gap-1"
          >
            {liked ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
            {liked ? t("content.liked") : t("content.like")}
          </Button>

          <Button size="sm" variant="outline" onClick={onWriteScripts} className="gap-1">
            <Clapperboard className="h-4 w-4" /> {t("content.writeScripts")}
          </Button>

          {scheduled ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onUnschedule}
              className="gap-1 text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" /> {t("content.unschedule")}
            </Button>
          ) : (
            <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <CalendarPlus className="h-4 w-4" /> {t("content.schedule")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3" align="start">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("content.when")}</Label>
                  <Input
                    type="datetime-local"
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("content.blockLength")}</Label>
                  <div className="flex gap-1.5">
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDuration(m)}
                        className={cn(
                          "h-8 px-3 rounded-md border text-xs font-medium transition-colors",
                          duration === m
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="w-full" onClick={confirmSchedule}>
                  {t("content.addToCalendar")}
                </Button>
                <p className="text-[11px] text-muted-foreground">{t("content.scheduleNote")}</p>
              </PopoverContent>
            </Popover>
          )}

          {idea.status !== "dismissed" && !liked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="gap-1 text-muted-foreground ml-auto"
            >
              <X className="h-4 w-4" /> {t("content.dismiss")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
