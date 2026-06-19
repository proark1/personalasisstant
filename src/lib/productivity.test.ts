import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { subDays, startOfDay } from "date-fns";
import { calculateProductivityStreak } from "./productivity";

const NOW = new Date("2025-05-21T14:30:00Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

const todayMidnight = startOfDay(NOW);

describe("calculateProductivityStreak", () => {
  it("returns 0 when there are no completed tasks", () => {
    expect(calculateProductivityStreak([])).toBe(0);
    expect(calculateProductivityStreak([{ completed: false, dueDate: todayMidnight }])).toBe(0);
  });

  it("ignores completed tasks with no dueDate", () => {
    expect(calculateProductivityStreak([{ completed: true, dueDate: null }])).toBe(0);
  });

  it("counts a single-day streak (today)", () => {
    expect(calculateProductivityStreak([{ completed: true, dueDate: todayMidnight }])).toBe(1);
  });

  it("counts a three-day consecutive streak", () => {
    const tasks = [
      { completed: true, dueDate: subDays(NOW, 0) },
      { completed: true, dueDate: subDays(NOW, 1) },
      { completed: true, dueDate: subDays(NOW, 2) },
    ];
    expect(calculateProductivityStreak(tasks)).toBe(3);
  });

  it("breaks streak when a day is missing", () => {
    const tasks = [
      { completed: true, dueDate: subDays(NOW, 0) },
      { completed: true, dueDate: subDays(NOW, 1) },
      // day 2 missing
      { completed: true, dueDate: subDays(NOW, 3) },
    ];
    expect(calculateProductivityStreak(tasks)).toBe(2);
  });

  it("tolerates today missing — counts the consecutive prior days", () => {
    // Faithful to the original Index.tsx implementation: the loop only
    // breaks on a gap when i > 0, so a missing "today" doesn't reset
    // the streak.
    const tasks = [
      { completed: true, dueDate: subDays(NOW, 1) },
      { completed: true, dueDate: subDays(NOW, 2) },
    ];
    expect(calculateProductivityStreak(tasks)).toBe(2);
  });
});
