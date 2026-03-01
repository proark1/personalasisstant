import { useState } from 'react';
import { useEmails, EmailView, Email, EmailThread } from '@/hooks/useEmails';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { EmailCard } from './EmailCard';
import { EmailDetailSheet } from './EmailDetailSheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { RefreshCw, Mail, Inbox, ShieldAlert, Loader2, PlugZap, ChevronDown, ChevronRight, Sparkles, Clock, Search, X, CheckSquare, Archive, Eye, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

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

export function EmailPanel() {
  const { isConnected, loading: connectionLoading, connectGmail } = useGmailConnection();
  const {
    emails, grouped, loading, syncing, view, setView,
    syncEmails, archiveEmail, markImportant, markAsRead, reportSpam, snoozeEmail, createSenderRule,
    fetchEmailBody, sendReply,
    searchQuery, setSearchQuery,
    selectMode, setSelectMode, selectedIds, toggleSelect, clearSelection,
    batchArchive, batchMarkRead, batchReportSpam,
    unreadCount, priorityCount, flaggedCount, lastSyncTime,
  } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSelect = (email: Email) => {
    if (selectMode) {
      toggleSelect(email.id);
      return;
    }
    setSelectedEmail(email);
    setDetailOpen(true);
    if (!email.is_read) markAsRead(email.id);
  };

  const handleLongPress = (emailId: string) => {
    setSelectMode(true);
    toggleSelect(emailId);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        {selectMode ? (
          /* Batch actions bar */
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
                <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
                  <CheckSquare className="w-4 h-4" />
                </Button>
                {lastSyncTime && <span className="text-[10px] text-muted-foreground">{lastSyncTime}</span>}
                <Button variant="ghost" size="sm" onClick={syncEmails} disabled={syncing} className="gap-1.5">
                  {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Search */}
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

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
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
              {grouped.attention.length === 0 && grouped.fyi.length === 0 && grouped.lowPriority.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{searchQuery ? 'No emails match your search.' : 'No emails yet. Tap Sync to fetch.'}</p>
                  {!searchQuery && (
                    <Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing}>{syncing ? 'Syncing...' : 'Sync Now'}</Button>
                  )}
                </div>
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
        </div>
      </ScrollArea>

      <EmailDetailSheet
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
      />
    </div>
  );
}
