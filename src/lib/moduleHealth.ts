/**
 * ModuleHealthRegistry — graceful degradation across modules.
 *
 * Solves: one bad OAuth (e.g. Apple HealthKit) used to break the entire
 * dashboard. Edge functions assumed module data was always present.
 *
 * Now: each module reports its status (ok | degraded | failed | disabled)
 * and last successful fetch time. Consumers (smartPayloadBuilder, AI chat,
 * UI cards) can ask "is module X healthy?" and fall back gracefully.
 */

import { moduleBus } from './moduleEventBus';

export type ModuleId =
  | 'tasks' | 'events' | 'contacts' | 'contracts' | 'emails'
  | 'notes' | 'habits' | 'health' | 'apple-health' | 'family'
  | 'shopping' | 'calendar-sync' | 'gmail-sync' | 'ai-memory'
  | 'realtime' | 'workspace';

export type ModuleStatus = 'ok' | 'degraded' | 'failed' | 'disabled' | 'unknown';

export interface ModuleHealth {
  status: ModuleStatus;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastError: string | null;
  failureCount: number;
}

const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const FAIL_THRESHOLD = 3;

class ModuleHealthRegistry {
  private state = new Map<ModuleId, ModuleHealth>();
  private listeners = new Set<(id: ModuleId, h: ModuleHealth) => void>();

  private get(id: ModuleId): ModuleHealth {
    let h = this.state.get(id);
    if (!h) {
      h = { status: 'unknown', lastSuccessAt: null, lastErrorAt: null, lastError: null, failureCount: 0 };
      this.state.set(id, h);
    }
    return h;
  }

  reportSuccess(id: ModuleId): void {
    const h = this.get(id);
    const wasFailing = h.status === 'failed' || h.status === 'degraded';
    h.status = 'ok';
    h.lastSuccessAt = Date.now();
    h.lastError = null;
    h.failureCount = 0;
    this.notify(id, h);
    if (wasFailing) {
      moduleBus.emit('module:recovered', { module: id }, id);
    }
  }

  reportError(id: ModuleId, error: unknown): void {
    const h = this.get(id);
    h.lastErrorAt = Date.now();
    h.lastError = error instanceof Error ? error.message : String(error);
    h.failureCount += 1;
    h.status = h.failureCount >= FAIL_THRESHOLD ? 'failed' : 'degraded';
    this.notify(id, h);
    moduleBus.emit('module:error', { module: id, error: h.lastError }, id);
  }

  setDisabled(id: ModuleId): void {
    const h = this.get(id);
    h.status = 'disabled';
    this.notify(id, h);
  }

  status(id: ModuleId): ModuleStatus {
    const h = this.state.get(id);
    if (!h) return 'unknown';
    if (h.status === 'ok' && h.lastSuccessAt && Date.now() - h.lastSuccessAt > STALE_AFTER_MS) {
      return 'degraded';
    }
    return h.status;
  }

  isHealthy(id: ModuleId): boolean {
    const s = this.status(id);
    return s === 'ok' || s === 'unknown';
  }

  /** Returns full health snapshot for diagnostics / UI. */
  snapshot(): Record<string, ModuleHealth> {
    const out: Record<string, ModuleHealth> = {};
    this.state.forEach((h, id) => {
      out[id] = { ...h };
    });
    return out;
  }

  onChange(fn: (id: ModuleId, h: ModuleHealth) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(id: ModuleId, h: ModuleHealth) {
    this.listeners.forEach((fn) => {
      try {
        fn(id, { ...h });
      } catch (err) {
        console.error('[ModuleHealth] listener threw:', err);
      }
    });
  }
}

export const moduleHealth = new ModuleHealthRegistry();

/**
 * Wrap an async data-fetcher so failures are tracked and don't crash callers.
 * Returns the data, or `fallback` if the fetcher throws.
 */
export async function withModuleHealth<T>(
  id: ModuleId,
  fetcher: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const result = await fetcher();
    moduleHealth.reportSuccess(id);
    return result;
  } catch (err) {
    moduleHealth.reportError(id, err);
    return fallback;
  }
}
