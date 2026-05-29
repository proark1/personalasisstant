import { describe, expect, it } from "vitest";
import { toValidDate, formatSafe } from "./safeDate";

describe("toValidDate", () => {
  it("returns the Date for a valid Date instance", () => {
    const d = new Date("2026-05-30T10:00:00Z");
    expect(toValidDate(d)).toEqual(d);
  });

  it("parses a valid ISO string", () => {
    expect(toValidDate("2026-05-30T10:00:00Z")?.getTime()).toBe(
      new Date("2026-05-30T10:00:00Z").getTime(),
    );
  });

  it("returns null for null / undefined", () => {
    expect(toValidDate(null)).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(toValidDate("not a date")).toBeNull();
    expect(toValidDate("")).toBeNull();
  });

  it("returns null for an Invalid Date instance", () => {
    expect(toValidDate(new Date("garbage"))).toBeNull();
  });
});

describe("formatSafe", () => {
  it("formats a valid date", () => {
    expect(formatSafe("2026-05-30T13:05:00", "HH:mm")).toBe("13:05");
  });

  it("returns the fallback (default empty string) for an invalid date instead of throwing", () => {
    expect(() => formatSafe(undefined, "HH:mm")).not.toThrow();
    expect(formatSafe(undefined, "HH:mm")).toBe("");
    expect(formatSafe("garbage", "HH:mm", undefined, "—")).toBe("—");
  });
});
