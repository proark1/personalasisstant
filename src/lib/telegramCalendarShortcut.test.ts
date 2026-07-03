import { describe, expect, it } from "vitest";
import {
  buildScheduleEventToolXml,
  parseTelegramCalendarShortcut,
} from "../../supabase/functions/_shared/telegram-calendar-shortcut";

const now = new Date("2026-07-03T20:59:00Z"); // 22:59 in Europe/Berlin
const timeZone = "Europe/Berlin";

describe("Telegram calendar shortcut", () => {
  it("parses a German voice transcript with STT 'Tage' instead of 'Trage'", () => {
    const event = parseTelegramCalendarShortcut(
      "Tage im Kalender ein, morgen um 16 Uhr, Kindergeburtstag, Alia und Sali.",
      { now, timeZone },
    );

    expect(event).toEqual({
      title: "Kindergeburtstag, Alia und Sali",
      startTime: "2026-07-04T16:00:00+02:00",
      endTime: "2026-07-04T17:00:00+02:00",
    });
  });

  it("parses 'Mache einen Kalendereintrag' voice wording", () => {
    const event = parseTelegramCalendarShortcut(
      "Mache einen Kalendereintrag, morgen 16 Uhr, Kindergeburtstag, Adia und Sali.",
      { now, timeZone },
    );

    expect(event?.title).toBe("Kindergeburtstag, Adia und Sali");
    expect(event?.startTime).toBe("2026-07-04T16:00:00+02:00");
    expect(buildScheduleEventToolXml(event!)).toContain("<tool>schedule_event</tool>");
  });

  it("does not parse ordinary chat with a date and time but no calendar intent", () => {
    expect(
      parseTelegramCalendarShortcut("Morgen 16 Uhr klingt gut fuer den Spielplatz.", {
        now,
        timeZone,
      }),
    ).toBeNull();
  });
});
