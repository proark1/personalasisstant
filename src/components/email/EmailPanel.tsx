import { useState, useRef, useCallback, useEffect } from 'react';
import { useEmails, EmailView, Email, EmailThread } from '@/hooks/useEmails';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { EmailCard } from './EmailCard';
import { EmailDetailSheet } from './EmailDetailSheet';
import { ComposeEmailSheet } from './ComposeEmailSheet';
import { RecurringPaymentDetector, DetectedPayment } from './RecurringPaymentDetector';
import { AddEditContractDialog } from '@/components/contracts/AddEditContractDialog';
import { useContracts, ContractInput } from '@/hooks/useContracts';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { RefreshCw, Mail, Inbox, ShieldAlert, Loader2, PlugZap, ChevronDown, ChevronRight, Sparkles, Clock, Search, X, CheckSquare, Archive, Eye, Flag, Plus, PartyPopper, Zap, CheckCheck, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useToast } from '@/hooks/use-toast';

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
    <div className="space-y-1">
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
        <div className="space-y-0.5">
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
    </div>
  );
}

function StatsBanner({ unread, priority, handled }: { unread: number; priority: number; handled: number }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg text-xs">
      <div className="flex items-center gap-1.5">
        <Mail className="w-3 h-3 text-primary" />
        <span className="text-muted-foreground">Unread</span>
        <AnimatedCounter value={unread} className="font-semibold text-foreground" />
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-destructive" />
        <span className="text-muted-foreground">Priority</span>
        <AnimatedCounter value={priority} className="font-semibold text-foreground" />
      </div>
      <div className="w-px h-3 bg-border" />
      <div className="flex items-center gap-1.5">
        <CheckCheck className="w-3 h-3 text-emerald-500" />
        <span className="text-muted-foreground">Handled</span>
        <AnimatedCounter value={handled} className="font-semibold text-foreground" />
      </div>
    </div>
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
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<{ to?: string; subject?: string; body?: string; threadId?: string | null; gmailMessageId?: string | null }>({});
  const [detectorOpen, setDetectorOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractPrefill, setContractPrefill] = useState<Partial<ContractInput> | null>(null);

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

  const handleSaveEmailAsContract = (email: Email) => {
    const providerName = email.from_name || email.from_email.split('@')[0];
    const searchText = `${email.subject || ''} ${email.snippet || ''} ${email.body_preview || ''}`;
    const amount = extractAmountFromText(searchText);

    setContractPrefill({
      name: providerName,
      provider: providerName,
      costAmount: amount,
      costFrequency: 'monthly',
      category: 'subscription',
      autoRenews: true,
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

  if (!connectionLoading && !isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Connect Your Gmail</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Connect your Google account to sync emails with AI-powered prioritization, spam detection, and smart categorization.
          </p>
        </div>
        <Button onClick={connectGmail} className="gap-2">
          <PlugZap className="w-4 h-4" />
          Connect Google Account
        </Button>
        <p className="text-xs text-muted-foreground">Read-only access · Your emails stay in Gmail</p>
      </div>
    );
  }

  const hasEmails = grouped.attention.length > 0 || grouped.fyi.length > 0 || grouped.lowPriority.length > 0;

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        {selectMode ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={clearSelection} className="gap-1">
                <X className="w-4 h-4" />
                {selectedIds.size} selected
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={batchArchive} disabled={selectedIds.size === 0}>
                <Archive className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={batchMarkRead} disabled={selectedIds.size === 0}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={batchReportSpam} disabled={selectedIds.size === 0} className="text-destructive hover:text-destructive">
                <Flag className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">Email</h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">{unreadCount}</span>
                )}
                {flaggedCount > 0 && (
                  <span className="text-xs font-semibold bg-destructive/10 text-destructive rounded-full px-2 py-0.5">{flaggedCount} ⚠️</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setDetectorOpen(true)} title="Find Recurring Payments">
                  <Receipt className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
                  <CheckSquare className="w-4 h-4" />
                </Button>
                {lastSyncTime && <span className="text-[10px] text-muted-foreground">{lastSyncTime}</span>}
                <Button variant="ghost" size="sm" onClick={syncEmails} disabled={syncing} className="gap-1.5">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <StatsBanner unread={unreadCount} priority={priorityCount} handled={handledToday} />

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            <Tabs value={view} onValueChange={(v) => setView(v as EmailView)}>
              <TabsList className="w-full h-8">
                <TabsTrigger value="smart" className="text-xs gap-1 px-3"><Sparkles className="w-3 h-3" />Smart</TabsTrigger>
                <TabsTrigger value="all" className="text-xs gap-1 px-3"><Inbox className="w-3 h-3" />All</TabsTrigger>
                <TabsTrigger value="flagged" className="text-xs gap-1 px-3">
                  <ShieldAlert className="w-3 h-3" />Flagged
                  {flaggedCount > 0 && <span className="text-[10px] bg-destructive/20 text-destructive rounded-full px-1 ml-0.5">{flaggedCount}</span>}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}
      </div>

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
      <ScrollArea className="flex-1">
        <motion.div
          className="p-2 space-y-2"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0.3, bottom: 0 }}
          style={{ y: pullY }}
          onDragEnd={handlePullEnd}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
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
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <Inbox className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No emails match your search.</p>
                  </div>
                ) : !loading && unreadCount === 0 ? (
                  <InboxZeroState />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                    <Inbox className="w-10 h-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No emails yet. Pull down or tap Sync to fetch.</p>
                    <Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Now'}</Button>
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
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Inbox className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No emails match your search.' : view === 'flagged' ? 'No flagged emails — all clear!' : 'No emails found.'}
              </p>
            </div>
          )}
        </motion.div>
      </ScrollArea>

      {/* Compose FAB */}
      {!selectMode && (
        <button
          onClick={() => setComposeOpen(true)}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
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
    </div>
  );
}
