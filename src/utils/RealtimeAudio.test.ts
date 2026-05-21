import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { parseNaturalDate, fuzzyMatchTask } from "./RealtimeAudio";

const FIXED_NOW = new Date("2025-05-21T12:00:00Z"); // Wed

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("parseNaturalDate", () => {
  it("returns today's date for 'today'", () => {
    expect(parseNaturalDate("today")).toBe("2025-05-21");
  });

  it("returns tomorrow for 'tomorrow'", () => {
    expect(parseNaturalDate("tomorrow")).toBe("2025-05-22");
  });

  it("returns +7 days for 'next week'", () => {
    expect(parseNaturalDate("next week")).toBe("2025-05-28");
  });

  it("handles 'in N days'", () => {
    expect(parseNaturalDate("in 3 days")).toBe("2025-05-24");
    expect(parseNaturalDate("in 1 day")).toBe("2025-05-22");
  });

  it("rolls a past weekday to the next occurrence", () => {
    // Wed → Monday should jump to next Mon (not previous)
    expect(parseNaturalDate("monday")).toBe("2025-05-26");
  });

  it("returns null for unparseable input", () => {
    expect(parseNaturalDate("garbage gibberish")).toBeNull();
  });

  it("parses explicit ISO dates", () => {
    expect(parseNaturalDate("2026-01-15")).toBe("2026-01-15");
  });
});

describe("fuzzyMatchTask", () => {
  const tasks = [
    { id: "1", title: "Buy groceries", completed: false },
    { id: "2", title: "Call dentist", completed: false },
    { id: "3", title: "Buy groceries", completed: true }, // completed
    { id: "4", title: "Call mom about dinner", completed: false },
  ];

  it("ignores completed tasks", () => {
    const matches = fuzzyMatchTask("buy groceries", tasks);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("1");
  });

  it("returns exact match with the highest score", () => {
    const [top] = fuzzyMatchTask("buy groceries", tasks);
    expect(top.score).toBe(100);
  });

  it("ranks substring matches above word-only matches", () => {
    const matches = fuzzyMatchTask("call", tasks);
    expect(matches.map((m) => m.id)).toEqual(["2", "4"]);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
  });

  it("returns empty array when nothing matches", () => {
    expect(fuzzyMatchTask("nonexistent query xyz", tasks)).toEqual([]);
  });
});
