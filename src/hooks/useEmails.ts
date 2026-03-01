import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Email {
  id: string;
  user_id: string;
  gmail_message_id: string;
  thread_id: string | null;
  from_email: string;
  from_name: string | null;
  to_email: string | null;
  subject: string | null;
  snippet: string | null;
  body_preview: string | null;
  received_at: string;
  is_read: boolean;
  is_starred: boolean;
  gmail_labels: string[];
  matched_contact_id: string | null;
  priority_score: number;
  category: string;
  user_archived: boolean;
  user_snoozed_until: string | null;
  is_important: boolean;
  ai_summary: string | null;
  ai_suggested_action: string | null;
  is_spam: boolean;
  is_phishing: boolean;
  threat_reason: string | null;
  sentiment: string | null;
  created_at: string;
  updated_at: string;
}

export type EmailView = 'smart' | 'all' | 'flagged';

export function useEmails() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<EmailView>('smart');

  const fetchEmails = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_emails')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_archived', false)
        .order('received_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setEmails((data as unknown as Email[]) || []);
    } catch (e) {
      console.error('Failed to fetch emails:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const syncEmails = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-sync', {
        body: { maxResults: 30 },
      });

      if (error) throw error;
      if (data?.error === 'no_gmail_connection') {
        toast.error('No Google account connected. Connect via Settings → Calendar.');
        return;
      }
      if (data?.error === 'gmail_scope_missing') {
        toast.error('Gmail access not authorized. Please reconnect your Google account.');
        return;
      }
      if (data?.error) {
        toast.error(data.message || 'Failed to sync emails');
        return;
      }

      toast.success(`Synced ${data?.synced || 0} emails`);
      await fetchEmails();
    } catch (e) {
      console.error('Sync error:', e);
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, fetchEmails]);

  const updateEmail = useCallback(async (emailId: string, updates: Partial<Email>) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_emails')
        .update(updates as any)
        .eq('id', emailId)
        .eq('user_id', user.id);

      if (error) throw error;
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, ...updates } : e));
    } catch (e) {
      console.error('Update email error:', e);
      toast.error('Failed to update email');
    }
  }, [user]);

  const archiveEmail = useCallback(async (emailId: string) => {
    await updateEmail(emailId, { user_archived: true });
    setEmails(prev => prev.filter(e => e.id !== emailId));
    toast.success('Email archived');
  }, [updateEmail]);

  const markImportant = useCallback(async (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;
    await updateEmail(emailId, { is_important: !email.is_important, priority_score: email.is_important ? 3 : 1 });
  }, [emails, updateEmail]);

  const markAsRead = useCallback(async (emailId: string) => {
    await updateEmail(emailId, { is_read: true });
  }, [updateEmail]);

  const reportSpam = useCallback(async (emailId: string) => {
    await updateEmail(emailId, { user_archived: true, is_spam: true });
    setEmails(prev => prev.filter(e => e.id !== emailId));
    toast.success('Reported as spam');
  }, [updateEmail]);

  // Smart grouping
  const grouped = useMemo(() => {
    const clean = emails.filter(e => !e.is_spam && !e.is_phishing);
    const flagged = emails.filter(e => e.is_spam || e.is_phishing);

    const attention = clean.filter(e =>
      e.category === 'action_required' || e.priority_score <= 2 || e.is_important || e.sentiment === 'urgent'
    ).sort((a, b) => a.priority_score - b.priority_score);

    const fyi = clean.filter(e =>
      !attention.includes(e) && !['newsletter', 'promotion'].includes(e.category)
    );

    const lowPriority = clean.filter(e =>
      ['newsletter', 'promotion'].includes(e.category)
    );

    return { attention, fyi, lowPriority, flagged };
  }, [emails]);

  const viewEmails = useMemo(() => {
    if (view === 'smart') return null; // use grouped
    if (view === 'flagged') return grouped.flagged;
    return emails;
  }, [view, emails, grouped]);

  const unreadCount = emails.filter(e => !e.is_read && !e.user_archived).length;
  const priorityCount = emails.filter(e => (e.priority_score <= 2 || e.is_important) && !e.is_read).length;
  const flaggedCount = grouped.flagged.length;

  return {
    emails: viewEmails,
    grouped,
    allEmails: emails,
    loading,
    syncing,
    view,
    setView,
    syncEmails,
    updateEmail,
    archiveEmail,
    markImportant,
    markAsRead,
    reportSpam,
    unreadCount,
    priorityCount,
    flaggedCount,
    refetch: fetchEmails,
  };
}
