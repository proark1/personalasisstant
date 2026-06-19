import { describe, expect, it } from "vitest";
import {
  DAILY_AI_ACTION_LIMIT,
  InFlightRegistry,
  QuotaStorage,
  canCreateAiAction,
  getAiActionCount,
  normalizeTitle,
  quotaDayKey,
  recordAiActions,
  remainingAiActions,
} from "./aiActionGuard";

function makeStorage(initial: Record<string, string> = {}): QuotaStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("quotaDayKey", () => {
  it("formats a stable local YYYY-MM-DD", () => {
    expect(quotaDayKey(new Date(2026, 4, 28))).toBe("2026-05-28");
    expect(quotaDayKey(new Date(2026, 0, 1))).toBe("2026-01-01");
  });
});

describe("AI action quota", () => {
  const now = new Date(2026, 4, 28);

  it("starts at zero and full remaining", () => {
    const s = makeStorage();
    expect(getAiActionCount("u1", now, s)).toBe(0);
    expect(remainingAiActions("u1", now, s)).toBe(DAILY_AI_ACTION_LIMIT);
  });

  it("records and accumulates within the day", () => {
    const s = makeStorage();
    expect(recordAiActions("u1", 3, now, s)).toBe(3);
    expect(recordAiActions("u1", 2, now, s)).toBe(5);
    expect(getAiActionCount("u1", now, s)).toBe(5);
    expect(remainingAiActions("u1", now, s)).toBe(DAILY_AI_ACTION_LIMIT - 5);
  });

  it("isolates counts per user and per day", () => {
    const s = makeStorage();
    recordAiActions("u1", 4, now, s);
    expect(getAiActionCount("u2", now, s)).toBe(0);
    const tomorrow = new Date(2026, 4, 29);
    expect(getAiActionCount("u1", tomorrow, s)).toBe(0);
  });

  it("enforces the ceiling", () => {
    const s = makeStorage({ [`darai-ai-quota-u1-2026-05-28`]: String(DAILY_AI_ACTION_LIMIT - 1) });
    expect(canCreateAiAction("u1", 1, now, s)).toBe(true);
    expect(canCreateAiAction("u1", 2, now, s)).toBe(false);
  });

  it("degrades gracefully without storage", () => {
    expect(getAiActionCount("u1", now, null)).toBe(0);
    expect(canCreateAiAction("u1", 1, now, null)).toBe(true);
    expect(recordAiActions("u1", 1, now, null)).toBe(0);
  });
});

describe("normalizeTitle", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeTitle("  Pay   Rent ")).toBe("pay rent");
    expect(normalizeTitle("PAY RENT")).toBe("pay rent");
  });
});

describe("InFlightRegistry", () => {
  it("claims once and blocks duplicates until released", () => {
    const r = new InFlightRegistry();
    expect(r.claim("task", "Pay rent")).toBe(true);
    expect(r.claim("task", "  pay   RENT ")).toBe(false); // normalised match
    r.release("task", "Pay rent");
    expect(r.claim("task", "Pay rent")).toBe(true);
  });

  it("separates by kind", () => {
    const r = new InFlightRegistry();
    expect(r.claim("task", "Standup")).toBe(true);
    expect(r.claim("event", "Standup")).toBe(true);
  });
});
