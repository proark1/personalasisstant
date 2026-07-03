import { describe, expect, it } from "vitest";
import {
  evaluateTelegramToolGrounding,
  isTelegramActionSource,
} from "../../supabase/functions/_shared/telegram-replay-guard";

describe("Telegram replay guard", () => {
  it("treats Telegram and voice surfaces as guarded sources", () => {
    expect(isTelegramActionSource("tg_private")).toBe(true);
    expect(isTelegramActionSource("tg_family")).toBe(true);
    expect(isTelegramActionSource("tg_workspace")).toBe(true);
    expect(isTelegramActionSource("voice")).toBe(true);
    expect(isTelegramActionSource("web")).toBe(false);
  });

  it("allows a current German voice-style calendar request", () => {
    const result = evaluateTelegramToolGrounding(
      {
        tool: "schedule_event",
        action: "create",
        data: {
          title: "Asad und Tugba gehen zusammen fruehstuecken",
          startTime: "2026-07-09T08:00:00+02:00",
        },
        summary: "Schedule event: Asad und Tugba gehen zusammen fruehstuecken",
      },
      "In den Kalender eintragen, jeden Donnerstag Asad und Tugba gehen zusammen fruehstuecken.",
    );

    expect(result.grounded).toBe(true);
    expect(result.matchedTokens).toEqual(expect.arrayContaining(["asad", "tugba"]));
  });

  it("blocks an old calendar confirmation when the latest group message is unrelated prose", () => {
    const result = evaluateTelegramToolGrounding(
      {
        tool: "schedule_event",
        action: "create",
        data: {
          title: "Lehrerkonferenz Tugba",
          startTime: "2026-07-07T13:45:00+02:00",
        },
        summary: "Schedule event: Lehrerkonferenz Tugba at Tue, 07 Jul, 13:45",
      },
      "Respekt und Vertrauen wachsen dort, wo Verantwortung sichtbar uebernommen wird und beide Ehepartner sich ernst genommen fuehlen.",
    );

    expect(result.grounded).toBe(false);
    expect(result.reason).toBe("no_overlap_for_schedule_event");
  });

  it("blocks old pickup tasks when the latest group message does not mention them", () => {
    const result = evaluateTelegramToolGrounding(
      {
        tool: "manage_task",
        action: "add",
        data: { title: "Aliya abholen", dueDate: "2026-07-07T13:20:00+02:00" },
        summary: "Add task: Aliya abholen",
      },
      "Bitte fasse den langen Text oben nur als Notiz zusammen.",
    );

    expect(result.grounded).toBe(false);
  });

  it("allows referential follow-up mutations like moving it to a new time", () => {
    const result = evaluateTelegramToolGrounding(
      {
        tool: "manage_event",
        action: "update",
        data: { query: "Dentist", startTime: "2026-07-10T15:00:00+02:00" },
        summary: "Update event: Dentist - move to Fri, 10 Jul, 15:00",
      },
      "Actually move it to 3pm.",
    );

    expect(result.grounded).toBe(true);
    expect(result.reason).toBe("referential_mutation_intent");
  });

  it("allows a current shopping request with concise wording", () => {
    const result = evaluateTelegramToolGrounding(
      {
        tool: "add_shopping_item",
        action: "create",
        data: { name: "Milch", quantity: 2 },
        summary: "Add to shopping: 2x Milch",
      },
      "Milch auf die Einkaufsliste, bitte zwei Packungen.",
    );

    expect(result.grounded).toBe(true);
    expect(result.matchedTokens).toContain("milch");
  });
});
