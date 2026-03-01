import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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

export interface EmailThread {
  latestEmail: Email;
  threadCount: number;
  allEmails: Email[];
}

export type EmailView = 'smart' | 'all' | 'flagged';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_KEY = 'email_last_sync';

export function useEmails() {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<EmailView>('smart');
  const autoSyncDone = useRef(false);

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

  // Auto-sync if > 5 min since last sync
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

      localStorage.setItem(SYNC_KEY, Date.now().toString());
      toast.success(`Synced ${data?.synced || 0} emails`);
      await fetchEmails();
    } catch (e) {
      console.error('Sync error:', e);
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, fetchEmails]);

  // Auto-sync on mount
  useEffect(() => {
    if (!user || autoSyncDone.current) return;
    autoSyncDone.current = true;
    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) || '0');
    if (Date.now() - lastSync > SYNC_INTERVAL) {
      syncEmails();
    }
  }, [user, syncEmails]);

  const lastSyncTime = useMemo(() => {
    const ts = parseInt(localStorage.getItem(SYNC_KEY) || '0');
    if (!ts) return null;
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3600_000)}h ago`;
  }, [syncing]); // re-compute after sync

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

  const snoozeEmail = useCallback(async (emailId: string, until: Date) => {
    await updateEmail(emailId, { user_snoozed_until: until.toISOString() });
    setEmails(prev => prev.filter(e => e.id !== emailId));
    toast.success(`Snoozed until ${until.toLocaleDateString()}`);
  }, [updateEmail]);

  const createSenderRule = useCallback(async (senderPattern: string, rule: { default_category?: string; default_priority?: number; auto_archive?: boolean }) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('email_sender_rules')
        .upsert({
          user_id: user.id,
          sender_pattern: senderPattern,
          ...rule,
        } as any, { onConflict: 'user_id,sender_pattern' });

      if (error) throw error;
      toast.success(`Rule created for ${senderPattern}`);
    } catch (e) {
      console.error('Create sender rule error:', e);
      toast.error('Failed to create rule');
    }
  }, [user]);

  // Filter out snoozed emails
  const activeEmails = useMemo(() => {
    const now = new Date();
    return emails.filter(e => {
      if (e.user_snoozed_until) {
        return new Date(e.user_snoozed_until) <= now;
      }
      return true;
    });
  }, [emails]);

  const snoozedEmails = useMemo(() => {
    const now = new Date();
    return emails.filter(e => e.user_snoozed_until && new Date(e.user_snoozed_until) > now);
  }, [emails]);

  // Thread grouping
  const groupByThread = useCallback((emailList: Email[]): EmailThread[] => {
    const threadMap = new Map<string, Email[]>();
    const noThread: Email[] = [];

    for (const e of emailList) {
      if (e.thread_id) {
        const existing = threadMap.get(e.thread_id) || [];
        existing.push(e);
        threadMap.set(e.thread_id, existing);
      } else {
        noThread.push(e);
      }
    }

    const threads: EmailThread[] = [];
    for (const [, threadEmails] of threadMap) {
      threadEmails.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
      threads.push({
        latestEmail: threadEmails[0],
        threadCount: threadEmails.length,
        allEmails: threadEmails,
      });
    }
    for (const e of noThread) {
      threads.push({ latestEmail: e, threadCount: 1, allEmails: [e] });
    }

    threads.sort((a, b) => new Date(b.latestEmail.received_at).getTime() - new Date(a.latestEmail.received_at).getTime());
    return threads;
  }, []);

  // Smart grouping
  const grouped = useMemo(() => {
    const clean = activeEmails.filter(e => !e.is_spam && !e.is_phishing);
    const flagged = activeEmails.filter(e => e.is_spam || e.is_phishing);

    const attention = clean.filter(e =>
      e.category === 'action_required' || e.priority_score <= 2 || e.is_important || e.sentiment === 'urgent'
    ).sort((a, b) => a.priority_score - b.priority_score);

    const fyi = clean.filter(e =>
      !attention.includes(e) && !['newsletter', 'promotion'].includes(e.category)
    );

    const lowPriority = clean.filter(e =>
      ['newsletter', 'promotion'].includes(e.category)
    );

    return {
      attention: groupByThread(attention),
      fyi: groupByThread(fyi),
      lowPriority: groupByThread(lowPriority),
      flagged: groupByThread(flagged),
      snoozed: groupByThread(snoozedEmails),
    };
  }, [activeEmails, snoozedEmails, groupByThread]);

  const viewEmails = useMemo(() => {
    if (view === 'smart') return null; // use grouped
    if (view === 'flagged') return groupByThread(activeEmails.filter(e => e.is_spam || e.is_phishing));
    return groupByThread(activeEmails);
  }, [view, activeEmails, groupByThread]);

  const unreadCount = activeEmails.filter(e => !e.is_read && !e.user_archived).length;
  const priorityCount = activeEmails.filter(e => (e.priority_score <= 2 || e.is_important) && !e.is_read).length;
  const flaggedCount = grouped.flagged.length;

  return {
    emails: viewEmails,
    grouped,
    allEmails: activeEmails,
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
    snoozeEmail,
    createSenderRule,
    unreadCount,
    priorityCount,
    flaggedCount,
    lastSyncTime,
    refetch: fetchEmails,
  };
}
