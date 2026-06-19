import {
  addDays,
  addWeeks,
  addMonths,
  setHours,
  setMinutes,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
} from "date-fns";
import { TaskPriority, TaskCategory } from "@/types/flux";

interface ParsedTask {
  title: string;
  dueDate?: Date;
  priority: TaskPriority;
  category: TaskCategory;
}

// Priority keywords
const HIGH_PRIORITY_WORDS = [
  "urgent",
  "asap",
  "critical",
  "important",
  "high priority",
  "!",
  "!!",
  "!!!",
];
const LOW_PRIORITY_WORDS = ["low priority", "when possible", "someday", "eventually", "low"];

// Category keywords
const BUSINESS_WORDS = [
  "work",
  "meeting",
  "client",
  "project",
  "deadline",
  "review",
  "pr",
  "call",
  "email",
  "report",
  "presentation",
];
const _PERSONAL_WORDS = [
  "home",
  "family",
  "personal",
  "health",
  "gym",
  "groceries",
  "doctor",
  "dentist",
];

// Time patterns
const TIME_PATTERNS = [
  { regex: /at (\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i, extractor: extractTime },
  { regex: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i, extractor: extractTime },
];

function dateOnlyDueDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

// Date patterns
const DATE_PATTERNS = [
  { regex: /\btoday\b/i, extractor: () => dateOnlyDueDate(new Date()) },
  { regex: /\btomorrow\b/i, extractor: () => dateOnlyDueDate(addDays(new Date(), 1)) },
  { regex: /\bnext week\b/i, extractor: () => dateOnlyDueDate(addWeeks(new Date(), 1)) },
  { regex: /\bnext month\b/i, extractor: () => dateOnlyDueDate(addMonths(new Date(), 1)) },
  { regex: /\bmonday\b/i, extractor: () => dateOnlyDueDate(nextMonday(new Date())) },
  { regex: /\btuesday\b/i, extractor: () => dateOnlyDueDate(nextTuesday(new Date())) },
  { regex: /\bwednesday\b/i, extractor: () => dateOnlyDueDate(nextWednesday(new Date())) },
  { regex: /\bthursday\b/i, extractor: () => dateOnlyDueDate(nextThursday(new Date())) },
  { regex: /\bfriday\b/i, extractor: () => dateOnlyDueDate(nextFriday(new Date())) },
  { regex: /\bsaturday\b/i, extractor: () => dateOnlyDueDate(nextSaturday(new Date())) },
  { regex: /\bsunday\b/i, extractor: () => dateOnlyDueDate(nextSunday(new Date())) },
  {
    regex: /in (\d+) days?/i,
    extractor: (match: RegExpMatchArray) =>
      dateOnlyDueDate(addDays(new Date(), parseInt(match[1]))),
  },
  {
    regex: /in (\d+) weeks?/i,
    extractor: (match: RegExpMatchArray) =>
      dateOnlyDueDate(addWeeks(new Date(), parseInt(match[1]))),
  },
  {
    regex: /in (\d+) months?/i,
    extractor: (match: RegExpMatchArray) =>
      dateOnlyDueDate(addMonths(new Date(), parseInt(match[1]))),
  },
];

function extractTime(match: RegExpMatchArray): { hours: number; minutes: number } {
  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3]?.toLowerCase();

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return { hours, minutes };
}

export function parseTaskInput(input: string): ParsedTask {
  let title = input.trim();
  let dueDate: Date | undefined;
  let priority: TaskPriority = "medium";
  let category: TaskCategory = "personal";

  const lowerInput = input.toLowerCase();

  // Extract priority
  for (const word of HIGH_PRIORITY_WORDS) {
    if (lowerInput.includes(word)) {
      priority = "high";
      title = title.replace(new RegExp(word, "gi"), "").trim();
      break;
    }
  }
  if (priority === "medium") {
    for (const word of LOW_PRIORITY_WORDS) {
      if (lowerInput.includes(word)) {
        priority = "low";
        title = title.replace(new RegExp(word, "gi"), "").trim();
        break;
      }
    }
  }

  // Extract category
  for (const word of BUSINESS_WORDS) {
    if (lowerInput.includes(word)) {
      category = "business";
      break;
    }
  }
  // Extract date
  for (const pattern of DATE_PATTERNS) {
    const match = title.match(pattern.regex);
    if (match) {
      dueDate = pattern.extractor(match);
      title = title.replace(pattern.regex, "").trim();
      break;
    }
  }

  // Extract time (only if we have a date)
  if (dueDate) {
    for (const pattern of TIME_PATTERNS) {
      const match = title.match(pattern.regex);
      if (match) {
        const time = pattern.extractor(match);
        dueDate = setHours(setMinutes(dueDate, time.minutes), time.hours);
        title = title.replace(pattern.regex, "").trim();
        break;
      }
    }
  }

  // Clean up title
  title = title
    .replace(/\s+/g, " ")
    .replace(/^[-,\s]+|[-,\s]+$/g, "")
    .trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return { title, dueDate, priority, category };
}
