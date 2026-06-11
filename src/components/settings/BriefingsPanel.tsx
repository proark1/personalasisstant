import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Newspaper, Plus, Trash2, X, Send, Clock, Sunrise } from 'lucide-react';
import {
  useBriefings,
  type Briefing,
  type BriefingChannel,
} from '@/hooks/useBriefings';
import { BriefingFeedCard } from '@/components/notifications/BriefingFeedCard';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CHANNELS: { key: BriefingChannel; label: string }[] = [
  { key: 'telegram', label: 'Telegram text' },
  { key: 'telegram_voice', label: 'Telegram voice' },
  { key: 'push', label: 'Push' },
];

function toTimeInput(value: string): string {
  // Accepts "HH:MM:SS" or "HH:MM" → "HH:MM" for <input type="time">.
  return (value || '08:00').slice(0, 5);
}

export function BriefingsPanel() {
  const { briefings, loading, createBriefing, updateBriefing, deleteBriefing, sendNow } = useBriefings();
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    await createBriefing();
    setCreating(false);
  };

  // One tap to set up an automatic morning + evening push briefing pair.
  const handleQuickStart = async () => {
    setCreating(true);
    await createBriefing({
      name: 'Morning Briefing',
      topics: [],
      deliver_at: '08:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      channels: ['push'],
      max_items: 5,
      enabled: true,
    });
    await createBriefing({
      name: 'Evening Briefing',
      topics: [],
      deliver_at: '20:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      channels: ['push'],
      max_items: 5,
      enabled: true,
    });
    setCreating(false);
  };

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Daily Briefings
          </h2>
          <p className="text-sm text-muted-foreground">
            Proactive briefings on the topics you care about, delivered on your schedule
          </p>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : briefings.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <Newspaper className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No briefings yet. Get an automatic morning and evening push, or build your own.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={handleQuickStart} disabled={creating}>
                <Sunrise className="h-4 w-4 mr-1" />
                Add morning + evening push
              </Button>
              <Button variant="outline" onClick={handleCreate} disabled={creating}>
                <Plus className="h-4 w-4 mr-1" />
                Create a custom briefing
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {briefings.map((b) => (
            <BriefingCard
              key={b.id}
              briefing={b}
              onUpdate={(updates) => updateBriefing(b.id, updates)}
              onDelete={() => deleteBriefing(b.id)}
              onSendNow={() => sendNow(b.id)}
            />
          ))}
          <BriefingFeedCard hideWhenEmpty />
        </>
      )}
    </div>
  );
}

function BriefingCard({
  briefing,
  onUpdate,
  onDelete,
  onSendNow,
}: {
  briefing: Briefing;
  onUpdate: (updates: Partial<Briefing>) => void;
  onDelete: () => void;
  onSendNow: () => void;
}) {
  const [name, setName] = useState(briefing.name);
  const [topicInput, setTopicInput] = useState('');
  const [sending, setSending] = useState(false);

  const topics = briefing.topics || [];
  const channels = briefing.channels || [];
  const days = briefing.days_of_week || [];

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t || topics.includes(t)) { setTopicInput(''); return; }
    onUpdate({ topics: [...topics, t] });
    setTopicInput('');
  };

  const removeTopic = (t: string) => onUpdate({ topics: topics.filter((x) => x !== t) });

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b);
    onUpdate({ days_of_week: next });
  };

  const toggleChannel = (c: BriefingChannel) => {
    const next = channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c];
    onUpdate({ channels: next });
  };

  const handleSendNow = async () => {
    setSending(true);
    await onSendNow();
    setSending(false);
  };

  return (
    <Card className={cn(!briefing.enabled && 'opacity-60')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== briefing.name) onUpdate({ name: name.trim() }); }}
            className="h-8 text-base font-semibold border-0 px-0 focus-visible:ring-0 shadow-none"
            placeholder="Briefing name"
          />
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={briefing.enabled}
              onCheckedChange={(enabled) => onUpdate({ enabled })}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Topics */}
        <div className="space-y-2">
          <Label className="text-sm">Topics</Label>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1 pr-1">
                {t}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => removeTopic(t)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {topics.length === 0 && (
              <span className="text-xs text-muted-foreground">Add topics like "AI", "crypto", "Premier League"</span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              placeholder="Add a topic"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
            />
            <Button type="button" variant="outline" size="icon" onClick={addTopic}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label className="text-sm flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Delivery time (your local time)
          </Label>
          <Input
            type="time"
            step={900}
            value={toTimeInput(briefing.deliver_at)}
            onChange={(e) => onUpdate({ deliver_at: e.target.value })}
            className="w-36"
          />
        </div>

        {/* Days */}
        <div className="space-y-2">
          <Label className="text-sm">Days</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(idx)}
                className={cn(
                  'h-8 w-11 rounded-md border text-xs font-medium transition-colors',
                  days.includes(idx)
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Channels */}
        <div className="space-y-2">
          <Label className="text-sm">Deliver via</Label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleChannel(key)}
                className={cn(
                  'h-8 px-3 rounded-md border text-xs font-medium transition-colors',
                  channels.includes(key)
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {(channels.includes('telegram') || channels.includes('telegram_voice')) && (
            <p className="text-xs text-muted-foreground">
              Telegram delivery requires your account to be linked in the Telegram tab. Voice briefings always send the text version too, so links and fallback are preserved.
            </p>
          )}
        </div>

        {/* Send now */}
        <Button variant="outline" className="w-full" onClick={handleSendNow} disabled={sending}>
          <Send className="h-4 w-4 mr-1" />
          {sending ? 'Sending…' : 'Send now'}
        </Button>
      </CardContent>
    </Card>
  );
}
