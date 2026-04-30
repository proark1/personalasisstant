import { useState, useRef, useCallback, useEffect } from 'react';
import { useEmails, EmailView, Email, EmailThread } from '@/hooks/useEmails';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { EmailCard } from './EmailCard';
import { EmailDetailSheet } from './EmailDetailSheet';
import { ComposeEmailSheet } from './ComposeEmailSheet';
import { RecurringPaymentDetector, DetectedPayment } from './RecurringPaymentDetector';
import { reconstructSender } from '@/lib/emailSender';
import { AddEditContractDialog } from '@/components/contracts/AddEditContractDialog';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useContracts, ContractInput } from '@/hooks/useContracts';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { PanelShell, staggerItem } from '@/components/ui/panel-shell';
import { PanelSkeleton } from '@/components/ui/panel-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassCard } from '@/components/ui/glass-card';
import { RefreshCw, Mail, Inbox, ShieldAlert, Loader2, PlugZap, ChevronDown, ChevronRight, Sparkles, Clock, Search, X, CheckSquare, Archive, Eye, Flag, Plus, PartyPopper, Zap, CheckCheck, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useToast } from '@/hooks/use-toast';
import { EmailActionPipelineCard } from '@/components/dashboard/EmailActionPipelineCard';
import { useEmailActionsCount } from '@/hooks/useEmailActionsCount';

function EmailSection({ title, count, threads, defaultOpen = true, onSelect, onArchive, onToggleImportant, icon: Icon, selectMode, selectedIds, onToggleSelect }: {
  title: string;
  count: number;
  threads: EmailThread[];
  defaultOpen?: boolean;
  onSelect: (email: Email) => void;
  onArchive?: (id: string) => void;
  onToggleImportant?: (id: string) => void;
  icon?: typeof Mail;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;

  return (
    <motion.div variants={staggerItem} className="space-y-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {Icon && <Icon className="w-3 h-3" />}
        {title}
        <span className="ml-auto text-[10px] font-medium bg-muted rounded-full px-1.5 py-0.5 normal-case">{count}</span>
      </button>
      {open && (
        <div className="space-y-1.5">
          {threads.map(thread => (
            <EmailCard
              key={thread.latestEmail.id}
              thread={thread}
              onSelect={onSelect}
              onArchive={onArchive}
              onToggleImportant={onToggleImportant}
              selectMode={selectMode}
              isSelected={selectedIds?.has(thread.latestEmail.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function StatsBanner({ unread, priority, handled }: { unread: number; priority: number; handled: number }) {
  return (
    <GlassCard className="grid w-full min-w-0 grid-cols-3 gap-2 px-3 py-2.5 text-xs overflow-hidden">
      <div className="flex min-w-0 items-center gap-1.5">
        <Mail className="w-3 h-3 text-primary" />
        <span className="truncate text-muted-foreground">Unread</span>
        <AnimatedCounter value={unread} className="font-semibold text-foreground" />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 justify-center">
        <Zap className="w-3 h-3 text-destructive" />
        <span className="truncate text-muted-foreground">Priority</span>
        <AnimatedCounter value={priority} className="font-semibold text-foreground" />
      </div>
      <div className="flex min-w-0 items-center gap-1.5 justify-end">
        <CheckCheck className="w-3 h-3 text-emerald-500" />
        <span className="truncate text-muted-foreground">Handled</span>
        <AnimatedCounter value={handled} className="font-semibold text-foreground" />
      </div>
    </GlassCard>
  );
}

function InboxZeroState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center space-y-3"
    >
      <motion.div
        initial={{ rotate: -10 }}
        animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <PartyPopper className="w-12 h-12 text-primary" />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground">All caught up! 🎉</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        You've handled everything. Enjoy your free time — we'll notify you when something important comes in.
      </p>
    </motion.div>
  );
}

export function EmailPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected, loading: connectionLoading, connectGmail } = useGmailConnection();
  const {
    emails, grouped, loading, syncing, view, setView,
    syncEmails, archiveEmail, markImportant, markAsRead, reportSpam, snoozeEmail, createSenderRule,
    fetchEmailBody, sendReply, composeEmail, categorizeEmail,
    searchQuery, setSearchQuery,
    selectMode, setSelectMode, selectedIds, toggleSelect, clearSelection,
    batchArchive, batchMarkRead, batchReportSpam,
    unreadCount, priorityCount, flaggedCount, lastSyncTime, handledToday,
  } = useEmails();
  const { addContract } = useContracts(user?.id);
  const actionsCount = useEmailActionsCount();
  const [activeTab, setActiveTab] = useState<EmailView | 'actions'>('smart');

  // Keep email-filter view in sync with tab when not on actions
  const handleTabChange = (v: string) => {
    setActiveTab(v as any);
    if (v !== 'actions') setView(v as EmailView);
  };
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{ to?: string; subject?: string; body?: string; threadId?: string | null; gmailMessageId?: string | null }>({});
  const [detectorOpen, setDetectorOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractPrefill, setContractPrefill] = useState<Partial<ContractInput> | null>(null);
  const [contractExtracting, setContractExtracting] = useState(false);

  const handleAddAsContract = (payment: DetectedPayment) => {
    setContractPrefill({
      name: payment.name,
      provider: payment.provider,
      costAmount: payment.amount > 0 ? payment.amount : undefined,
      costFrequency: payment.frequency,
      category: payment.category,
      autoRenews: true,
    });
    setContractDialogOpen(true);
  };

  const extractAmountFromText = (text: string): number | undefined => {
    const match = text.match(/(\d+[.,]\d{2})\s*(?:EUR|USD|\$|€)/i)
                || text.match(/[$€]\s*(\d+[.,]\d{2})/);
    if (match) return parseFloat(match[1].replace(',', '.'));
    return undefined;
  };

  const extractContractNumber = (text: string): string | undefined => {
    const patterns = [
      /(?:contract|vertrag|invoice|rechnung|order|bestellung|ref|reference|nr|number)[#:\s-]*([A-Z0-9-]{4,20})/i,
      /(?:INV|ORD|REF|CTR|VTR|RG|RE|AB)[- ]?(\d{4,15})/i,
      /#(\d{5,15})/,
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1];
    }
    return undefined;
  };

  const detectCategory = (text: string): string => {
    const lower = text.toLowerCase();
    if (/insurance|versicherung/.test(lower)) return 'insurance';
    if (/internet|broadband|fiber|glasfaser/.test(lower)) return 'internet';
    if (/phone|mobile|telefon|handy/.test(lower)) return 'phone';
    if (/netflix|spotify|disney|streaming|hulu|apple\s?tv/.test(lower)) return 'streaming';
    if (/electricity|gas|water|energy|strom|stadtwerke/.test(lower)) return 'utilities';
    if (/gym|fitness|sport/.test(lower)) return 'other';
    return 'subscription';
  };

  const handleSaveEmailAsContract = async (email: Email, bodyHtml?: string) => {
    const { name: senderName, email: senderEmail } = reconstructSender(email.from_name, email.from_email);
    const searchText = `${email.subject || ''} ${email.snippet || ''} ${email.body_preview || ''}`;
    const emailDate = email.received_at ? format(new Date(email.received_at), 'yyyy-MM-dd') : '';

    const notesParts = [
      '--- Created from Email ---',
      `From: ${senderName} <${senderEmail}>`,
      `Date: ${email.received_at ? format(new Date(email.received_at), 'PPP p') : 'Unknown'}`,
      `Subject: ${email.subject || '(No subject)'}`,
      '',
      '--- Email Content ---',
      email.snippet || email.body_preview || '(No content)',
    ];
    const richNotes = notesParts.join('\n');

    setContractExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-contract-from-email', {
        body: {
          from_name: senderName,
          from_email: senderEmail,
          subject: email.subject,
          snippet: email.snippet,
          body_preview: email.body_preview,
          body_html: bodyHtml || null,
          received_at: email.received_at,
        },
      });

      if (!error && data?.extracted) {
        const ai = data.extracted;
        setContractPrefill({
          name: ai.provider || senderName,
          provider: ai.provider || senderName,
          costAmount: ai.costAmount ?? undefined,
          costFrequency: ai.costFrequency || 'monthly',
          category: ai.category || 'subscription',
          autoRenews: ai.autoRenews ?? true,
          startDate: ai.startDate ? new Date(ai.startDate) : (emailDate ? new Date(emailDate) : undefined),
          renewalDate: ai.renewalDate ? new Date(ai.renewalDate) : undefined,
          endDate: ai.endDate ? new Date(ai.endDate) : undefined,
          contractNumber: ai.contractNumber || undefined,
          cancellationNoticeDays: ai.cancellationNoticeDays ?? 30,
          notes: richNotes,
        });
        setContractDialogOpen(true);
        setDetailOpen(false);
        setContractExtracting(false);
        return;
      }
    } catch (e) {
      console.error('AI contract extraction failed, using fallback:', e);
    }
    setContractExtracting(false);

    const amount = extractAmountFromText(searchText);
    const contractNumber = extractContractNumber(searchText);
    const category = detectCategory(`${senderName} ${searchText}`);

    setContractPrefill({
      name: senderName,
      provider: senderName,
      costAmount: amount,
      costFrequency: 'monthly',
      category: category as any,
      autoRenews: true,
      startDate: emailDate ? new Date(emailDate) : undefined,
      renewalDate: emailDate ? new Date(emailDate) : undefined,
      contractNumber,
      notes: richNotes,
    });
    setContractDialogOpen(true);
    setDetailOpen(false);
  };

  const handleSaveContract = async (data: ContractInput) => {
    const result = await addContract(data);
    if (result) {
      toast({ title: 'Contract created', description: `${data.name} has been added to your contracts.` });
    }
    setContractPrefill(null);
  };

  // Listen for compose-email events from AI (voice/text mode)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setComposeDraft({
          to: detail.to || '',
          subject: detail.subject || '',
          body: detail.body || '',
          threadId: detail.threadId || null,
          gmailMessageId: detail.gmailMessageId || null,
        });
        setComposeOpen(true);
      }
    };
    window.addEventListener('compose-email', handler);
    return () => window.removeEventListener('compose-email', handler);
  }, []);

  // Pull-to-refresh
  const pullY = useMotionValue(0);
  const pullOpacity = useTransform(pullY, [0, 60], [0, 1]);
  const pullRotate = useTransform(pullY, [0, 60], [0, 360]);
  const isPulling = useRef(false);

  const handlePullEnd = useCallback(() => {
    if (pullY.get() > 50 && !syncing) {
      syncEmails();
    }
    pullY.set(0);
    isPulling.current = false;
  }, [pullY, syncing, syncEmails]);

  const findThread = (email: Email): EmailThread | null => {
    const allThreads = [...(grouped.attention || []), ...(grouped.fyi || []), ...(grouped.lowPriority || []), ...(grouped.flagged || []), ...(grouped.snoozed || [])];
    return allThreads.find(t => t.latestEmail.id === email.id || t.allEmails.some(e => e.id === email.id)) || null;
  };

  const handleSelect = (email: Email) => {
    if (selectMode) {
      toggleSelect(email.id);
      return;
    }
    const thread = findThread(email);
    setSelectedThread(thread);
    setSelectedEmail(email);
    setDetailOpen(true);
    if (!email.is_read) markAsRead(email.id);
  };

  // Connect Gmail screen
  if (!connectionLoading && !isConnected) {
    return (
      <PanelShell
        icon={Mail}
        title="Email"
        empty
        emptyIcon={Mail}
        emptyTitle="Connect Your Gmail"
        emptyDescription="Connect your Google account to sync emails with AI-powered prioritization, spam detection, and smart categorization."
        emptyAction={
          <div className="flex flex-col items-center gap-2">
            <Button onClick={connectGmail} className="gap-2">
              <PlugZap className="w-4 h-4" />
              Connect Google Account
            </Button>
            <p className="text-xs text-muted-foreground">Read-only access · Your emails stay in Gmail</p>
          </div>
        }
      >
        <div />
      </PanelShell>
    );
  }

  const hasEmails = grouped.attention.length > 0 || grouped.fyi.length > 0 || grouped.lowPriority.length > 0;

  // Build header actions
  const headerActions = selectMode ? (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1 text-xs">
        <X className="w-3.5 h-3.5" />
        {selectedIds.size}
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={batchArchive} disabled={selectedIds.size === 0}>
        <Archive className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={batchMarkRead} disabled={selectedIds.size === 0}>
        <Eye className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={batchReportSpam} disabled={selectedIds.size === 0}>
        <Flag className="w-3.5 h-3.5" />
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetectorOpen(true)} title="Find Recurring Payments">
        <Receipt className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectMode(true)}>
        <CheckSquare className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={syncEmails} disabled={syncing}>
        {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );

  const headerExtra = !selectMode ? (
    <div className="space-y-2">
      <StatsBanner unread={unreadCount} priority={priorityCount} handled={handledToday} />

      <div className="flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-background px-3 text-xs ring-offset-background transition-all duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:border-primary focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Input
          placeholder="Search emails..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-full min-w-0 border-0 bg-transparent px-0 py-0 text-xs shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="shrink-0">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid h-auto w-full min-w-0 grid-cols-4 gap-1 overflow-hidden">
          <TabsTrigger value="smart" className="min-w-0 gap-1 px-2 text-xs overflow-hidden"><Sparkles className="w-3 h-3 shrink-0" /><span className="truncate">Smart</span></TabsTrigger>
          <TabsTrigger value="all" className="min-w-0 gap-1 px-2 text-xs overflow-hidden"><Inbox className="w-3 h-3 shrink-0" /><span className="truncate">All</span></TabsTrigger>
          <TabsTrigger value="flagged" className="min-w-0 gap-1 px-2 text-xs overflow-hidden">
            <ShieldAlert className="w-3 h-3" />Flagged
            {flaggedCount > 0 && <span className="text-[10px] bg-destructive/20 text-destructive rounded-full px-1 ml-0.5">{flaggedCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="actions" className="min-w-0 gap-1 px-2 text-xs overflow-hidden">
            <Zap className="w-3 h-3" />Actions
            {actionsCount > 0 && <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1 ml-0.5">{actionsCount}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ) : undefined;

  return (
    <PanelShell
      icon={Mail}
      title="Email"
      subtitle={lastSyncTime ? `Synced ${lastSyncTime}` : undefined}
      actions={headerActions}
      headerExtra={headerExtra}
      loading={loading && !hasEmails}
      loadingVariant="list"
      noPadding
      className="relative"
    >
      {/* Pull-to-refresh indicator */}
      <motion.div
        className="flex items-center justify-center py-2 overflow-hidden"
        style={{ opacity: pullOpacity, height: useTransform(pullY, [0, 60], [0, 40]) }}
      >
        <motion.div style={{ rotate: pullRotate }}>
          <RefreshCw className="w-4 h-4 text-primary" />
        </motion.div>
      </motion.div>

      {/* Content */}
      <ScrollArea className="flex-1 w-full min-w-0 max-w-full overflow-x-hidden">
        <motion.div
          className="w-full min-w-0 max-w-full space-y-1.5 overflow-x-hidden p-2"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.3, bottom: 0 }}
          style={{ y: pullY }}
          onDragEnd={handlePullEnd}
        >
          {activeTab === 'actions' ? (
            <div className="p-1">
              <EmailActionPipelineCard variant="list" hideWhenEmpty />
            </div>
          ) : view === 'smart' ? (
            <>
              <EmailSection title="Needs Your Attention" count={grouped.attention.length} threads={grouped.attention} onSelect={handleSelect} onArchive={archiveEmail} onToggleImportant={markImportant} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              <EmailSection title="FYI" count={grouped.fyi.length} threads={grouped.fyi} onSelect={handleSelect} onArchive={archiveEmail} onToggleImportant={markImportant} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              <EmailSection title="Newsletters & Promotions" count={grouped.lowPriority.length} threads={grouped.lowPriority} defaultOpen={false} onSelect={handleSelect} onArchive={archiveEmail} onToggleImportant={markImportant} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              {grouped.flagged.length > 0 && (
                <EmailSection title="⚠️ Flagged" count={grouped.flagged.length} threads={grouped.flagged} onSelect={handleSelect} onArchive={archiveEmail} onToggleImportant={markImportant} icon={ShieldAlert} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              )}
              {grouped.snoozed.length > 0 && (
                <EmailSection title="Snoozed" count={grouped.snoozed.length} threads={grouped.snoozed} defaultOpen={false} onSelect={handleSelect} icon={Clock} selectMode={selectMode} selectedIds={selectedIds} onToggleSelect={toggleSelect} />
              )}
              {!hasEmails && grouped.flagged.length === 0 && (
                searchQuery ? (
                  <EmptyState icon={Search} title="No results" description="No emails match your search." />
                ) : !loading && unreadCount === 0 ? (
                  <InboxZeroState />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <EmptyState
                      icon={Inbox}
                      title="No emails yet"
                      description="Pull down or tap Sync to fetch."
                      action={<Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Now'}</Button>}
                    />
                  </div>
                )
              )}
            </>
          ) : emails && emails.length > 0 ? (
            emails.map(thread => (
              <EmailCard
                key={thread.latestEmail.id}
                thread={thread}
                onSelect={handleSelect}
                onArchive={archiveEmail}
                onToggleImportant={markImportant}
                selectMode={selectMode}
                isSelected={selectedIds.has(thread.latestEmail.id)}
                onToggleSelect={toggleSelect}
              />
            ))
          ) : (
            <EmptyState
              icon={Inbox}
              title={searchQuery ? 'No results' : view === 'flagged' ? 'All clear!' : 'No emails found'}
              description={searchQuery ? 'No emails match your search.' : view === 'flagged' ? 'No flagged emails — all clear!' : 'No emails found.'}
            />
          )}
        </motion.div>
      </ScrollArea>

      {/* Compose FAB */}
      {!selectMode && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
          onClick={() => setComposeOpen(true)}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-glow flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      )}

      <EmailDetailSheet
        thread={selectedThread}
        email={selectedEmail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onArchive={archiveEmail}
        onToggleImportant={markImportant}
        onReportSpam={reportSpam}
        onSnooze={snoozeEmail}
        onCreateSenderRule={createSenderRule}
        onFetchBody={fetchEmailBody}
        onSendReply={sendReply}
        onCategorize={categorizeEmail}
        onSaveAsContract={handleSaveEmailAsContract}
        contractExtracting={contractExtracting}
      />

      <ComposeEmailSheet
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) setComposeDraft({});
        }}
        onSend={composeEmail}
        initialTo={composeDraft.to}
        initialSubject={composeDraft.subject}
        initialBody={composeDraft.body}
        threadId={composeDraft.threadId}
        gmailMessageId={composeDraft.gmailMessageId}
      />

      <RecurringPaymentDetector
        open={detectorOpen}
        onOpenChange={setDetectorOpen}
        onAddAsContract={handleAddAsContract}
      />

      <AddEditContractDialog
        open={contractDialogOpen}
        onOpenChange={(open) => {
          setContractDialogOpen(open);
          if (!open) setContractPrefill(null);
        }}
        onSave={handleSaveContract}
        prefill={contractPrefill}
      />
    </PanelShell>
  );
}
