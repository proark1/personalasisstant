import { Calendar, RefreshCw, Trash2, ExternalLink, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCalendarConnections, CalendarConnection } from '@/hooks/useCalendarConnections';
import { formatDistanceToNow } from 'date-fns';

// Google Calendar icon SVG
const GoogleCalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="3" y="3" width="9" height="9" fill="#EA4335" />
    <rect x="12" y="3" width="9" height="9" fill="#FBBC04" />
    <rect x="3" y="12" width="9" height="9" fill="#34A853" />
    <rect x="12" y="12" width="9" height="9" fill="#4285F4" />
    <rect x="7" y="7" width="10" height="10" rx="1" fill="white" />
    <line x1="9" y1="11" x2="15" y2="11" stroke="#757575" strokeWidth="1" />
    <line x1="9" y1="14" x2="13" y2="14" stroke="#757575" strokeWidth="1" />
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
  const getProviderIcon = () => {
    switch (connection.provider) {
      case 'google':
        return <GoogleCalendarIcon />;
      default:
        return <Calendar className="h-5 w-5" />;
    }
  };

  const getProviderName = () => {
    switch (connection.provider) {
      case 'google':
        return 'Google Calendar';
      case 'outlook':
        return 'Outlook Calendar';
      default:
        return 'Calendar';
    }
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {getProviderIcon()}
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">{connection.name}</p>
              <p className="text-xs text-muted-foreground">{getProviderName()}</p>
              {connection.last_synced_at && (
                <p className="text-xs text-muted-foreground">
                  Last synced {formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Auto-sync</span>
              <Switch
                checked={connection.sync_enabled}
                onCheckedChange={onToggleSync}
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing}
            className="flex-1"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDisconnect}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function CalendarConnectionsPanel() {
  const {
    connections,
    loading,
    syncing,
    connectGoogle,
    syncCalendar,
    disconnectCalendar,
    toggleSync,
  } = useCalendarConnections();

  const hasGoogleConnection = connections.some(c => c.provider === 'google');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Calendar Connections
        </CardTitle>
        <CardDescription>
          Connect external calendars to sync events automatically
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
            
            {!hasGoogleConnection && (
              <Button
                variant="outline"
                onClick={connectGoogle}
                className="w-full justify-start gap-3"
              >
                <GoogleCalendarIcon />
                <span>Connect Google Calendar</span>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </Button>
            )}

            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No calendars connected yet. Connect your Google Calendar to sync events.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
