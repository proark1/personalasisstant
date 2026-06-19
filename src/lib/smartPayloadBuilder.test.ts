import { describe, expect, it } from "vitest";
import {
  detectContextIntents,
  mentionsTerm,
  findMentionedEntities,
  buildSmartPayload,
} from "./smartPayloadBuilder";
import type { Contact } from "@/hooks/useContacts";
import type { Contract } from "@/hooks/useSmartContext";
import type { Note } from "@/hooks/useNotes";

const contact = (over: Partial<Contact>): Contact =>
  ({
    id: "c1",
    name: "Sarah Chen",
    company: null,
    role: null,
    tags: [],
    city: null,
    country: null,
    email: null,
    ...over,
  }) as unknown as Contact;
const contract = (over: Partial<Contract>): Contract =>
  ({
    name: "Netflix",
    provider: "Netflix",
    category: "streaming",
    isActive: true,
    ...over,
  }) as unknown as Contract;
const note = (over: Partial<Note>): Note =>
  ({
    id: "n1",
    title: "Apartment lease",
    content: "lease ends in March",
    tags: [],
    ...over,
  }) as unknown as Note;

describe("detectContextIntents", () => {
  it("detects email intent across phrasings", () => {
    expect(detectContextIntents("reply to that email")).toContain("email");
    expect(detectContextIntents("anything in my inbox?")).toContain("email");
  });

  it("detects contracts from synonyms the old list missed", () => {
    expect(detectContextIntents("cancel my subscriptions")).toContain("contracts");
    expect(detectContextIntents("how much is my internet bill")).toContain("contracts");
    expect(detectContextIntents("that invoice from the provider")).toContain("contracts");
  });

  it("detects wellbeing/overwhelm signals", () => {
    expect(detectContextIntents("I'm so overwhelmed today")).toContain("wellbeing");
    expect(detectContextIntents("feeling burned out and exhausted")).toContain("wellbeing");
    expect(detectContextIntents("ich bin total gestresst")).toContain("wellbeing");
  });

  it("detects contacts from relationship/action phrasings", () => {
    expect(detectContextIntents("I need to follow up with my client")).toContain("contacts");
    expect(detectContextIntents("reach out to a recruiter")).toContain("contacts");
  });

  it("returns multiple intents when a message spans domains", () => {
    const intents = detectContextIntents("email my lawyer about the contract");
    expect(intents).toEqual(expect.arrayContaining(["email", "contacts", "contracts"]));
  });

  it("returns empty for a neutral message", () => {
    expect(detectContextIntents("what time is it")).toEqual([]);
  });

  it("never includes the dynamic location bucket", () => {
    expect(detectContextIntents("anything at all")).not.toContain("location");
  });
});

describe("mentionsTerm", () => {
  it("matches whole words / phrases case-insensitively", () => {
    expect(mentionsTerm("can you text sarah today", "Sarah")).toBe(true);
    expect(mentionsTerm("cancel my netflix plan", "Netflix")).toBe(true);
    expect(mentionsTerm("email john smith back", "John Smith")).toBe(true);
  });

  it("does not match substrings inside other words", () => {
    // "Al" must not match "always"; short terms (<3 chars) are skipped entirely.
    expect(mentionsTerm("i will always be late", "Al")).toBe(false);
    // "ass" must not match inside "assistant" — word boundaries, not substrings.
    expect(mentionsTerm("the assistant is helpful", "ass")).toBe(false);
    // But the same term as a standalone word does match.
    expect(mentionsTerm("what an ass move", "ass")).toBe(true);
  });

  it("skips empty/too-short terms", () => {
    expect(mentionsTerm("hello there", "")).toBe(false);
    expect(mentionsTerm("hello there", null)).toBe(false);
    expect(mentionsTerm("hello there", "hi")).toBe(false);
  });
});

describe("findMentionedEntities", () => {
  it("finds a contact named directly even with no contact keyword", () => {
    const res = findMentionedEntities({
      message: "should I follow up with Sarah Chen?",
      contacts: [contact({ name: "Sarah Chen" }), contact({ id: "c2", name: "Bob Jones" })],
    });
    expect(res.contacts.map((c) => c.name)).toEqual(["Sarah Chen"]);
  });

  it("finds a contract by provider name", () => {
    const res = findMentionedEntities({
      message: "how do I cancel Netflix",
      contracts: [contract({ provider: "Netflix" }), contract({ name: "Gym", provider: "FitX" })],
    });
    expect(res.contracts).toHaveLength(1);
    expect(res.contracts[0].provider).toBe("Netflix");
  });

  it("finds a note by title", () => {
    const res = findMentionedEntities({
      message: "what did I write in my apartment lease note",
      notes: [note({ title: "Apartment lease" }), note({ id: "n2", title: "Groceries" })],
    });
    expect(res.notes.map((n) => n.title)).toEqual(["Apartment lease"]);
  });
});

describe("buildSmartPayload — entity-aware inclusion", () => {
  it("includes a contact named directly with no contact keyword present", () => {
    const payload = buildSmartPayload({
      message: "text Sarah Chen that I am running late",
      contacts: [contact({ name: "Sarah Chen", email: "sarah@x.com" })],
    });
    expect(payload.relevantContacts?.[0].name).toBe("Sarah Chen");
  });

  it("ranks the directly-mentioned contact first", () => {
    const payload = buildSmartPayload({
      // "client" is a contacts keyword (pulls everyone via role match path is off,
      // but name mention must still float Sarah to the top).
      message: "remind me to call my client Sarah Chen",
      contacts: [contact({ id: "c2", name: "Bob Jones" }), contact({ name: "Sarah Chen" })],
    });
    expect(payload.relevantContacts?.[0].name).toBe("Sarah Chen");
  });

  it("includes a contract named directly even without a contracts keyword", () => {
    const payload = buildSmartPayload({
      message: "is Netflix worth keeping",
      contracts: [contract({ name: "Netflix", provider: "Netflix" })],
    });
    expect(payload.relevantContracts?.some((c) => c.provider === "Netflix")).toBe(true);
  });

  it("does not pull context for a neutral message", () => {
    const payload = buildSmartPayload({
      message: "what time is it",
      contacts: [contact({ name: "Sarah Chen" })],
      contracts: [contract({ name: "Netflix" })],
    });
    expect(payload.relevantContacts).toBeUndefined();
    expect(payload.relevantContracts).toBeUndefined();
  });
});
