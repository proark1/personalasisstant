import { useState } from 'react';
import { BookHeart, Plus, Trash2 } from 'lucide-react';
import { PanelShell } from '@/components/ui/panel-shell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useJournal } from '@/hooks/useJournal';

export function JournalPanel() {
  const { entries, milestones, bucket, isLoading, addEntry, addMilestone, addBucketItem, remove } = useJournal();
  const [content, setContent] = useState('');
  const [mTitle, setMTitle] = useState(''); const [mDate, setMDate] = useState('');
  const [bTitle, setBTitle] = useState('');

  return (
    <PanelShell icon={BookHeart} title="Journal & Memories" subtitle={`${entries.length} entries · ${milestones.length} milestones · ${bucket.length} bucket items`} loading={isLoading}>
      <Tabs defaultValue="journal" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="bucket">Bucket List</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-3 mt-4">
          <Textarea placeholder="What's on your mind today?" value={content} onChange={e => setContent(e.target.value)} rows={4} />
          <Button className="w-full" onClick={() => { if (content.trim()) { addEntry({ content }); setContent(''); } }}>
            <Plus className="h-4 w-4 mr-2" />Save entry
          </Button>
          {entries.map(e => (
            <Card key={e.id} className="p-3">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">{e.entry_date} · {e.mood || '—'}</p>
                  <p className="whitespace-pre-wrap text-sm">{e.content}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove('journal_entries', e.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="milestones" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Milestone title" value={mTitle} onChange={e => setMTitle(e.target.value)} />
            <Input type="date" value={mDate} onChange={e => setMDate(e.target.value)} />
            <Button onClick={() => { if (mTitle && mDate) { addMilestone({ title: mTitle, occurred_on: mDate }); setMTitle(''); setMDate(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {milestones.map(m => (
            <Card key={m.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">{m.occurred_on} · {m.category || '—'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('life_milestones', m.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bucket" className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input placeholder="Bucket list item" value={bTitle} onChange={e => setBTitle(e.target.value)} />
            <Button onClick={() => { if (bTitle) { addBucketItem({ title: bTitle, status: 'planning' }); setBTitle(''); } }}><Plus className="h-4 w-4" /></Button>
          </div>
          {bucket.map(b => (
            <Card key={b.id} className="p-3 flex justify-between">
              <div>
                <p className="font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.status || '—'} · {b.target_year || '—'}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove('bucket_list', b.id)}><Trash2 className="h-4 w-4" /></Button>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </PanelShell>
  );
}
