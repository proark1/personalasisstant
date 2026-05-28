import { describe, expect, it } from "vitest";
import {
  getRecurrenceDescription,
  parseRRuleString,
  toRRuleString,
} from "./recurrence";
import type { RecurrenceRule } from "@/types/flux";

describe("toRRuleString", () => {
  it("emits FREQ only for a simple daily rule", () => {
    expect(toRRuleString({ frequency: "daily", interval: 1 })).toBe("FREQ=DAILY");
  });

  it("includes INTERVAL when > 1", () => {
    expect(toRRuleString({ frequency: "weekly", interval: 2 })).toBe(
      "FREQ=WEEKLY;INTERVAL=2",
    );
  });

  it("encodes BYDAY for weekly rules with days", () => {
    const rule: RecurrenceRule = { frequency: "weekly", interval: 1, daysOfWeek: [1, 3, 5] };
    expect(toRRuleString(rule)).toBe("FREQ=WEEKLY;BYDAY=MO,WE,FR");
  });

  it("does not emit BYDAY for non-weekly rules even with daysOfWeek", () => {
    const rule: RecurrenceRule = { frequency: "monthly", interval: 1, daysOfWeek: [1] };
    expect(toRRuleString(rule)).toBe("FREQ=MONTHLY");
  });

  it("encodes UNTIL from endDate", () => {
    const rule: RecurrenceRule = {
      frequency: "daily",
      interval: 1,
      endDate: new Date("2024-12-31T00:00:00.000Z"),
    };
    expect(toRRuleString(rule)).toContain("UNTIL=20241231T000000Z");
  });
});

describe("parseRRuleString", () => {
  it("returns null for empty input", () => {
    expect(parseRRuleString("")).toBeNull();
  });

  it("round-trips with toRRuleString for weekly+byday", () => {
    const original: RecurrenceRule = { frequency: "weekly", interval: 2, daysOfWeek: [1, 4] };
    const parsed = parseRRuleString(toRRuleString(original));
    expect(parsed?.frequency).toBe("weekly");
    expect(parsed?.interval).toBe(2);
    expect(parsed?.daysOfWeek).toEqual([1, 4]);
  });

  it("defaults interval to 1 when absent", () => {
    expect(parseRRuleString("FREQ=MONTHLY")?.interval).toBe(1);
  });

  it("ignores unknown BYDAY tokens", () => {
    const parsed = parseRRuleString("FREQ=WEEKLY;BYDAY=MO,XX,FR");
    expect(parsed?.daysOfWeek).toEqual([1, 5]);
  });
});

describe("getRecurrenceDescription", () => {
  it("returns empty string for undefined", () => {
    expect(getRecurrenceDescription(undefined)).toBe("");
  });

  it("describes a simple daily rule", () => {
    expect(getRecurrenceDescription("FREQ=DAILY")).toBe("Every day");
  });

  it("pluralizes interval rules", () => {
    expect(getRecurrenceDescription("FREQ=WEEKLY;INTERVAL=2")).toBe("Every 2 weeks");
  });

  it("lists weekday names for weekly+byday", () => {
    expect(getRecurrenceDescription("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toBe(
      "Every week on Mon, Wed, Fri",
    );
  });
});
