import { describe, expect, it } from "vitest";
import {
  TELEGRAM_COMMAND_LIMIT,
  TELEGRAM_COMMANDS,
  TELEGRAM_GROUP_COMMANDS,
  TELEGRAM_GROUP_COMMANDS_DE,
  TELEGRAM_PRIVATE_COMMANDS,
  TELEGRAM_PRIVATE_COMMANDS_DE,
  TELEGRAM_WORKSPACE_COMMANDS,
  TELEGRAM_WORKSPACE_COMMANDS_DE,
  isTelegramGroupActionableText,
  isTelegramQuickCommand,
  normalizeTelegramCommand,
  telegramCommandSet,
  validateTelegramCommands,
} from "../../supabase/functions/_shared/telegram-commands";

describe("Telegram command registration", () => {
  it("keeps the registered command list valid for Telegram Bot API limits", () => {
    expect(TELEGRAM_COMMANDS.length).toBeLessThanOrEqual(TELEGRAM_COMMAND_LIMIT);
    expect(validateTelegramCommands(TELEGRAM_COMMANDS)).toEqual([]);
    expect(TELEGRAM_COMMANDS.map((c) => c.command)).toEqual(
      expect.arrayContaining([
        "cockpit",
        "brief",
        "plan",
        "delegate",
        "review",
        "settings",
        "now",
        "next",
        "whatnow",
        "approvals",
        "pending",
        "memory",
        "memories",
        "help",
        "commands",
      ]),
    );
  });

  it("keeps scoped and localized command menus valid", () => {
    const sets = [
      TELEGRAM_PRIVATE_COMMANDS,
      TELEGRAM_PRIVATE_COMMANDS_DE,
      TELEGRAM_GROUP_COMMANDS,
      TELEGRAM_GROUP_COMMANDS_DE,
      TELEGRAM_WORKSPACE_COMMANDS,
      TELEGRAM_WORKSPACE_COMMANDS_DE,
    ];

    for (const set of sets) {
      expect(set.length).toBeLessThanOrEqual(TELEGRAM_COMMAND_LIMIT);
      expect(validateTelegramCommands(set)).toEqual([]);
    }

    expect(telegramCommandSet("private", "de").map((c) => c.command)).toContain("lang");
    expect(telegramCommandSet("workspace", "en").map((c) => c.command)).toEqual(
      expect.arrayContaining(["standup", "recap", "schedule", "comment", "linkworkspace"]),
    );
  });

  it("reports invalid names, duplicates, descriptions, and list length", () => {
    const tooMany = Array.from({ length: TELEGRAM_COMMAND_LIMIT + 1 }, (_, i) => ({
      command: `cmd_${i}`,
      description: "ok",
    }));
    const errors = validateTelegramCommands([
      ...tooMany,
      { command: "Bad-Name", description: "ok" },
      { command: "cmd_1", description: "" },
    ]);

    expect(errors.some((e) => e.includes("at most"))).toBe(true);
    expect(errors.some((e) => e.includes("invalid command"))).toBe(true);
    expect(errors.some((e) => e.includes("duplicates /cmd_1"))).toBe(true);
    expect(errors.some((e) => e.includes("description"))).toBe(true);
  });
});

describe("Telegram group intent detection", () => {
  it("detects English and German productivity phrases", () => {
    expect(isTelegramGroupActionableText("Please remind me tomorrow to call Sarah")).toBe(true);
    expect(isTelegramGroupActionableText("Termin morgen 14 Uhr Zahnarzt")).toBe(true);
    expect(isTelegramGroupActionableText("Milch auf die Einkaufsliste")).toBe(true);
    expect(isTelegramGroupActionableText("verschieb das Meeting auf Freitag")).toBe(true);
  });

  it("does not wake the bot for ordinary group chatter", () => {
    expect(isTelegramGroupActionableText("haha genau, klingt gut")).toBe(false);
    expect(isTelegramGroupActionableText("what a nice picture")).toBe(false);
  });
});

describe("Telegram quick command aliases", () => {
  it("normalizes slash commands and bot suffixes safely enough for private quick routing", () => {
    expect(normalizeTelegramCommand("/now")).toBe("now");
    expect(normalizeTelegramCommand("  /PENDING please  ")).toBe("pending");
    expect(normalizeTelegramCommand("/now@darai_bot")).toBe("now");
  });

  it("matches all quick-command aliases through the shared alias map", () => {
    expect(isTelegramQuickCommand("/commands", "help")).toBe(true);
    expect(isTelegramQuickCommand("/pending", "approvals")).toBe(true);
    expect(isTelegramQuickCommand("/whatnow", "now")).toBe(true);
    expect(isTelegramQuickCommand("/memories", "memory")).toBe(true);
    expect(isTelegramQuickCommand("/memory", "now")).toBe(false);
    expect(isTelegramQuickCommand("/briefing", "brief")).toBe(true);
    expect(isTelegramQuickCommand("/preferences", "settings")).toBe(true);
  });
});
