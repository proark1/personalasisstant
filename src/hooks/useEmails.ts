import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { moduleBus } from '@/lib/moduleEventBus';
import { moduleHealth } from '@/lib/moduleHealth';

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

const SYNC_INTERVAL = 5 * 60 * 1000;
const SYNC_KEY = 'email_last_sync';

interface UseEmailsOptions {
  enabled?: boolean;
  autoSync?: boolean;
}

export function useEmails({ enabled = true, autoSync = true }: UseEmailsOptions = {}) {
  const { user } = useAuth();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<EmailView>('smart');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const autoSyncDone = useRef(false);
  const lastArchived = useRef<{ id: string; email: Email } | null>(null);
  const [handledToday, setHandledToday] = useState(0);

  const fetchEmails = useCallback(async () => {
    if (!user || !enabled) {
      setEmails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_emails')
        .select('*')
        .eq('user_id', user.id)
        .eq('user_archived', false)
        .order('received_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setEmails((data as unknown as Email[]) || []);
      moduleHealth.reportSuccess('emails');
    } catch (e) {
      console.error('Failed to fetch emails:', e);
      moduleHealth.reportError('emails', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  const syncEmails = useCallback(async () => {
    if (!user || syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-sync', { body: { maxResults: 30 } });
      if (error) throw error;
      if (data?.error === 'no_gmail_connection') { toast.error('No Google account connected.'); return; }
      if (data?.error === 'gmail_scope_missing') { toast.error('Gmail access not authorized.'); return; }
      if (data?.error) { toast.error(data.message || 'Failed to sync emails'); return; }
      localStorage.setItem(SYNC_KEY, Date.now().toString());
      const newCount = data?.newEmails || 0;
      if (newCount > 0) {
        toast.success(`${newCount} new email${newCount !== 1 ? 's' : ''} synced`);
      } else {
        toast.success('Inbox up to date');
      }
      moduleHealth.reportSuccess('gmail-sync');
      moduleBus.emit('email:synced', { newCount }, 'useEmails');
      await fetchEmails();
    } catch (e) {
      console.error('Sync error:', e);
      moduleHealth.reportError('gmail-sync', e);
      toast.error('Failed to sync emails');
    } finally {
      setSyncing(false);
    }
  }, [user, syncing, fetchEmails]);

  useEffect(() => {
    if (!enabled || !autoSync || !user || autoSyncDone.current) return;
    autoSyncDone.current = true;
    const lastSync = parseInt(localStorage.getItem(SYNC_KEY) || '0');
    if (Date.now() - lastSync > SYNC_INTERVAL) syncEmails();
  }, [enabled, autoSync, user, syncEmails]);

  const lastSyncTime = useMemo(() => {
    const ts = parseInt(localStorage.getItem(SYNC_KEY) || '0');
    if (!ts) return null;
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3600_000)}h ago`;
  }, [syncing]);

  const updateEmail = useCallback(async (emailId: string, updates: Partial<Email>) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('user_emails').update(updates as any).eq('id', emailId).eq('user_id', user.id);
      if (error) throw error;
      setEmails(prev => prev.map(e => e.id === emailId ? { ...e, ...updates } : e));
    } catch (e) {
      console.error('Update email error:', e);
      toast.error('Failed to update email');
    }
  }, [user]);

  const batchUpdateEmails = useCallback(async (ids: string[], updates: Partial<Email>) => {
    if (!user || ids.length === 0) return;
    try {
      const { error } = await supabase.from('user_emails').update(updates as any).in('id', ids).eq('user_id', user.id);
      if (error) throw error;
      const idSet = new Set(ids);
      setEmails(prev => prev.map(e => idSet.has(e.id) ? { ...e, ...updates } : e));
    } catch (e) {
      console.error('Batch update email error:', e);
      toast.error('Failed to update emails');
    }
  }, [user]);

  const archiveEmail = useCallback(async (emailId: string) => {
    const emailToArchive = emails.find(e => e.id === emailId);
    if (emailToArchive) lastArchived.current = { id: emailId, email: emailToArchive };
    await updateEmail(emailId, { user_archived: true });
    setEmails(prev => prev.filter(e => e.id !== emailId));
    setHandledToday(prev => prev + 1);
    moduleBus.emit('email:archived', { emailId }, 'useEmails');
    toast.success('Email archived', {
      action: {
        label: 'Undo',
        onClick: () => undoArchive(),
      },
      duration: 5000,
    });
  }, [updateEmail, emails]);

  const undoArchive = useCallback(async () => {
    if (!lastArchived.current) return;
    const { id, email } = lastArchived.current;
    await updateEmail(id, { user_archived: false });
    setEmails(prev => [...prev, email].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()));
    lastArchived.current = null;
    toast.success('Email restored');
  }, [updateEmail]);

  const markImportant = useCallback(async (emailId: string) => {
    const email = emails.find(e => e.id === emailId);
    if (!email) return;
    await updateEmail(emailId, { is_important: !email.is_important, priority_score: email.is_important ? 3 : 1 });
  }, [emails, updateEmail]);

  const markAsRead = useCallback(async (emailId: string) => {
    await updateEmail(emailId, { is_read: true });
    moduleBus.emit('email:read', { emailId }, 'useEmails');
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

  const categorizeEmail = useCallback(async (emailId: string, priority: 'high' | 'medium' | 'low' | 'spam') => {
    if (!user) return;
    const email = emails.find(e => e.id === emailId);
    if (!email) return;

    if (priority === 'spam') {
      await reportSpam(emailId);
      return;
    }

    const mapping = {
      high: { priority_score: 1, category: 'action_required' },
      medium: { priority_score: 3, category: 'fyi' },
      low: { priority_score: 5, category: 'newsletter' },
    };

    const updates = mapping[priority];
    await updateEmail(emailId, updates);

    // Create sender rule for the domain
    const domain = email.from_email.split('@')[1];
    if (domain) {
      try {
        await supabase.from('email_sender_rules').upsert(
          { user_id: user.id, sender_pattern: `*@${domain}`, default_category: updates.category, default_priority: updates.priority_score } as any,
          { onConflict: 'user_id,sender_pattern' }
        );
      } catch (e) {
        console.error('Sender rule error:', e);
      }
    }
    toast.success(`Marked as ${priority} priority`);
  }, [user, emails, updateEmail, reportSpam]);

  const createSenderRule = useCallback(async (senderPattern: string, rule: { default_category?: string; default_priority?: number; auto_archive?: boolean }) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('email_sender_rules').upsert({ user_id: user.id, sender_pattern: senderPattern, ...rule } as any, { onConflict: 'user_id,sender_pattern' });
      if (error) throw error;
      toast.success(`Rule created for ${senderPattern}`);
    } catch (e) {
      console.error('Create sender rule error:', e);
      toast.error('Failed to create rule');
    }
  }, [user]);

  const fetchEmailBody = useCallback(async (gmailMessageId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-fetch-email', { body: { messageId: gmailMessageId } });
      if (error) throw error;
      return data?.body || null;
    } catch (e) {
      console.error('Fetch body error:', e);
      return null;
    }
  }, []);

  const sendReply = useCallback(async (email: Email, replyBody: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-send-reply', {
        body: { to: email.from_email, subject: email.subject, body: replyBody, threadId: email.thread_id, gmailMessageId: email.gmail_message_id },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return false; }
      toast.success('Reply sent!');
      return true;
    } catch (e) {
      console.error('Send reply error:', e);
      toast.error('Failed to send reply');
      return false;
    }
  }, []);

  const composeEmail = useCallback(async (to: string, subject: string, body: string, threadId?: string | null, gmailMessageId?: string | null): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-send-reply', {
        body: { to, subject, body, threadId: threadId || null, gmailMessageId: gmailMessageId || null },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return false; }
      toast.success('Email sent!');
      return true;
    } catch (e) {
      console.error('Compose error:', e);
      toast.error('Failed to send email');
      return false;
    }
  }, []);

  // Batch operations
  const batchArchive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await batchUpdateEmails(ids, { user_archived: true });
    setEmails(prev => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`Archived ${ids.length} emails`);
  }, [selectedIds, batchUpdateEmails]);

  const batchMarkRead = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await batchUpdateEmails(ids, { is_read: true });
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`Marked ${ids.length} as read`);
  }, [selectedIds, batchUpdateEmails]);

  const batchReportSpam = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await batchUpdateEmails(ids, { user_archived: true, is_spam: true });
    setEmails(prev => prev.filter(e => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    toast.success(`Reported ${ids.length} as spam`);
  }, [selectedIds, batchUpdateEmails]);

  const toggleSelect = useCallback((emailId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId); else next.add(emailId);
      return next;
    });
  }, []);

  const selectAll = useCallback((emailList: Email[]) => {
    setSelectedIds(new Set(emailList.map(e => e.id)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  const filterBySearch = useCallback((emailList: Email[]): Email[] => {
    if (!searchQuery.trim()) return emailList;
    const q = searchQuery.toLowerCase();
    return emailList.filter(e =>
      (e.subject?.toLowerCase().includes(q)) ||
      (e.from_name?.toLowerCase().includes(q)) ||
      (e.from_email?.toLowerCase().includes(q)) ||
      (e.ai_summary?.toLowerCase().includes(q)) ||
      (e.snippet?.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const activeEmails = useMemo(() => {
    const now = new Date();
    return emails.filter(e => { if (e.user_snoozed_until) return new Date(e.user_snoozed_until) <= now; return true; });
  }, [emails]);

  const snoozedEmails = useMemo(() => {
    const now = new Date();
    return emails.filter(e => e.user_snoozed_until && new Date(e.user_snoozed_until) > now);
  }, [emails]);

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
      threads.push({ latestEmail: threadEmails[0], threadCount: threadEmails.length, allEmails: threadEmails });
    }
    for (const e of noThread) threads.push({ latestEmail: e, threadCount: 1, allEmails: [e] });
    threads.sort((a, b) => new Date(b.latestEmail.received_at).getTime() - new Date(a.latestEmail.received_at).getTime());
    return threads;
  }, []);

  const grouped = useMemo(() => {
    const searched = filterBySearch(activeEmails);
    const clean = searched.filter(e => !e.is_spam && !e.is_phishing);
    const flagged = searched.filter(e => e.is_spam || e.is_phishing);
    const attention = clean.filter(e => e.category === 'action_required' || e.priority_score <= 2 || e.is_important || e.sentiment === 'urgent').sort((a, b) => a.priority_score - b.priority_score);
    const fyi = clean.filter(e => !attention.includes(e) && !['newsletter', 'promotion'].includes(e.category));
    const lowPriority = clean.filter(e => ['newsletter', 'promotion'].includes(e.category));
    return {
      attention: groupByThread(attention),
      fyi: groupByThread(fyi),
      lowPriority: groupByThread(lowPriority),
      flagged: groupByThread(flagged),
      snoozed: groupByThread(snoozedEmails),
    };
  }, [activeEmails, snoozedEmails, groupByThread, filterBySearch]);

  const viewEmails = useMemo(() => {
    const searched = filterBySearch(activeEmails);
    if (view === 'smart') return null;
    if (view === 'flagged') return groupByThread(searched.filter(e => e.is_spam || e.is_phishing));
    return groupByThread(searched);
  }, [view, activeEmails, groupByThread, filterBySearch]);

  const unreadCount = activeEmails.filter(e => !e.is_read && !e.user_archived).length;
  const priorityCount = activeEmails.filter(e => (e.priority_score <= 2 || e.is_important) && !e.is_read).length;
  const flaggedCount = grouped.flagged.length;

  return {
    emails: viewEmails, grouped, allEmails: activeEmails, loading, syncing, view, setView,
    syncEmails, updateEmail, archiveEmail, markImportant, markAsRead, reportSpam, snoozeEmail, createSenderRule,
    fetchEmailBody, sendReply, composeEmail, categorizeEmail,
    searchQuery, setSearchQuery,
    selectMode, setSelectMode, selectedIds, toggleSelect, selectAll, clearSelection,
    batchArchive, batchMarkRead, batchReportSpam,
    unreadCount, priorityCount, flaggedCount, lastSyncTime, handledToday, refetch: fetchEmails,
  };
}
