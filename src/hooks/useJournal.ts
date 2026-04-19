import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface JournalEntry { id: string; user_id: string; entry_date: string; title: string | null; content: string; mood: string | null; prompt: string | null; tags: string[] | null; is_private: boolean | null; }
export interface Milestone { id: string; user_id: string; title: string; description: string | null; occurred_on: string; category: string | null; related_people: any; photo_url: string | null; }
export interface BucketItem { id: string; user_id: string; title: string; description: string | null; category: string | null; target_year: number | null; status: string | null; achieved_on: string | null; notes: string | null; }

export function useJournal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return; setIsLoading(true);
    try {
      const [e, m, b] = await Promise.all([
        supabase.from('journal_entries').select('*').eq('user_id', user.id).order('entry_date', { ascending: false }).limit(100),
        supabase.from('life_milestones').select('*').eq('user_id', user.id).order('occurred_on', { ascending: false }),
        supabase.from('bucket_list').select('*').eq('user_id', user.id).order('status').order('target_year', { nullsFirst: false }),
      ]);
      setEntries((e.data as any) || []); setMilestones((m.data as any) || []); setBucket((b.data as any) || []);
    } finally { setIsLoading(false); }
  };
  useEffect(() => { if (user) refresh(); }, [user]);

  const addEntry = async (p: Partial<JournalEntry>) => { if (!user) return; const { error } = await supabase.from('journal_entries').insert({ ...p, user_id: user.id, content: p.content!, entry_date: p.entry_date || new Date().toISOString().slice(0,10) }); if (error) return toast.error(error.message); toast.success('Saved'); refresh(); };
  const addMilestone = async (p: Partial<Milestone>) => { if (!user) return; const { error } = await supabase.from('life_milestones').insert({ ...p, user_id: user.id, title: p.title!, occurred_on: p.occurred_on! }); if (error) return toast.error(error.message); toast.success('Added'); refresh(); };
  const addBucketItem = async (p: Partial<BucketItem>) => { if (!user) return; const { error } = await supabase.from('bucket_list').insert({ ...p, user_id: user.id, title: p.title! }); if (error) return toast.error(error.message); toast.success('Added'); refresh(); };
  const updateBucketItem = async (id: string, p: Partial<BucketItem>) => { const { error } = await supabase.from('bucket_list').update(p).eq('id', id); if (error) return toast.error(error.message); refresh(); };
  const remove = async (table: 'journal_entries'|'life_milestones'|'bucket_list', id: string) => { const { error } = await supabase.from(table).delete().eq('id', id); if (error) return toast.error(error.message); toast.success('Deleted'); refresh(); };

  return { entries, milestones, bucket, isLoading, addEntry, addMilestone, addBucketItem, updateBucketItem, remove, refresh };
}
