import { useState } from 'react';
import { useEmails, EmailView, Email } from '@/hooks/useEmails';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { EmailCard } from './EmailCard';
import { EmailDetailSheet } from './EmailDetailSheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Mail, Inbox, ShieldAlert, Loader2, PlugZap, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

function EmailSection({ title, count, emails, defaultOpen = true, onSelect, icon: Icon }: {
  title: string;
  count: number;
  emails: Email[];
  defaultOpen?: boolean;
  onSelect: (email: Email) => void;
  icon?: typeof Mail;
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
        <span className="ml-auto text-[10px] font-medium bg-muted rounded-full px-1.5 py-0.5 normal-case">
          {count}
        </span>
      </button>
      {open && (
        <div className="space-y-0.5">
          {emails.map(email => (
            <EmailCard key={email.id} email={email} onSelect={onSelect} />
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
    syncEmails, archiveEmail, markImportant, markAsRead, reportSpam,
    unreadCount, priorityCount, flaggedCount,
  } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSelect = (email: Email) => {
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">Email</h2>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
            {flaggedCount > 0 && (
              <span className="text-xs font-semibold bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                {flaggedCount} ⚠️
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={syncEmails} disabled={syncing} className="gap-1.5">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync
          </Button>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as EmailView)}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="smart" className="text-xs gap-1 px-3">
              <Sparkles className="w-3 h-3" />
              Smart
            </TabsTrigger>
            <TabsTrigger value="all" className="text-xs gap-1 px-3">
              <Inbox className="w-3 h-3" />
              All
            </TabsTrigger>
            <TabsTrigger value="flagged" className="text-xs gap-1 px-3">
              <ShieldAlert className="w-3 h-3" />
              Flagged
              {flaggedCount > 0 && (
                <span className="text-[10px] bg-destructive/20 text-destructive rounded-full px-1 ml-0.5">
                  {flaggedCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : view === 'smart' ? (
            <>
              <EmailSection
                title="Needs Your Attention"
                count={grouped.attention.length}
                emails={grouped.attention}
                onSelect={handleSelect}
              />
              <EmailSection
                title="FYI"
                count={grouped.fyi.length}
                emails={grouped.fyi}
                onSelect={handleSelect}
              />
              <EmailSection
                title="Newsletters & Promotions"
                count={grouped.lowPriority.length}
                emails={grouped.lowPriority}
                defaultOpen={false}
                onSelect={handleSelect}
              />
              {grouped.flagged.length > 0 && (
                <EmailSection
                  title="⚠️ Flagged"
                  count={grouped.flagged.length}
                  emails={grouped.flagged}
                  onSelect={handleSelect}
                  icon={ShieldAlert}
                />
              )}
              {grouped.attention.length === 0 && grouped.fyi.length === 0 && grouped.lowPriority.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                  <Inbox className="w-10 h-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No emails yet. Tap Sync to fetch.</p>
                  <Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing}>
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                </div>
              )}
            </>
          ) : emails && emails.length > 0 ? (
            emails.map(email => (
              <EmailCard key={email.id} email={email} onSelect={handleSelect} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Inbox className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {view === 'flagged' ? 'No flagged emails — all clear!' : 'No emails found.'}
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
      />
    </div>
  );
}
