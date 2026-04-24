/**
 * ModuleEventBus — central pub/sub for cross-module communication.
 *
 * Solves: modules don't know when other modules' data changes. A task
 * completion should trigger weekly-review refresh; an email sync should
 * invalidate contact suggestions; a contract update should refresh
 * the AI's smart context.
 *
 * Usage:
 *   moduleBus.emit('task:created', { taskId, projectId });
 *   const unsub = moduleBus.on('task:created', (e) => { ... });
 *   unsub(); // cleanup
 */

export type ModuleEventName =
  // Tasks
  | 'task:created' | 'task:updated' | 'task:deleted' | 'task:completed' | 'task:trashed'
  // Events / calendar
  | 'event:created' | 'event:updated' | 'event:deleted' | 'event:synced'
  // Contacts
  | 'contact:created' | 'contact:updated' | 'contact:deleted' | 'contact:contacted'
  // Contracts
  | 'contract:created' | 'contract:updated' | 'contract:deleted' | 'contract:renewed'
  // Email
  | 'email:synced' | 'email:read' | 'email:replied' | 'email:archived'
  // Health
  | 'health:metric-recorded' | 'health:checkin-logged' | 'health:synced'
  // Habits
  | 'habit:logged' | 'habit:created' | 'habit:streak-broken'
  // Notes
  | 'note:created' | 'note:updated' | 'note:deleted'
  // Family / shopping
  | 'family:member-changed' | 'shopping:list-updated'
  // Workspace / sharing
  | 'workspace:switched' | 'item:shared' | 'item:unshared'
  // AI / system
  | 'ai:context-stale' | 'ai:memory-updated' | 'sync:started' | 'sync:completed'
  // Module lifecycle
  | 'module:error' | 'module:recovered';

export interface ModuleEvent<T = unknown> {
  name: ModuleEventName;
  payload: T;
  timestamp: number;
  source?: string;
}

type Listener<T = unknown> = (event: ModuleEvent<T>) => void;

class ModuleEventBus {
  private listeners = new Map<ModuleEventName, Set<Listener>>();
  private wildcardListeners = new Set<Listener>();
  // Track recent events so newly-mounted modules can catch up.
  private recentEvents: ModuleEvent[] = [];
  private readonly MAX_RECENT = 50;
  // Debounce duplicate emissions (e.g. realtime echo of own write).
  private lastEmitKey: string | null = null;
  private lastEmitAt = 0;
  private readonly DEDUPE_WINDOW_MS = 50;

  emit<T = unknown>(name: ModuleEventName, payload: T, source?: string): void {
    const now = Date.now();
    const key = `${name}:${JSON.stringify(payload)}`;
    if (key === this.lastEmitKey && now - this.lastEmitAt < this.DEDUPE_WINDOW_MS) {
      return;
    }
    this.lastEmitKey = key;
    this.lastEmitAt = now;

    const event: ModuleEvent<T> = { name, payload, timestamp: now, source };

    this.recentEvents.push(event as ModuleEvent);
    if (this.recentEvents.length > this.MAX_RECENT) {
      this.recentEvents.shift();
    }

    const listeners = this.listeners.get(name);
    if (listeners) {
      // Snapshot to avoid mutation-during-iteration if a handler unsubscribes.
      Array.from(listeners).forEach((fn) => {
        try {
          (fn as Listener<T>)(event);
        } catch (err) {
          console.error(`[ModuleEventBus] handler for ${name} threw:`, err);
        }
      });
    }
    this.wildcardListeners.forEach((fn) => {
      try {
        fn(event as ModuleEvent);
      } catch (err) {
        console.error('[ModuleEventBus] wildcard handler threw:', err);
      }
    });

    if (typeof window !== 'undefined' && (window as Window & { __DARAI_DEBUG_BUS?: boolean }).__DARAI_DEBUG_BUS) {
      console.log('[ModuleEventBus]', name, payload);
    }
  }

  on<T = unknown>(name: ModuleEventName, fn: Listener<T>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(fn as Listener);
    return () => {
      set!.delete(fn as Listener);
    };
  }

  onAny(fn: Listener): () => void {
    this.wildcardListeners.add(fn);
    return () => {
      this.wildcardListeners.delete(fn);
    };
  }

  /** Returns events emitted in the last `windowMs` ms — useful for catch-up. */
  recent(windowMs = 5000): ModuleEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.recentEvents.filter((e) => e.timestamp >= cutoff);
  }

  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.recentEvents = [];
  }
}

export const moduleBus = new ModuleEventBus();
