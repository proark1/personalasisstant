import { useState, useRef } from 'react';
import { Calendar, RefreshCw, Trash2, ExternalLink, Loader2, Upload, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCalendarConnections, CalendarConnection } from '@/hooks/useCalendarConnections';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { formatDistanceToNow } from 'date-fns';
import { parseICS, validateICSFile } from '@/lib/icsParser';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="3" y="3" width="9" height="9" fill="#EA4335" />
    <rect x="12" y="3" width="9" height="9" fill="#FBBC04" />
    <rect x="3" y="12" width="9" height="9" fill="#34A853" />
    <rect x="12" y="12" width="9" height="9" fill="#4285F4" />
    <rect x="7" y="7" width="10" height="10" rx="1" fill="white" />
  </svg>
);

const OutlookIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#0078D4">
    <path d="M21.5 4h-7v16h7c.28 0 .5-.22.5-.5v-15c0-.28-.22-.5-.5-.5zM12 5L2 6.5v11L12 19V5zm-4.6 9.7c-1.6 0-2.6-1.4-2.6-3.2s1-3.2 2.6-3.2 2.6 1.4 2.6 3.2-1 3.2-2.6 3.2z" />
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

function ConnectionCard({
  connection,
  syncing,
  onSync,
  onDisconnect,
  onToggleSync,
}: {
  connection: CalendarConnection;
  syncing: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onToggleSync: (enabled: boolean) => void;
}) {
  const isLocal = connection.is_default || connection.provider === 'local';

  const getProviderIcon = () => {
    switch (connection.provider) {
      case 'google': return <GoogleIcon />;
      case 'outlook': return <OutlookIcon />;
      case 'apple': return <AppleIcon />;
      default: return <Calendar className="h-5 w-5 text-primary" />;
    }
  };

  const getProviderName = () => {
    switch (connection.provider) {
      case 'google': return 'Google Calendar';
      case 'outlook': return 'Outlook Calendar';
      case 'apple': return 'iCloud Calendar';
      case 'local': return 'Built-in calendar';
      default: return 'Calendar';
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getProviderIcon()}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{connection.name}</p>
                {isLocal && (
                  <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    Default
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {getProviderName()}
                {!isLocal && connection.sync_direction === 'two_way' && ' · two-way sync'}
              </p>
              {isLocal ? (
                <p className="text-xs text-muted-foreground">
                  Your manual, Dori &amp; Telegram events live here.
                </p>
              ) : (
                <>
                  {connection.last_synced_at && (
                    <p className="text-xs text-muted-foreground">
                      Last synced {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
                    </p>
                  )}
                  {connection.last_sync_error && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {connection.last_sync_error}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {!isLocal && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auto-sync</span>
              <Switch checked={connection.sync_enabled} onCheckedChange={onToggleSync} />
            </div>
          )}
        </div>

        {!isLocal && (
          <div className="flex items-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="flex-1">
              {syncing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
              ) : (
                <><RefreshCw className="h-4 w-4 mr-2" />Sync Now</>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onDisconnect} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppleConnectDialog({
  open,
  onOpenChange,
  onConnect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConnect: (appleId: string, appPassword: string, name?: string) => Promise<{ success: boolean }>;
}) {
  const [appleId, setAppleId] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await onConnect(appleId.trim(), appPassword.trim(), name.trim() || undefined);
    setSubmitting(false);
    if (result.success) {
      onOpenChange(false);
      setAppleId(''); setAppPassword(''); setName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AppleIcon /> Connect iCloud Calendar</DialogTitle>
          <DialogDescription>
            Apple doesn't offer OAuth, so iCloud requires an{' '}
            <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="underline">
              app-specific password
            </a>
            . Generate one at appleid.apple.com → Sign-In and Security → App-Specific Passwords.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="apple-id">Apple ID (email)</Label>
            <Input id="apple-id" type="email" placeholder="you@icloud.com" value={appleId} onChange={(e) => setAppleId(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="apple-pw">App-Specific Password</Label>
            <Input id="apple-pw" type="password" placeholder="xxxx-xxxx-xxxx-xxxx" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Stored securely. Format like: abcd-efgh-ijkl-mnop</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="apple-name">Calendar name (optional)</Label>
            <Input id="apple-name" placeholder="My iCloud Calendar" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!appleId || !appPassword || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : 'Connect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarConnectionsPanel() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [calendarName, setCalendarName] = useState('');
  const [appleDialogOpen, setAppleDialogOpen] = useState(false);

  const {
    connections,
    loading,
    syncing,
    connectGoogle,
    connectOutlook,
    connectApple,
    syncCalendar,
    disconnectCalendar,
    toggleSync,
    refetch,
  } = useCalendarConnections();

  const hasGoogle = connections.some(c => c.provider === 'google');
  const hasOutlook = connections.some(c => c.provider === 'outlook');
  const hasApple = connections.some(c => c.provider === 'apple');

  const handleICSImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateICSFile(file)) {
      toast({ title: 'Invalid file', description: 'Please select a valid .ics calendar file.', variant: 'destructive' });
      return;
    }
    setImporting(true);
    try {
      const content = await file.text();
      const events = parseICS(content);
      if (events.length === 0) {
        toast({ title: 'No events found', description: 'The file contains no events.', variant: 'destructive' });
        return;
      }
      const name = calendarName.trim() || file.name.replace('.ics', '');
      const { data, error } = await supabase.functions.invoke('import-calendar', {
        body: { icsContent: content, calendarName: name, color: '#4285F4' },
      });
      if (error) throw error;
      toast({ title: 'Calendar imported', description: `Imported ${data.imported || events.length} events from "${name}".` });
      setCalendarName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetch();
    } catch (error) {
      console.error('ICS import error:', error);
      toast({ title: 'Import failed', description: await describeEdgeError(error, 'Failed to import.'), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          My Calendars
        </CardTitle>
        <CardDescription>
          Connect Google, Outlook, or Apple iCloud — events flow into your unified DarAI calendar with two-way sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {connections.length > 0 && (
              <div className="space-y-3">
                {connections.map(connection => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    syncing={syncing === connection.id}
                    onSync={() => syncCalendar(connection.id)}
                    onDisconnect={() => disconnectCalendar(connection.id)}
                    onToggleSync={(enabled) => toggleSync(connection.id, enabled)}
                  />
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2">
              {!hasGoogle && (
                <Button variant="outline" onClick={connectGoogle} className="w-full justify-start gap-3">
                  <GoogleIcon />
                  <span>Connect Google Calendar</span>
                  <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                </Button>
              )}
              {!hasOutlook && (
                <Button variant="outline" onClick={connectOutlook} className="w-full justify-start gap-3">
                  <OutlookIcon />
                  <span>Connect Outlook Calendar</span>
                  <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                </Button>
              )}
              {!hasApple && (
                <Button variant="outline" onClick={() => setAppleDialogOpen(true)} className="w-full justify-start gap-3">
                  <AppleIcon />
                  <span>Connect iCloud Calendar</span>
                  <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                </Button>
              )}

              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Calendar name (optional)"
                    value={calendarName}
                    onChange={(e) => setCalendarName(e.target.value)}
                    className="flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleICSImport}
                    className="hidden"
                    id="ics-upload"
                  />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing} className="gap-2">
                    {importing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Importing...</>
                    ) : (
                      <><Upload className="h-4 w-4" />Import ICS</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Or import a one-off .ics file (no sync, snapshot only).
                </p>
              </div>
            </div>

            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No calendars connected yet.
              </p>
            )}
          </>
        )}
      </CardContent>

      <AppleConnectDialog
        open={appleDialogOpen}
        onOpenChange={setAppleDialogOpen}
        onConnect={connectApple}
      />
    </Card>
  );
}
