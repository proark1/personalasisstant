import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: 'local' | 'google' | 'outlook' | 'apple' | 'ics';
  auth_type?: 'local' | 'oauth' | 'caldav' | 'ics';
  name: string;
  color: string | null;
  calendar_id: string | null;
  external_calendar_id: string | null;
  sync_enabled: boolean;
  sync_direction?: 'one_way_pull' | 'one_way_push' | 'two_way';
  last_synced_at: string | null;
  last_sync_error?: string | null;
  is_default?: boolean;
  created_at: string;
}

export function useCalendarConnections() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    if (!user) {
      setConnections([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('external_calendar_connections')
        .select('id, user_id, provider, auth_type, name, color, calendar_id, external_calendar_id, sync_enabled, sync_direction, last_synced_at, last_sync_error, is_default, created_at')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnections((data || []) as CalendarConnection[]);
    } catch (error) {
      console.error('Error fetching calendar connections:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const connectGoogle = async () => {
    if (!user) {
      toast({
        title: 'Not authenticated',
        description: 'Please sign in to connect your calendar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Session expired',
          description: 'Please sign in again.',
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('calendar-oauth-start', {
        body: { provider: 'google' },
      });

      if (error) throw error;

      if (data?.url) {
        // Open OAuth in a new window/tab
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL returned');
      }
    } catch (error) {
      console.error('Error starting OAuth:', error);
      toast({
        title: 'Connection failed',
        description: await describeEdgeError(error, 'Failed to start Google Calendar connection.'),
        variant: 'destructive',
      });
    }
  };

  const connectOutlook = async () => {
    if (!user) {
      toast({ title: 'Not authenticated', description: 'Please sign in.', variant: 'destructive' });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('outlook-oauth-start', { body: {} });
      if (error) throw error;
      if (data?.code === 'NOT_CONFIGURED') {
        toast({
          title: 'Outlook not yet available',
          description: 'Microsoft sign-in is being configured. Try again shortly or use ICS import for now.',
          variant: 'destructive',
        });
        return;
      }
      if (data?.url) window.location.href = data.url;
      else throw new Error('No OAuth URL returned');
    } catch (error) {
      console.error('Outlook connect error:', error);
      toast({
        title: 'Connection failed',
        description: await describeEdgeError(error, 'Failed to start Outlook connection.'),
        variant: 'destructive',
      });
    }
  };

  const connectApple = async (appleId: string, appPassword: string, calendarName?: string) => {
    if (!user) {
      toast({ title: 'Not authenticated', description: 'Please sign in.', variant: 'destructive' });
      return { success: false };
    }
    try {
      const { data, error } = await supabase.functions.invoke('apple-caldav-connect', {
        body: { appleId, appPassword, calendarName },
      });
      if (error) throw error;
      toast({ title: 'iCloud connected', description: 'Your Apple Calendar is now linked.' });
      await fetchConnections();
      return { success: true, data };
    } catch (error) {
      console.error('Apple CalDAV connect error:', error);
      toast({
        title: 'Apple connection failed',
        description: await describeEdgeError(error, 'Check your Apple ID and app-specific password.'),
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const syncCalendar = async (connectionId: string) => {
    if (syncing) return;

    const conn = connections.find(c => c.id === connectionId);
    const fnName = conn?.provider === 'outlook'
      ? 'outlook-sync'
      : conn?.provider === 'apple'
        ? 'apple-caldav-sync'
        : 'calendar-sync';

    setSyncing(connectionId);
    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { connectionId },
      });

      if (error) throw error;

      const pushed = data?.pushed || 0;
      toast({
        title: 'Calendar synced',
        description: `Imported ${data?.imported || 0}, updated ${data?.updated || 0}${pushed ? `, pushed ${pushed}` : ''}.`,
      });

      await fetchConnections();
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: 'Sync failed',
        description: await describeEdgeError(error, 'Failed to sync calendar events.'),
        variant: 'destructive',
      });
    } finally {
      setSyncing(null);
    }
  };

  const disconnectCalendar = async (connectionId: string) => {
    try {
      // First, delete all events from this connection
      const connection = connections.find(c => c.id === connectionId);
      // The built-in standard calendar can't be disconnected — it's the home
      // for local/manual/Dori/Telegram events.
      if (connection?.is_default || connection?.provider === 'local') {
        toast({
          title: 'Built-in calendar',
          description: 'Your standard DarAI calendar cannot be removed.',
        });
        return;
      }
      if (connection) {
        await supabase
          .from('events')
          .delete()
          .eq('user_id', user?.id)
          .eq('external_source', connection.provider)
          .eq('external_id', connection.external_calendar_id);
      }

      // Then delete the connection
      const { error } = await supabase
        .from('external_calendar_connections')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Calendar disconnected',
        description: 'Your calendar has been disconnected and synced events removed.',
      });

      setConnections(prev => prev.filter(c => c.id !== connectionId));
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: 'Disconnect failed',
        description: (error instanceof Error ? error.message : null) || 'Failed to disconnect calendar.',
        variant: 'destructive',
      });
    }
  };

  const toggleSync = async (connectionId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('external_calendar_connections')
        .update({ sync_enabled: enabled })
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setConnections(prev =>
        prev.map(c => c.id === connectionId ? { ...c, sync_enabled: enabled } : c)
      );

      toast({
        title: enabled ? 'Sync enabled' : 'Sync disabled',
        description: `Calendar sync has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error toggling sync:', error);
      toast({
        title: 'Update failed',
        description: (error instanceof Error ? error.message : null) || 'Failed to update sync setting.',
        variant: 'destructive',
      });
    }
  };

  return {
    connections,
    loading,
    syncing,
    connectGoogle,
    connectOutlook,
    connectApple,
    syncCalendar,
    disconnectCalendar,
    toggleSync,
    refetch: fetchConnections,
  };
}
