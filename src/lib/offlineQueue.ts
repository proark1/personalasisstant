// Offline write outbox.
//
// A small, IndexedDB-backed FIFO queue of pending write operations. When a
// create/update/delete is attempted while the browser is offline, the
// operation is enqueued here and replayed (in order) once connectivity
// returns. Losing or reordering queued writes is worse than not having an
// outbox at all, so the design is deliberately conservative:
//
//   - FIFO ordering is preserved (entries replay oldest-first).
//   - flush() STOPS at the first failing entry and keeps it (and everything
//     after it) for the next attempt, so causality is never broken.
//
// TESTABILITY: jsdom/vitest has no IndexedDB. The queue logic is decoupled
// from storage behind a tiny `QueueStore` interface with two implementations —
// an idb-backed store (browser) and an in-memory store (tests / SSR). The
// in-memory store is auto-selected whenever `indexedDB` is undefined, and
// `__setStoreForTests` lets a test inject one explicitly. All idb access is
// lazy + guarded so importing this module never throws off the main thread.

import type { DBSchema, IDBPDatabase } from "idb";

export type OfflineOp = "insert" | "update" | "delete";

export interface OfflineQueueEntry {
  /** uuid */
  id: string;
  op: OfflineOp;
  /** Supabase table name, e.g. 'tasks' | 'events' */
  table: string;
  /** Row data for insert/update. */
  payload: Record<string, unknown>;
  /** Match clause for update/delete (e.g. { id }, or { id: { in: [...] } }). */
  match?: Record<string, unknown>;
  createdAt: number;
  userId: string;
}

export interface FlushResult {
  flushed: number;
  remaining: number;
}

/** A runner persists a single entry to the backend. Throws/rejects on failure. */
export type FlushRunner = (entry: OfflineQueueEntry) => Promise<void>;

// --- Storage abstraction --------------------------------------------------

/**
 * Minimal storage contract the queue logic depends on. Both the idb-backed and
 * in-memory implementations satisfy it. Entries are always returned in FIFO
 * order (by createdAt, then id as a stable tiebreaker).
 */
interface QueueStore {
  add(entry: OfflineQueueEntry): Promise<void>;
  getAll(): Promise<OfflineQueueEntry[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

function sortFifo(entries: OfflineQueueEntry[]): OfflineQueueEntry[] {
  return [...entries].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** In-memory store — used in tests/SSR or wherever IndexedDB is unavailable. */
class InMemoryQueueStore implements QueueStore {
  private entries: OfflineQueueEntry[] = [];

  async add(entry: OfflineQueueEntry): Promise<void> {
    this.entries.push(entry);
  }
  async getAll(): Promise<OfflineQueueEntry[]> {
    return sortFifo(this.entries);
  }
  async delete(id: string): Promise<void> {
    this.entries = this.entries.filter((e) => e.id !== id);
  }
  async count(): Promise<number> {
    return this.entries.length;
  }
}

interface OutboxDB extends DBSchema {
  outbox: {
    key: string;
    value: OfflineQueueEntry;
    indexes: { byCreatedAt: number };
  };
}

const DB_NAME = "darai-offline-outbox";
const DB_VERSION = 1;
const STORE = "outbox";

/** idb-backed store. Used in real browsers. */
class IdbQueueStore implements QueueStore {
  private dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null;

  private async db(): Promise<IDBPDatabase<OutboxDB>> {
    if (!this.dbPromise) {
      // Lazy import so this module never references idb at load time in a
      // context where it (or IndexedDB) is unavailable.
      this.dbPromise = import("idb").then(({ openDB }) =>
        openDB<OutboxDB>(DB_NAME, DB_VERSION, {
          upgrade(database) {
            const store = database.createObjectStore(STORE, { keyPath: "id" });
            store.createIndex("byCreatedAt", "createdAt");
          },
        }),
      );
    }
    return this.dbPromise;
  }

  async add(entry: OfflineQueueEntry): Promise<void> {
    const db = await this.db();
    await db.put(STORE, entry);
  }
  async getAll(): Promise<OfflineQueueEntry[]> {
    const db = await this.db();
    // Read via the createdAt index so results come back in FIFO order, then
    // re-sort defensively (the index alone doesn't break createdAt ties).
    const all = await db.getAllFromIndex(STORE, "byCreatedAt");
    return sortFifo(all);
  }
  async delete(id: string): Promise<void> {
    const db = await this.db();
    await db.delete(STORE, id);
  }
  async count(): Promise<number> {
    const db = await this.db();
    return db.count(STORE);
  }
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

let store: QueueStore = hasIndexedDB() ? new IdbQueueStore() : new InMemoryQueueStore();

/** Test/DI hook: swap the backing store. Pass nothing to reset to auto-select. */
export function __setStoreForTests(custom?: QueueStore): void {
  store = custom ?? (hasIndexedDB() ? new IdbQueueStore() : new InMemoryQueueStore());
}

// --- Pub/sub --------------------------------------------------------------

type CountListener = (count: number) => void;
const listeners = new Set<CountListener>();

/** Subscribe to pending-count changes. Returns an unsubscribe fn. */
export function subscribe(cb: CountListener): () => void {
  listeners.add(cb);
  // Push the current count so subscribers don't have to call count() themselves.
  void count().then((n) => {
    if (listeners.has(cb)) cb(n);
  });
  return () => {
    listeners.delete(cb);
  };
}

async function notify(): Promise<void> {
  const n = await store.count();
  for (const cb of listeners) cb(n);
}

// --- Public queue API -----------------------------------------------------

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Append an entry. `id` and `createdAt` are filled in if omitted. */
export async function enqueue(
  entry: Omit<OfflineQueueEntry, "id" | "createdAt"> &
    Partial<Pick<OfflineQueueEntry, "id" | "createdAt">>,
): Promise<OfflineQueueEntry> {
  const full: OfflineQueueEntry = {
    id: entry.id ?? uuid(),
    createdAt: entry.createdAt ?? Date.now(),
    op: entry.op,
    table: entry.table,
    payload: entry.payload,
    match: entry.match,
    userId: entry.userId,
  };
  await store.add(full);
  await notify();
  return full;
}

/** All pending entries in FIFO order. */
export async function getAll(): Promise<OfflineQueueEntry[]> {
  return store.getAll();
}

/** Alias for getAll(): read without mutating. */
export const peekAll = getAll;

/** Remove a single entry by id. */
export async function remove(id: string): Promise<void> {
  await store.delete(id);
  await notify();
}

/** Number of pending entries. */
export async function count(): Promise<number> {
  return store.count();
}

/**
 * Replay pending entries in FIFO order. For each entry `await runner(entry)`:
 *   - on success, the entry is removed and we continue;
 *   - on failure, we STOP immediately and keep that entry plus all remaining
 *     ones for the next flush, so ordering/causality is preserved.
 */
export async function flush(runner: FlushRunner): Promise<FlushResult> {
  const entries = await store.getAll();
  let flushed = 0;
  let stopped = false;

  for (const entry of entries) {
    try {
      await runner(entry);
      await store.delete(entry.id);
      flushed += 1;
    } catch {
      stopped = true;
      break;
    }
  }

  if (flushed > 0) await notify();

  const remaining = stopped ? entries.length - flushed : await store.count();
  return { flushed, remaining };
}
