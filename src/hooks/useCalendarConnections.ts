import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: 'google' | 'outlook' | 'ics';
  name: string;
  color: string | null;
  calendar_id: string | null;
  external_calendar_id: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
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
        .select('id, user_id, provider, name, color, calendar_id, external_calendar_id, sync_enabled, last_synced_at, created_at')
        .eq('user_id', user.id)
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
    } catch (error: any) {
      console.error('Error starting OAuth:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Failed to start Google Calendar connection.',
        variant: 'destructive',
      });
    }
  };

  const syncCalendar = async (connectionId: string) => {
    if (syncing) return;
    
    setSyncing(connectionId);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { connectionId },
      });

      if (error) throw error;

      toast({
        title: 'Calendar synced',
        description: `Imported ${data.imported || 0} new events, updated ${data.updated || 0} events.`,
      });

      // Refresh connections to update last_synced_at
      await fetchConnections();
    } catch (error: any) {
      console.error('Error syncing calendar:', error);
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync calendar events.',
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
    } catch (error: any) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: 'Disconnect failed',
        description: error.message || 'Failed to disconnect calendar.',
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
    } catch (error: any) {
      console.error('Error toggling sync:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update sync setting.',
        variant: 'destructive',
      });
    }
  };

  return {
    connections,
    loading,
    syncing,
    connectGoogle,
    syncCalendar,
    disconnectCalendar,
    toggleSync,
    refetch: fetchConnections,
  };
}
