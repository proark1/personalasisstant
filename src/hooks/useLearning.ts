import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Book { id: string; user_id: string; title: string; author: string | null; status: string | null; rating: number | null; started_on: string | null; finished_on: string | null; cover_url: string | null; notes: string | null; tags: string[] | null; }
export interface Course { id: string; user_id: string; title: string; provider: string | null; url: string | null; status: string | null; progress_percent: number | null; started_on: string | null; completed_on: string | null; certificate_url: string | null; notes: string | null; }
export interface Skill { id: string; user_id: string; name: string; current_level: string | null; target_level: string | null; category: string | null; last_practiced: string | null; practice_frequency: string | null; notes: string | null; }

export function useLearning() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    if (!user) return; setIsLoading(true);
    try {
      const [b, c, s] = await Promise.all([
        supabase.from('books').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('courses').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('skills').select('*').eq('user_id', user.id).order('name'),
      ]);
      setBooks((b.data as any) || []); setCourses((c.data as any) || []); setSkills((s.data as any) || []);
    } finally { setIsLoading(false); }
  };
  useEffect(() => { if (user) refresh(); }, [user]);

  const addBook = async (p: Partial<Book>) => { if (!user) return; const { error } = await supabase.from('books').insert({ ...p, user_id: user.id, title: p.title! }); if (error) return toast.error(error.message); toast.success('Added'); refresh(); };
  const updateBook = async (id: string, p: Partial<Book>) => { const { error } = await supabase.from('books').update(p).eq('id', id); if (error) return toast.error(error.message); refresh(); };
  const addCourse = async (p: Partial<Course>) => { if (!user) return; const { error } = await supabase.from('courses').insert({ ...p, user_id: user.id, title: p.title! }); if (error) return toast.error(error.message); toast.success('Added'); refresh(); };
  const addSkill = async (p: Partial<Skill>) => { if (!user) return; const { error } = await supabase.from('skills').insert({ ...p, user_id: user.id, name: p.name! }); if (error) return toast.error(error.message); toast.success('Added'); refresh(); };
  const remove = async (table: 'books'|'courses'|'skills', id: string) => { const { error } = await supabase.from(table).delete().eq('id', id); if (error) return toast.error(error.message); toast.success('Deleted'); refresh(); };

  return { books, courses, skills, isLoading, addBook, updateBook, addCourse, addSkill, remove, refresh };
}
