import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FAMILY_RELATIONSHIP_MAP,
  fuzzyMatchByName,
  fuzzyMatchContact,
  parseEventDateTime,
  resolveContactByQuery,
} from "./realtimeToolHelpers";

describe("fuzzyMatchByName", () => {
  const items = [
    { id: "1", name: "Acme Corp" },
    { id: "2", name: "Beta LLC" },
    { id: "3", name: "Acme Industries" },
  ];

  it("matches by substring", () => {
    expect(fuzzyMatchByName("acme", items).map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("matches when every word appears (any order)", () => {
    expect(fuzzyMatchByName("industries acme", items).map((i) => i.id)).toEqual(["3"]);
  });

  it("caps results at 5", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: String(i), name: "same" }));
    expect(fuzzyMatchByName("same", many)).toHaveLength(5);
  });
});

describe("fuzzyMatchContact", () => {
  const contacts = [
    { id: "1", name: "Jane Doe", company: "Acme", city: "Berlin", tags: ["vip"] },
    { id: "2", name: "John Smith", company: "Beta", city: "Munich", tags: [] },
  ];

  it("matches across multiple fields", () => {
    expect(fuzzyMatchContact("berlin", contacts).map((c) => c.id)).toEqual(["1"]);
    expect(fuzzyMatchContact("beta", contacts).map((c) => c.id)).toEqual(["2"]);
    expect(fuzzyMatchContact("vip", contacts).map((c) => c.id)).toEqual(["1"]);
  });

  it("tolerates missing optional fields", () => {
    const sparse = [{ id: "3", name: "Solo" }];
    expect(fuzzyMatchContact("solo", sparse).map((c) => c.id)).toEqual(["3"]);
  });
});

describe("resolveContactByQuery", () => {
  const contacts = [
    { id: "1", name: "Sarah", familyRelationship: "Wife" },
    { id: "2", name: "Bob", familyRelationship: "Friend" },
    { id: "3", name: "Mom Jones", familyRelationship: "Mother" },
  ];

  it("resolves 'my wife' to the spouse via the relationship map", () => {
    expect(resolveContactByQuery("my wife", contacts).map((c) => c.id)).toEqual(["1"]);
  });

  it("resolves a bare relationship word", () => {
    expect(resolveContactByQuery("mom", contacts).map((c) => c.id)).toEqual(["3"]);
  });

  it("falls back to fuzzy name match when not a relationship", () => {
    expect(resolveContactByQuery("bob", contacts).map((c) => c.id)).toEqual(["2"]);
  });

  it("has symmetric spouse mappings", () => {
    expect(FAMILY_RELATIONSHIP_MAP.wife).toContain("spouse");
    expect(FAMILY_RELATIONSHIP_MAP.husband).toContain("spouse");
  });
});

describe("parseEventDateTime", () => {
  // Anchor "now" so the past→tomorrow rollover is deterministic.
  const NOW = new Date("2024-06-12T10:00:00.000Z");
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("parses an ISO date to the correct day", () => {
    // parseNaturalDate runs first and resolves to the calendar day
    // (time-of-day is not preserved for ISO input — existing behavior).
    const d = parseEventDateTime("2024-07-01T14:00:00.000Z");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(6); // July (0-indexed)
    expect(d!.getDate()).toBe(1);
  });

  it("parses a bare time and applies it to today", () => {
    const d = parseEventDateTime("3pm");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getHours()).toBe(15);
  });

  it("rolls a past time forward to tomorrow", () => {
    // 8am is before the 10am (UTC) anchor → should land on the 13th.
    const d = parseEventDateTime("8:00am");
    expect(d).toBeInstanceOf(Date);
    expect(d!.getDate()).toBe(13);
  });

  it("returns null for unparseable input", () => {
    expect(parseEventDateTime("not a date at all zzz")).toBeNull();
  });
});
