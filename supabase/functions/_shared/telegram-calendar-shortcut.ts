export interface TelegramCalendarShortcut {
  title: string;
  startTime: string;
  endTime: string;
}

interface ParseOptions {
  now?: Date;
  timeZone?: string;
  defaultDurationMinutes?: number;
}

const WEEKDAYS: Record<string, number> = {
  sonntag: 0,
  sunday: 0,
  montag: 1,
  monday: 1,
  dienstag: 2,
  tuesday: 2,
  mittwoch: 3,
  wednesday: 3,
  donnerstag: 4,
  thursday: 4,
  freitag: 5,
  friday: 5,
  samstag: 6,
  saturday: 6,
};

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatOffset(offsetMs: number): string {
  const sign = offsetMs >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMs);
  const hours = Math.floor(abs / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
}

function instantToZonedIso(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  const offset = formatOffset(getTimeZoneOffsetMs(date, timeZone));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(
    parts.minute,
  )}:00${offset}`;
}

function localDateTimeToZonedIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = getTimeZoneOffsetMs(new Date(wallClockUtc), timeZone);
  let instant = new Date(wallClockUtc - offset);
  const correctedOffset = getTimeZoneOffsetMs(instant, timeZone);
  if (correctedOffset !== offset) {
    offset = correctedOffset;
    instant = new Date(wallClockUtc - offset);
  }
  return instantToZonedIso(instant, timeZone);
}

function addDaysToDateParts(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function parseDateOffset(normalized: string, now: Date, timeZone: string): number | null {
  if (/\b(?:ubermorgen|uebermorgen|overmorrow)\b/.test(normalized)) return 2;
  if (/\b(?:morgen|tomorrow)\b/.test(normalized)) return 1;
  if (/\b(?:heute|today)\b/.test(normalized)) return 0;

  const weekdayEntry = Object.entries(WEEKDAYS).find(([name]) =>
    new RegExp(`\\b${name}\\b`).test(normalized),
  );
  if (!weekdayEntry) return null;

  const current = getZonedParts(now, timeZone);
  const currentDay = new Date(Date.UTC(current.year, current.month - 1, current.day)).getUTCDay();
  const targetDay = weekdayEntry[1];
  const offset = (targetDay - currentDay + 7) % 7;
  return offset === 0 ? 7 : offset;
}

function parseTime(normalized: string): { hour: number; minute: number } | null {
  const explicit = normalized.match(/\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\s*uhr\b/);
  const withUm = normalized.match(/\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/);
  const match = explicit || withUm;
  if (!match) return null;
  return {
    hour: Number(match[1]),
    minute: match[2] ? Number(match[2]) : 0,
  };
}

function hasCalendarTrigger(normalized: string): boolean {
  return (
    /\b(?:kalendereintrag|termin)\b/.test(normalized) ||
    /\bkalender\b/.test(normalized) ||
    /\b(?:trag|trage|tage|mache|mach|erstelle|erstell)\b.*\bkalender\b.*\bein\b/.test(normalized)
  );
}

function hasDateWord(normalized: string): boolean {
  return (
    /\b(?:heute|morgen|ubermorgen|uebermorgen|today|tomorrow)\b/.test(normalized) ||
    Object.keys(WEEKDAYS).some((day) => new RegExp(`\\b${day}\\b`).test(normalized))
  );
}

function hasTimeWord(normalized: string): boolean {
  return (
    /\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\s*uhr\b/.test(normalized) ||
    /\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/.test(normalized)
  );
}

function cleanupTitle(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/^[\s,.;:!-]+|[\s,.;:!-]+$/g, "")
    .replace(/^(?:bitte|und|fuer|fur)\s+/i, "")
    .trim();
}

function extractTitle(text: string): string {
  const chunks = text
    .split(/[,.;]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const titleChunks = chunks.filter((chunk) => {
    const normalized = normalizeText(chunk);
    return !hasCalendarTrigger(normalized) && !hasDateWord(normalized) && !hasTimeWord(normalized);
  });
  const chunkTitle = cleanupTitle(titleChunks.join(", "));
  if (chunkTitle) return chunkTitle;

  let fallback = text;
  fallback = fallback.replace(/\b(?:heute|morgen|uebermorgen|übermorgen|today|tomorrow)\b/gi, " ");
  fallback = fallback.replace(/\b(?:um\s*)?([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\s*uhr\b/gi, " ");
  fallback = fallback.replace(/\bum\s*([01]?\d|2[0-3])(?:\s*[:.]\s*(\d{2}))?\b/gi, " ");
  fallback = fallback.replace(
    /\b(?:mach(?:e)?|erstell(?:e)?|trag(?:e)?|tage)\b\s*(?:einen?\s+)?(?:kalendereintrag|termin)?\s*(?:in\s+den\s+kalender)?\s*(?:ein)?/gi,
    " ",
  );
  fallback = fallback.replace(/\b(?:in\s+den\s+)?kalender\s*(?:eintragen|ein)?\b/gi, " ");
  fallback = fallback.replace(/\b(?:kalendereintrag|termin)\b/gi, " ");
  return cleanupTitle(fallback);
}

export function parseTelegramCalendarShortcut(
  text: string,
  opts: ParseOptions = {},
): TelegramCalendarShortcut | null {
  const original = cleanupTitle(text || "");
  if (!original) return null;

  const normalized = normalizeText(original);
  if (!hasCalendarTrigger(normalized)) return null;

  const timeZone = opts.timeZone || "Europe/Berlin";
  const now = opts.now || new Date();
  const dateOffset = parseDateOffset(normalized, now, timeZone);
  const time = parseTime(normalized);
  if (dateOffset == null || !time) return null;

  const current = getZonedParts(now, timeZone);
  const targetDate = addDaysToDateParts(current.year, current.month, current.day, dateOffset);
  const title = extractTitle(original);
  if (title.length < 3) return null;

  const startTime = localDateTimeToZonedIso(
    targetDate.year,
    targetDate.month,
    targetDate.day,
    time.hour,
    time.minute,
    timeZone,
  );
  const duration = opts.defaultDurationMinutes ?? 60;
  const endTime = instantToZonedIso(
    new Date(new Date(startTime).getTime() + duration * 60_000),
    timeZone,
  );

  return { title, startTime, endTime };
}

export function buildScheduleEventToolXml(event: TelegramCalendarShortcut): string {
  return `<tool>schedule_event</tool><event>${JSON.stringify(event)}</event>`;
}
