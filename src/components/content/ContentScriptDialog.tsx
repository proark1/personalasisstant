import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Clapperboard, Copy, Check, RefreshCw, Sparkles } from 'lucide-react';
import { useContentScripts } from '@/hooks/useContentScripts';
import { platformLabel, formatDuration, type ContentIdea, type ContentScript } from '@/lib/content';

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };
  return (
    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

function ShortScript({ script, onEdit }: { script: ContentScript; onEdit: (text: string) => void }) {
  const [text, setText] = useState(script.script);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Short-form</Badge>
        <Badge variant="outline">~{formatDuration(script.duration_seconds)}</Badge>
      </div>
      {script.hook && (
        <Section title="Hook (0–2s)" action={<CopyButton text={script.hook} />}>
          <p className="text-sm italic rounded-md bg-muted/50 p-2">“{script.hook}”</p>
        </Section>
      )}
      <Section title="Spoken script" action={<CopyButton text={text} />}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text !== script.script) onEdit(text); }}
          className="min-h-[140px] text-sm"
        />
      </Section>
      {script.shot_list && (
        <Section title="Shots / B-roll" action={<CopyButton text={script.shot_list} />}>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-2">{script.shot_list}</p>
        </Section>
      )}
      {script.platform_variants?.length > 0 && (
        <Section title="Per-platform captions">
          <div className="space-y-2">
            {script.platform_variants.map((v, i) => (
              <div key={i} className="rounded-md border p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{platformLabel(v.platform)}</Badge>
                  <CopyButton
                    text={`${v.caption}\n\n${(v.hashtags || []).map((h) => `#${h}`).join(' ')}`}
                    label="Copy caption"
                  />
                </div>
                {v.hook && <p className="text-sm italic">“{v.hook}”</p>}
                {v.caption && <p className="text-sm">{v.caption}</p>}
                {v.hashtags?.length > 0 && (
                  <p className="text-xs text-primary">{v.hashtags.map((h) => `#${h}`).join(' ')}</p>
                )}
                {v.notes && <p className="text-xs text-muted-foreground">💡 {v.notes}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {script.cta && (
        <Section title="Call to action"><p className="text-sm">{script.cta}</p></Section>
      )}
    </div>
  );
}

function LongScript({ script, onEdit }: { script: ContentScript; onEdit: (text: string) => void }) {
  const [text, setText] = useState(script.script);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Long-form · YouTube</Badge>
        <Badge variant="outline">~{formatDuration(script.duration_seconds)}</Badge>
      </div>
      {script.title_options?.length > 0 && (
        <Section title="Title options">
          <ul className="space-y-1">
            {script.title_options.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm rounded-md bg-muted/50 px-2 py-1">
                <span>{t}</span>
                <CopyButton text={t} label="" />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {script.thumbnail_concept && (
        <Section title="Thumbnail concept"><p className="text-sm">{script.thumbnail_concept}</p></Section>
      )}
      {script.hook && (
        <Section title="Hook (0–15s)" action={<CopyButton text={script.hook} />}>
          <p className="text-sm italic rounded-md bg-muted/50 p-2">“{script.hook}”</p>
        </Section>
      )}
      <Section title="Full script" action={<CopyButton text={text} />}>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text !== script.script) onEdit(text); }}
          className="min-h-[200px] text-sm"
        />
      </Section>
      {script.description && (
        <Section title="Description (SEO)" action={<CopyButton text={script.description} />}>
          <p className="text-sm whitespace-pre-wrap rounded-md bg-muted/50 p-2">{script.description}</p>
        </Section>
      )}
      {script.hashtags?.length > 0 && (
        <Section title="Tags"><p className="text-xs text-primary">{script.hashtags.map((h) => `#${h}`).join(' ')}</p></Section>
      )}
      {script.cta && <Section title="Call to action"><p className="text-sm">{script.cta}</p></Section>}
    </div>
  );
}

interface Props {
  idea: ContentIdea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContentScriptDialog({ idea, open, onOpenChange }: Props) {
  const { scripts, loading, generating, generate, updateScript } = useContentScripts(idea?.id ?? null);
  const short = scripts.find((s) => s.format === 'short');
  const long = scripts.find((s) => s.format === 'long');
  const hasScripts = scripts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Clapperboard className="h-5 w-5 text-primary shrink-0" />
            <span className="leading-snug">{idea?.headline ?? 'Scripts'}</span>
          </DialogTitle>
          <DialogDescription>
            Short-form (TikTok / Reels / Shorts) and long-form (YouTube) scripts in your voice.
          </DialogDescription>
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
                Generate a punchy short-form script and a full YouTube script for this idea,
                written in your voice and tuned to each platform.
              </p>
              <Button onClick={() => generate(['short', 'long'])} disabled={generating} className="gap-2">
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? 'Writing…' : 'Generate scripts'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {short && <ShortScript script={short} onEdit={(t) => updateScript(short.id, { script: t })} />}
              {short && long && <div className="border-t" />}
              {long && <LongScript script={long} onEdit={(t) => updateScript(long.id, { script: t })} />}
            </div>
          )}
        </ScrollArea>

        {hasScripts && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => generate(['short', 'long'])}
              disabled={generating}
            >
              {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {generating ? 'Regenerating…' : 'Regenerate scripts'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
