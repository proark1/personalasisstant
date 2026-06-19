import { describe, it, expect } from "vitest";
import { classifyThinkingStatus } from "./thinkingStatus";

describe("classifyThinkingStatus", () => {
  it("falls back to 'Thinking...' for unrelated text", () => {
    expect(classifyThinkingStatus("hello world")).toBe("Thinking...");
  });

  it("matches web/news/latest first", () => {
    expect(classifyThinkingStatus("any news today?")).toBe("Searching the web...");
    expect(classifyThinkingStatus("latest releases please")).toBe("Searching the web...");
  });

  it("classifies task-related prompts", () => {
    expect(classifyThinkingStatus("add a todo")).toBe("Checking your tasks...");
    expect(classifyThinkingStatus("Remind me to call mom")).toBe("Checking your tasks...");
  });

  it("classifies calendar prompts", () => {
    expect(classifyThinkingStatus("what's on my schedule")).toBe("Looking at your calendar...");
  });

  it("classifies email prompts", () => {
    expect(classifyThinkingStatus("read my inbox")).toBe("Checking your emails...");
  });

  it("classifies health prompts", () => {
    expect(classifyThinkingStatus("how many steps today")).toBe("Analyzing health data...");
  });

  it("classifies contact prompts", () => {
    expect(classifyThinkingStatus("who is John?")).toBe("Searching contacts...");
  });

  it("first-match-wins between overlapping keywords", () => {
    // 'search' wins over 'contact' even though both are present
    expect(classifyThinkingStatus("search my contacts")).toBe("Searching the web...");
  });

  it("is case-insensitive", () => {
    expect(classifyThinkingStatus("SCHEDULE a MEETING")).toBe("Looking at your calendar...");
  });
});
