import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, TimeoutError, withTimeout } from "./fetchWithTimeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("resolves when the promise resolves before the timeout", async () => {
    const p = withTimeout(Promise.resolve("ok"), 1000);
    await expect(p).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when the promise is too slow", async () => {
    // A promise that never settles on its own — the timeout must win.
    const slow = new Promise(() => {});
    const p = withTimeout(slow, 1000);
    // Attach the rejection handler BEFORE advancing so the rejection
    // isn't briefly unhandled while fake timers flush.
    const assertion = expect(p).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
});

describe("fetchWithRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue("done");
    const result = await fetchWithRetry(fn, { maxRetries: 3 });
    expect(result).toBe("done");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a non-retryable (business) error", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("validation failed"));
    await expect(fetchWithRetry(fn, { maxRetries: 3 })).rejects.toThrow("validation failed");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a network error then succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("recovered");
    const onRetry = vi.fn();
    const promise = fetchWithRetry(fn, { maxRetries: 3, onRetry });
    // Flush the backoff timers + microtasks.
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries and throws the last error", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const promise = fetchWithRetry(fn, { maxRetries: 2 });
    // Attach the rejection assertion BEFORE flushing timers so the
    // rejection isn't seen as unhandled.
    const assertion = expect(promise).rejects.toThrow("Failed to fetch");
    await vi.runAllTimersAsync();
    await assertion;
    // 1 initial + 2 retries = 3 calls.
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
