import { describe, expect, it } from "vitest";
import { expandRecurringItems } from "./recurrenceExpander";

interface TestEvent {
  id: string;
  startTime?: Date;
  endTime?: Date;
  dueDate?: Date;
  recurrenceRule?: string;
  recurrenceEnd?: Date;
}

describe("expandRecurringItems", () => {
  it("passes non-recurring items through unchanged", () => {
    const event: TestEvent = {
      id: "e1",
      startTime: new Date("2026-05-30T09:00:00"),
      endTime: new Date("2026-05-30T10:00:00"),
    };
    const result = expandRecurringItems(
      [event],
      new Date("2026-05-01T00:00:00"),
      new Date("2026-06-30T00:00:00"),
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
    expect(result[0].endTime).toEqual(event.endTime);
  });

  it("preserves time-of-day for every recurring instance (no midnight collapse)", () => {
    const event: TestEvent = {
      id: "daily",
      startTime: new Date("2026-05-30T08:30:00"),
      endTime: new Date("2026-05-30T09:15:00"),
      recurrenceRule: "FREQ=DAILY",
    };
    const result = expandRecurringItems(
      [event],
      new Date("2026-05-30T00:00:00"),
      new Date("2026-06-02T23:59:59"),
    );

    expect(result.length).toBeGreaterThan(1);
    for (const inst of result) {
      expect(inst.startTime).toBeInstanceOf(Date);
      expect(inst.startTime!.getHours()).toBe(8);
      expect(inst.startTime!.getMinutes()).toBe(30);
    }
  });

  it("never produces an undefined or invalid endTime, and preserves duration", () => {
    const event: TestEvent = {
      id: "weekly",
      startTime: new Date("2026-05-29T14:00:00"), // a Friday
      endTime: new Date("2026-05-29T15:30:00"), // 90 min
      recurrenceRule: "FREQ=WEEKLY;BYDAY=FR",
    };
    const result = expandRecurringItems(
      [event],
      new Date("2026-05-29T00:00:00"),
      new Date("2026-06-26T23:59:59"),
    );

    expect(result.length).toBeGreaterThan(1);
    for (const inst of result) {
      expect(inst.endTime).toBeInstanceOf(Date);
      expect(Number.isNaN(inst.endTime!.getTime())).toBe(false);
      // 90-minute duration preserved relative to the instance start.
      expect(inst.endTime!.getTime() - inst.startTime!.getTime()).toBe(90 * 60 * 1000);
    }
  });

  it("falls back to a 1h end when the source event has no endTime", () => {
    const event: TestEvent = {
      id: "noend",
      startTime: new Date("2026-05-30T11:00:00"),
      recurrenceRule: "FREQ=DAILY",
    };
    const result = expandRecurringItems(
      [event],
      new Date("2026-05-30T00:00:00"),
      new Date("2026-06-01T23:59:59"),
    );

    expect(result.length).toBeGreaterThan(1);
    for (const inst of result) {
      expect(inst.endTime).toBeInstanceOf(Date);
      expect(inst.endTime!.getTime() - inst.startTime!.getTime()).toBe(60 * 60 * 1000);
    }
  });
});
