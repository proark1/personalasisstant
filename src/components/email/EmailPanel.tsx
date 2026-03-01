import { useState } from 'react';
import { useEmails, EmailCategory, Email } from '@/hooks/useEmails';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { EmailCard } from './EmailCard';
import { EmailDetailSheet } from './EmailDetailSheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Mail, Inbox, AlertCircle, Star, Newspaper, Loader2, PlugZap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

const filterTabs: { id: EmailCategory; label: string; icon: typeof Mail }[] = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'priority', label: 'Priority', icon: Star },
  { id: 'action_required', label: 'Action', icon: AlertCircle },
  { id: 'fyi', label: 'FYI', icon: Mail },
  { id: 'newsletter', label: 'News', icon: Newspaper },
];

export function EmailPanel() {
  const { isConnected, loading: connectionLoading, connectGmail } = useGmailConnection();
  const { emails, loading, syncing, filter, setFilter, syncEmails, archiveEmail, markImportant, unreadCount, priorityCount } = useEmails();
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleSelect = (email: Email) => {
    setSelectedEmail(email);
    setDetailOpen(true);
  };

  // Not connected state
  if (!connectionLoading && !isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Connect Your Gmail</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Connect your Google account to sync emails, get smart prioritization based on your contacts, and AI-powered categorization.
          </p>
        </div>
        <Button onClick={connectGmail} className="gap-2">
          <PlugZap className="w-4 h-4" />
          Connect Google Account
        </Button>
        <p className="text-xs text-muted-foreground">
          Read-only access · Your emails stay in Gmail
        </p>
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
            {priorityCount > 0 && (
              <span className="text-xs font-semibold bg-amber-500/10 text-amber-600 rounded-full px-2 py-0.5">
                {priorityCount} priority
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={syncEmails}
            disabled={syncing}
            className="gap-1.5"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync
          </Button>
        </div>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as EmailCategory)}>
          <TabsList className="w-full h-8">
            {filterTabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs gap-1 px-2">
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Email list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
              <Inbox className="w-10 h-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {filter === 'all' ? 'No emails yet. Tap Sync to fetch.' : `No ${filter.replace('_', ' ')} emails.`}
              </p>
              {filter === 'all' && (
                <Button variant="outline" size="sm" onClick={syncEmails} disabled={syncing}>
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>
              )}
            </div>
          ) : (
            emails.map(email => (
              <EmailCard
                key={email.id}
                email={email}
                onSelect={handleSelect}
                onArchive={archiveEmail}
                onToggleImportant={markImportant}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Detail sheet */}
      <EmailDetailSheet
        email={selectedEmail}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onArchive={archiveEmail}
        onToggleImportant={markImportant}
      />
    </div>
  );
}
