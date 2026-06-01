/**
 * RealtimeCoordinator — multiplexes Supabase realtime subscriptions.
 *
 * Solves: 23 hooks each subscribed independently. Multiple hooks subscribing
 * to the same table = duplicate WebSocket frames, wasted bandwidth, and
 * (worst of all) connection limits hit on Supabase realtime.
 *
 * Now: one channel per (table, userId), shared across all subscribers.
 * Each row-change is also broadcast to the moduleBus so cache invalidation
 * happens in one place.
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { moduleBus, type ModuleEventName } from './moduleEventBus';

type ChangeHandler = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

interface ChannelRegistration {
  channel: RealtimeChannel;
  handlers: Set<ChangeHandler>;
  refCount: number;
}

const channels = new Map<string, ChannelRegistration>();

/**
 * Maps Supabase table names to ModuleEventBus events.
 * When a row changes, the corresponding event is emitted automatically.
 */
const TABLE_TO_EVENT: Record<string, { INSERT?: ModuleEventName; UPDATE?: ModuleEventName; DELETE?: ModuleEventName }> = {
  tasks: { INSERT: 'task:created', UPDATE: 'task:updated', DELETE: 'task:deleted' },
  events: { INSERT: 'event:created', UPDATE: 'event:updated', DELETE: 'event:deleted' },
  contacts: { INSERT: 'contact:created', UPDATE: 'contact:updated', DELETE: 'contact:deleted' },
  contracts: { INSERT: 'contract:created', UPDATE: 'contract:updated', DELETE: 'contract:deleted' },
  emails: { INSERT: 'email:synced', UPDATE: 'email:synced' },
  notes: { INSERT: 'note:created', UPDATE: 'note:updated', DELETE: 'note:deleted' },
  habits: { INSERT: 'habit:created', UPDATE: 'habit:logged' },
  habit_logs: { INSERT: 'habit:logged' },
  health_metrics: { INSERT: 'health:metric-recorded', UPDATE: 'health:metric-recorded' },
  daily_checkins: { INSERT: 'health:checkin-logged' },
  family_members: { INSERT: 'family:member-changed', UPDATE: 'family:member-changed', DELETE: 'family:member-changed' },
  shopping_lists: { INSERT: 'shopping:list-updated', UPDATE: 'shopping:list-updated' },
  shared_items: { INSERT: 'item:shared', DELETE: 'item:unshared' },
  ai_memory: { INSERT: 'ai:memory-updated', UPDATE: 'ai:memory-updated', DELETE: 'ai:memory-updated' },
};

function emitForTable(table: string, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  const mapping = TABLE_TO_EVENT[table];
  if (!mapping) return;
  const eventName = mapping[payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE'];
  if (eventName) {
    moduleBus.emit(eventName, payload.new ?? payload.old, 'realtime');
  }
}

/**
 * Subscribe to row changes on a table for a user.
 * Returns an unsubscribe function.
 *
 * Multiple callers for the same (table, userId) share one channel.
 */
export function subscribeToTable(
  table: string,
  userId: string,
  handler: ChangeHandler,
  filter?: string,
): () => void {
  const key = `${table}::${userId}::${filter ?? 'user_id=eq.' + userId}`;
  let reg = channels.get(key);

  if (!reg) {
    const channel = supabase.channel(`coord-${key}`);
    const handlers = new Set<ChangeHandler>();

    channel.on(
      'postgres_changes' as never,
      {
        event: '*',
        schema: 'public',
        table,
        filter: filter ?? `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        emitForTable(table, payload);
        handlers.forEach((h) => {
          try {
            h(payload);
          } catch (err) {
            console.error(`[RealtimeCoordinator] handler for ${table} threw:`, err);
          }
        });
      },
    );

    // Track whether this channel has ever been in an error/closed state so we
    // can distinguish a reconnect from the first subscribe. On reconnect, row
    // changes that happened during the offline gap were missed — emit the
    // table's invalidation event so subscribers refetch and catch up.
    let hasErrored = false;
    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        hasErrored = true;
        moduleBus.emit('module:error', { module: 'realtime', table, status }, 'realtime');
      } else if (status === 'SUBSCRIBED' && hasErrored) {
        // Reconnected after a gap. Reuse the same invalidation event a real
        // row change would emit so subscribers refetch the affected table.
        hasErrored = false;
        const mapping = TABLE_TO_EVENT[table];
        const eventName = mapping?.UPDATE ?? mapping?.INSERT ?? mapping?.DELETE;
        if (eventName) {
          moduleBus.emit(eventName, null, 'realtime');
        }
      }
    });

    reg = { channel, handlers, refCount: 0 };
    channels.set(key, reg);
  }

  reg.handlers.add(handler);
  reg.refCount += 1;

  return () => {
    if (!reg) return;
    reg.handlers.delete(handler);
    reg.refCount -= 1;
    if (reg.refCount <= 0) {
      void supabase.removeChannel(reg.channel);
      channels.delete(key);
    }
  };
}

/** For testing or hot reload. */
export function clearAllChannels(): void {
  channels.forEach((reg) => {
    void supabase.removeChannel(reg.channel);
  });
  channels.clear();
}
