/**
 * Client-side guardrails for AI-initiated mutations ("Dori did X").
 *
 * Two concerns, both pure and unit-tested:
 *
 *  1. Daily quota — a backstop so a runaway model/loop can't create thousands
 *     of rows. Per-message caps already exist; this adds a per-user, per-day
 *     ceiling persisted in localStorage.
 *
 *  2. Title de-duplication — a normaliser plus an in-flight registry so two
 *     concurrent chat turns can't both create "Pay rent". The per-message
 *     Set only caught dupes within a single message; the registry spans turns.
 */

/** Generous daily ceiling for AI-created entities (tasks, events, …). */
export const DAILY_AI_ACTION_LIMIT = 200;

export interface QuotaStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): QuotaStorage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* access can throw in sandboxed iframes */
  }
  return null;
}

/** Local calendar day, e.g. "2026-05-28" — quotas reset at local midnight. */
export function quotaDayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(userId: string | undefined, now: Date): string {
  return `darai-ai-quota-${userId ?? 'anon'}-${quotaDayKey(now)}`;
}

export function getAiActionCount(
  userId: string | undefined,
  now: Date = new Date(),
  storage: QuotaStorage | null = defaultStorage(),
): number {
  if (!storage) return 0;
  const raw = storage.getItem(storageKey(userId, now));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function remainingAiActions(
  userId: string | undefined,
  now: Date = new Date(),
  storage: QuotaStorage | null = defaultStorage(),
): number {
  return Math.max(0, DAILY_AI_ACTION_LIMIT - getAiActionCount(userId, now, storage));
}

/** Whether `count` more AI actions fit under today's ceiling. */
export function canCreateAiAction(
  userId: string | undefined,
  count = 1,
  now: Date = new Date(),
  storage: QuotaStorage | null = defaultStorage(),
): boolean {
  return getAiActionCount(userId, now, storage) + count <= DAILY_AI_ACTION_LIMIT;
}

/** Record `count` AI actions against today's quota; returns the new total. */
export function recordAiActions(
  userId: string | undefined,
  count = 1,
  now: Date = new Date(),
  storage: QuotaStorage | null = defaultStorage(),
): number {
  if (!storage) return 0;
  const next = getAiActionCount(userId, now, storage) + count;
  try {
    storage.setItem(storageKey(userId, now), String(next));
  } catch {
    /* storage full / unavailable — best effort */
  }
  return next;
}

/** Normalise a title for dedup: lowercase, trimmed, whitespace-collapsed. */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Tracks entities currently being created, keyed by `${kind}:${title}`, so
 * overlapping chat turns don't double-create. `claim` returns false if the
 * key is already in flight; callers must `release` in a finally block.
 */
export class InFlightRegistry {
  private readonly keys = new Set<string>();

  private makeKey(kind: string, title: string): string {
    return `${kind}:${normalizeTitle(title)}`;
  }

  claim(kind: string, title: string): boolean {
    const key = this.makeKey(kind, title);
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }

  release(kind: string, title: string): void {
    this.keys.delete(this.makeKey(kind, title));
  }
}

/** Shared registry instance for the chat tool-call loop. */
export const aiInFlight = new InFlightRegistry();
