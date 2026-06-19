import { describe, it, expect } from "vitest";
import { cleanAssistantContent } from "./assistantContent";

describe("cleanAssistantContent", () => {
  it("returns trimmed input when no tool blocks present", () => {
    expect(cleanAssistantContent("  hello world  ")).toBe("hello world");
  });

  it("strips a task tool block", () => {
    const input = "Sure thing. <tool>manage_task<action>add</action></task> Done!";
    expect(cleanAssistantContent(input)).toBe("Sure thing.  Done!");
  });

  it("strips multiple consecutive tool blocks", () => {
    const input = "Working on it. <tool>foo</task><tool>bar</event> All set.";
    expect(cleanAssistantContent(input)).toBe("Working on it.  All set.");
  });

  it("strips get_summary type tags", () => {
    const input = "Here are the costs: <tool>get_summary</tool> <type>contract_costs</type>";
    expect(cleanAssistantContent(input)).toBe("Here are the costs:");
  });

  it("strips set_reminder JSON payload", () => {
    const input =
      'Reminder set <tool>set_reminder</tool> <reminder>{"at":"2026-01-01"}</reminder> for you.';
    expect(cleanAssistantContent(input)).toBe("Reminder set  for you.");
  });

  it("handles multiline tool block bodies", () => {
    const input = `<tool>
      manage_contact
      <action>create</action>
    </contact>response here`;
    expect(cleanAssistantContent(input)).toBe("response here");
  });

  it("returns empty string when input is only a tool block", () => {
    expect(cleanAssistantContent("<tool>x</item>")).toBe("");
  });
});
