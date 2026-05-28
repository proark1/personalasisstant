import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseTaskInput } from "./taskParser";

// Freeze "now" so the date pattern tests are deterministic.
// 2024-06-12 is a Wednesday — used to anchor weekday tests.
const NOW = new Date("2024-06-12T10:00:00.000Z");

describe("parseTaskInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns sensible defaults for a plain title", () => {
    const r = parseTaskInput("Buy milk");
    expect(r.title).toBe("Buy milk");
    expect(r.dueDate).toBeUndefined();
    expect(r.priority).toBe("medium");
    expect(r.category).toBe("personal");
  });

  it("extracts high priority and strips the keyword from the title", () => {
    const r = parseTaskInput("Send the urgent report");
    expect(r.priority).toBe("high");
    expect(r.title.toLowerCase()).not.toContain("urgent");
  });

  it("extracts low priority", () => {
    const r = parseTaskInput("Clean garage someday");
    expect(r.priority).toBe("low");
    expect(r.title.toLowerCase()).not.toContain("someday");
  });

  it("classifies business when a work keyword is present", () => {
    const r = parseTaskInput("Prepare client presentation");
    expect(r.category).toBe("business");
  });

  it("extracts 'tomorrow' as a due date and removes it from the title", () => {
    const r = parseTaskInput("Call mom tomorrow");
    expect(r.dueDate).toBeDefined();
    expect(r.dueDate!.toISOString().slice(0, 10)).toBe("2024-06-13");
    expect(r.title.toLowerCase()).not.toContain("tomorrow");
  });

  it("supports 'in N days'", () => {
    const r = parseTaskInput("Pay bill in 5 days");
    expect(r.dueDate!.toISOString().slice(0, 10)).toBe("2024-06-17");
  });

  it("applies a time when a date is present", () => {
    const r = parseTaskInput("Meeting tomorrow at 3pm");
    expect(r.dueDate).toBeDefined();
    expect(r.dueDate!.getHours()).toBe(15);
    expect(r.dueDate!.getMinutes()).toBe(0);
  });

  it("does not apply a time when no date was parsed", () => {
    // Intentionally no date keyword — extractor should leave dueDate
    // undefined rather than attaching a time to nothing.
    const r = parseTaskInput("Lunch at 1pm");
    expect(r.dueDate).toBeUndefined();
  });

  it("capitalizes the first letter of the cleaned title", () => {
    const r = parseTaskInput("urgent fix bug tomorrow");
    expect(r.title.charAt(0)).toBe(r.title.charAt(0).toUpperCase());
    expect(r.title.length).toBeGreaterThan(0);
  });

  it("handles weekday keywords (Friday)", () => {
    // 2024-06-12 is Wed → nextFriday is 2024-06-14.
    const r = parseTaskInput("Standup Friday at 9am");
    expect(r.dueDate!.toISOString().slice(0, 10)).toBe("2024-06-14");
    expect(r.dueDate!.getHours()).toBe(9);
  });
});
