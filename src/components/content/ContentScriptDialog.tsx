import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Clapperboard, Copy, Check, RefreshCw, Sparkles, MonitorPlay } from "lucide-react";
import { useContentScripts } from "@/hooks/useContentScripts";
import { Teleprompter } from "./Teleprompter";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  platformLabel,
  formatDuration,
  FORMAT_META,
  type ContentIdea,
  type ContentScript,
  type DefaultFormat,
  type ScriptVariation,
} from "@/lib/content";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("content.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("content.couldNotCopy"));
    }
  };
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label ?? t("content.copy")}
    </Button>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function ShortScript({
  script,
  onEdit,
  onRecord,
}: {
  script: ContentScript;
  onEdit: (text: string) => void;
  onRecord: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState(script.script);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t("content.shortForm")}</Badge>
        <Badge variant="outline">~{formatDuration(script.duration_seconds)}</Badge>
        <Button size="sm" variant="outline" className="h-7 gap-1 ml-auto" onClick={onRecord}>
          <MonitorPlay className="h-3.5 w-3.5" /> {t("content.record")}
        </Button>
      </div>
      {script.hook && (
        <Section title={t("content.sec.hook")} action={<CopyButton text={script.hook} />}>
          <p className="text-sm italic rounded-md bg-muted/50 p-2">“{script.hook}”</p>
        </Section>
      )}
      <Section title={t("content.sec.script")} action={<CopyButton text={text} />}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== script.script) onEdit(text);
          }}
          className="min-h-[140px] text-sm"
        />
      </Section>
      {script.shot_list && (
        <Section title={t("content.sec.shots")} action={<CopyButton text={script.shot_list} />}>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-2">
            {script.shot_list}
          </p>
        </Section>
      )}
      {script.platform_variants?.length > 0 && (
        <Section title={t("content.sec.captions")}>
          <div className="space-y-2">
            {script.platform_variants.map((v, i) => (
              <div key={i} className="rounded-md border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{platformLabel(v.platform)}</Badge>
                  <CopyButton
                    text={`${v.caption}\n\n${(v.hashtags || []).map((h) => `#${h}`).join(" ")}`}
                    label={t("content.copyCaption")}
                  />
                </div>
                {v.hook && <p className="text-sm italic">“{v.hook}”</p>}
                {v.caption && <p className="text-sm">{v.caption}</p>}
                {v.hashtags?.length > 0 && (
                  <p className="text-xs text-primary">{v.hashtags.map((h) => `#${h}`).join(" ")}</p>
                )}
                {v.notes && <p className="text-xs text-muted-foreground">💡 {v.notes}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {script.cta && (
        <Section title={t("content.sec.cta")}>
          <p className="text-sm">{script.cta}</p>
        </Section>
      )}
    </div>
  );
}

function LongScript({
  script,
  onEdit,
  onRecord,
}: {
  script: ContentScript;
  onEdit: (text: string) => void;
  onRecord: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState(script.script);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t("content.longForm")}</Badge>
        <Badge variant="outline">~{formatDuration(script.duration_seconds)}</Badge>
        <Button size="sm" variant="outline" className="h-7 gap-1 ml-auto" onClick={onRecord}>
          <MonitorPlay className="h-3.5 w-3.5" /> {t("content.record")}
        </Button>
      </div>
      {script.title_options?.length > 0 && (
        <Section title={t("content.sec.titles")}>
          <ul className="space-y-1">
            {script.title_options.map((opt, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-sm rounded-md bg-muted/50 px-2 py-1"
              >
                <span>{opt}</span>
                <CopyButton text={opt} label="" />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {script.thumbnail_concept && (
        <Section title={t("content.sec.thumbnail")}>
          <p className="text-sm">{script.thumbnail_concept}</p>
        </Section>
      )}
      {script.hook && (
        <Section title={t("content.sec.hookLong")} action={<CopyButton text={script.hook} />}>
          <p className="text-sm italic rounded-md bg-muted/50 p-2">“{script.hook}”</p>
        </Section>
      )}
      <Section title={t("content.sec.fullScript")} action={<CopyButton text={text} />}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== script.script) onEdit(text);
          }}
          className="min-h-[200px] text-sm"
        />
      </Section>
      {script.description && (
        <Section
          title={t("content.sec.description")}
          action={<CopyButton text={script.description} />}
        >
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-2">
            {script.description}
          </p>
        </Section>
      )}
      {script.hashtags?.length > 0 && (
        <Section title={t("content.sec.tags")}>
          <p className="text-xs text-primary">{script.hashtags.map((h) => `#${h}`).join(" ")}</p>
        </Section>
      )}
      {script.cta && (
        <Section title={t("content.sec.cta")}>
          <p className="text-sm">{script.cta}</p>
        </Section>
      )}
    </div>
  );
}

interface Props {
  idea: ContentIdea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFormat?: DefaultFormat;
}

const FORMAT_OPTIONS: DefaultFormat[] = ["short", "long", "both"];

export function ContentScriptDialog({ idea, open, onOpenChange, defaultFormat = "both" }: Props) {
  const { t } = useLanguage();
  const { scripts, loading, generating, generate, updateScript } = useContentScripts(
    idea?.id ?? null,
  );
  const [fmt, setFmt] = useState<DefaultFormat>(defaultFormat);
  const [tele, setTele] = useState<{ title: string; text: string } | null>(null);

  // Seed the format picker from the profile default each time the dialog opens.
  useEffect(() => {
    if (open) setFmt(defaultFormat);
  }, [open, defaultFormat]);

  const short = scripts.find((s) => s.format === "short");
  const long = scripts.find((s) => s.format === "long");
  const hasScripts = scripts.length > 0;

  const run = (variation?: ScriptVariation) => generate(FORMAT_META[fmt].formats, variation);

  const formatPicker = (
    <div className="flex justify-center gap-1.5">
      {FORMAT_OPTIONS.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => setFmt(f)}
          className={cn(
            "h-8 px-3 rounded-md border text-xs font-medium transition-colors",
            fmt === f
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {t(`content.format.${f}`)}
        </button>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Clapperboard className="h-5 w-5 text-primary shrink-0" />
            <span className="leading-snug">{idea?.headline ?? t("content.scripts")}</span>
          </DialogTitle>
          <DialogDescription>{t("content.scriptsDesc")}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-2 px-2">
          {loading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !hasScripts ? (
            <div className="py-10 text-center space-y-4">
              <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {t("content.scriptsEmpty")}
              </p>
              {formatPicker}
              <Button onClick={() => run()} disabled={generating} className="gap-2">
                {generating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generating ? t("content.writing") : t("content.generateScripts")}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {short && (
                <ShortScript
                  script={short}
                  onEdit={(t) => updateScript(short.id, { script: t })}
                  onRecord={() =>
                    setTele({ title: idea?.headline ?? "Short script", text: short.script })
                  }
                />
              )}
              {short && long && <div className="border-t" />}
              {long && (
                <LongScript
                  script={long}
                  onEdit={(t) => updateScript(long.id, { script: t })}
                  onRecord={() =>
                    setTele({ title: idea?.headline ?? "Long script", text: long.script })
                  }
                />
              )}
            </div>
          )}
        </ScrollArea>

        {hasScripts && (
          <div className="pt-2 border-t space-y-2">
            {formatPicker}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => run()}
              disabled={generating}
            >
              <RefreshCw className={cn("h-4 w-4", generating && "animate-spin")} />
              {generating ? t("content.writing") : t("content.regenerate")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => run("shorter")}
                disabled={generating}
              >
                {t("content.shorter")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => run("longer")}
                disabled={generating}
              >
                {t("content.longer")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => run("punchier")}
                disabled={generating}
              >
                {t("content.punchier")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <Teleprompter
        open={!!tele}
        onOpenChange={(o) => {
          if (!o) setTele(null);
        }}
        title={tele?.title ?? ""}
        text={tele?.text ?? ""}
      />
    </Dialog>
  );
}
