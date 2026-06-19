import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __setStoreForTests,
  count,
  enqueue,
  flush,
  getAll,
  remove,
  subscribe,
  type OfflineQueueEntry,
} from "./offlineQueue";

// An in-memory store implementation mirroring the module's internal contract.
// We inject it via __setStoreForTests so these tests never need a real
// IndexedDB (jsdom doesn't provide one).
function makeStore() {
  let entries: OfflineQueueEntry[] = [];
  const sort = (xs: OfflineQueueEntry[]) =>
    [...xs].sort((a, b) =>
      a.createdAt !== b.createdAt ? a.createdAt - b.createdAt : a.id < b.id ? -1 : 1,
    );
  return {
    async add(e: OfflineQueueEntry) {
      entries.push(e);
    },
    async getAll() {
      return sort(entries);
    },
    async delete(id: string) {
      entries = entries.filter((e) => e.id !== id);
    },
    async count() {
      return entries.length;
    },
  };
}

beforeEach(() => {
  __setStoreForTests(makeStore());
});

function entryArgs(over: Partial<OfflineQueueEntry> = {}) {
  return {
    op: "insert" as const,
    table: "tasks",
    payload: { title: "t" },
    userId: "u1",
    ...over,
  };
}

describe("offlineQueue FIFO ordering", () => {
  it("returns entries oldest-first by createdAt", async () => {
    await enqueue(entryArgs({ id: "b", createdAt: 200, payload: { n: 2 } }));
    await enqueue(entryArgs({ id: "a", createdAt: 100, payload: { n: 1 } }));
    await enqueue(entryArgs({ id: "c", createdAt: 300, payload: { n: 3 } }));

    const all = await getAll();
    expect(all.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("fills in id and createdAt when omitted", async () => {
    const e = await enqueue(entryArgs());
    expect(e.id).toBeTruthy();
    expect(typeof e.createdAt).toBe("number");
  });
});

describe("count and remove", () => {
  it("count() reflects enqueue/remove", async () => {
    expect(await count()).toBe(0);
    await enqueue(entryArgs({ id: "1", createdAt: 1 }));
    await enqueue(entryArgs({ id: "2", createdAt: 2 }));
    expect(await count()).toBe(2);
    await remove("1");
    expect(await count()).toBe(1);
    expect((await getAll()).map((e) => e.id)).toEqual(["2"]);
  });
});

describe("flush", () => {
  it("removes succeeded entries and reports counts", async () => {
    await enqueue(entryArgs({ id: "1", createdAt: 1 }));
    await enqueue(entryArgs({ id: "2", createdAt: 2 }));
    await enqueue(entryArgs({ id: "3", createdAt: 3 }));

    const seen: string[] = [];
    const result = await flush(async (e) => {
      seen.push(e.id);
    });

    expect(seen).toEqual(["1", "2", "3"]); // ran in FIFO order
    expect(result).toEqual({ flushed: 3, remaining: 0 });
    expect(await count()).toBe(0);
  });

  it("STOPS at the first failure and keeps that entry plus the rest", async () => {
    await enqueue(entryArgs({ id: "1", createdAt: 1 }));
    await enqueue(entryArgs({ id: "2", createdAt: 2 }));
    await enqueue(entryArgs({ id: "3", createdAt: 3 }));
    await enqueue(entryArgs({ id: "4", createdAt: 4 }));

    const seen: string[] = [];
    const result = await flush(async (e) => {
      seen.push(e.id);
      if (e.id === "2") throw new Error("boom");
    });

    // Stopped after attempting #2; #3 and #4 were never attempted.
    expect(seen).toEqual(["1", "2"]);
    expect(result).toEqual({ flushed: 1, remaining: 3 });

    // #1 removed; #2, #3, #4 preserved in original order.
    expect((await getAll()).map((e) => e.id)).toEqual(["2", "3", "4"]);
  });

  it("on a clean retry after a transient failure, drains everything", async () => {
    await enqueue(entryArgs({ id: "1", createdAt: 1 }));
    await enqueue(entryArgs({ id: "2", createdAt: 2 }));

    let fail = true;
    await flush(async (e) => {
      if (e.id === "2" && fail) throw new Error("transient");
    });
    expect((await getAll()).map((e) => e.id)).toEqual(["2"]);

    fail = false;
    const result = await flush(async () => {});
    expect(result).toEqual({ flushed: 1, remaining: 0 });
    expect(await count()).toBe(0);
  });
});

describe("subscribe", () => {
  it("notifies on count changes and supports unsubscribe", async () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);

    await enqueue(entryArgs({ id: "1", createdAt: 1 }));
    await enqueue(entryArgs({ id: "2", createdAt: 2 }));
    await remove("1");

    // The latest notification should reflect a count of 1.
    expect(cb).toHaveBeenCalled();
    const calls = cb.mock.calls;
    expect(calls[calls.length - 1][0]).toBe(1);

    cb.mockClear();
    unsub();
    await enqueue(entryArgs({ id: "3", createdAt: 3 }));
    expect(cb).not.toHaveBeenCalled();
  });
});
